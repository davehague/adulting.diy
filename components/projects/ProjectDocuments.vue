<template>
  <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6"
           @dragenter.prevent="onDragEnter" @dragover.prevent @dragleave="onDragLeave" @drop.prevent="onDrop">
    <h2 class="text-lg font-medium text-stone-900 mb-3">Documents</h2>

    <p v-if="documents.length === 0 && items.length === 0" class="text-sm text-stone-600 mb-3">
      No documents yet. Add contractor briefs, quotes and contracts here.
    </p>

    <ul v-if="documents.length" class="divide-y divide-stone-100 mb-3">
      <li v-for="doc in documents" :key="doc.id" class="py-2">
        <div class="flex items-start gap-3">
          <component :is="iconFor(doc)" :size="20" class="mt-0.5 shrink-0 text-stone-500" aria-hidden="true" />

          <!-- Closed row: the name opens the file. -->
          <div v-if="editingId !== doc.id" class="flex-1 min-w-0">
            <button type="button"
                    class="block w-full text-left text-sm font-medium text-amber-700 hover:text-amber-800 break-words"
                    :disabled="openingId === doc.id"
                    @click="openDocument(doc)">
              {{ doc.name }}
            </button>
            <span v-if="doc.note" class="block text-sm text-stone-700 break-words mt-0.5">{{ doc.note }}</span>
            <span class="block text-xs text-stone-500 mt-0.5">{{ formatDocumentSize(doc.sizeBytes) }} · {{ formatDate(doc.createdAt) }}</span>
            <div class="flex gap-2 mt-1">
              <button type="button"
                      class="text-xs font-medium text-stone-600 px-2 py-1 -ml-2 rounded-lg hover:bg-stone-100"
                      @click="openEditor(doc)">
                Edit
              </button>
              <button type="button"
                      class="text-xs font-medium text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
                      :disabled="busyIds.includes(doc.id)"
                      @click="removeDocument(doc)">
                Remove
              </button>
            </div>
          </div>

          <!-- Open row: each field saves when it loses focus or Enter is pressed; Escape closes without saving. -->
          <div v-else class="flex-1 min-w-0 space-y-2">
            <label class="block">
              <span class="text-xs text-stone-600">Name</span>
              <input v-model="draftName"
                     type="text"
                     :maxlength="MAX_DOCUMENT_NAME_LENGTH"
                     class="mt-0.5 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                     @blur="saveName(doc)"
                     @keydown.enter.prevent="blurTarget"
                     @keydown.esc.prevent="closeEditor">
            </label>
            <label class="block">
              <span class="text-xs text-stone-600">Note (optional)</span>
              <input v-model="draftNote"
                     type="text"
                     :maxlength="MAX_DOCUMENT_NOTE_LENGTH"
                     placeholder="Owens quote, Nov 2026"
                     class="mt-0.5 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                     @blur="saveNote(doc)"
                     @keydown.enter.prevent="blurTarget"
                     @keydown.esc.prevent="closeEditor">
            </label>
            <button type="button"
                    class="text-sm font-medium text-stone-600 px-2 py-1 -ml-2 rounded-lg hover:bg-stone-100"
                    @click="closeEditor">
              Close
            </button>
          </div>
        </div>
        <p v-if="rowErrors[doc.id]" class="mt-1 ml-8 text-sm text-red-700" aria-live="polite">{{ rowErrors[doc.id] }}</p>
      </li>
    </ul>

    <!-- Files on their way: one at a time, in the order picked. -->
    <ul v-if="items.length" class="space-y-2 mb-3">
      <li v-for="item in items" :key="item.key" class="rounded-lg border border-stone-200 px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="flex-1 min-w-0 text-sm text-stone-900 truncate">{{ item.name }}</span>
          <span class="text-xs font-medium shrink-0" :class="item.state === 'failed' ? 'text-red-700' : 'text-stone-600'">
            {{ stateLabel(item) }}
          </span>
          <button v-if="item.state === 'failed'"
                  type="button"
                  class="text-xs font-medium text-amber-700 hover:text-amber-800 px-1"
                  @click="retry(item.key)">
            Retry
          </button>
          <button v-if="item.state === 'waiting' || item.state === 'failed'"
                  type="button"
                  class="w-6 h-6 rounded-full text-stone-600 text-sm leading-none hover:bg-stone-100"
                  :aria-label="`Remove ${item.name} from the uploads`"
                  @click="removeItem(item.key)">
            &times;
          </button>
        </div>
        <div v-if="item.state === 'uploading'" class="mt-1.5 h-1 rounded bg-stone-100 overflow-hidden">
          <div class="h-full bg-amber-500 transition-all" :style="{ width: `${item.percent}%` }" />
        </div>
        <p v-if="item.error" class="mt-1 text-xs text-red-700 break-words">{{ item.error }}</p>
      </li>
    </ul>

    <div v-if="canUpload && roomLeft > 0"
         class="flex flex-wrap items-center gap-3 rounded-lg sm:border-2 sm:border-dashed sm:p-4 transition-colors"
         :class="dragging ? 'border-amber-500 bg-amber-50' : 'border-stone-300'">
      <label class="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 transition-colors cursor-pointer">
        <FilePlus :size="16" />Add documents
        <input type="file" :accept="ACCEPT" multiple class="sr-only" @change="onPick">
      </label>
      <span class="hidden sm:inline text-sm text-stone-500">{{ dragging ? 'Drop to add' : 'or drop files here' }}</span>
    </div>
    <p v-else-if="canUpload" class="text-sm text-stone-600">This project has {{ MAX_PROJECT_DOCUMENTS }} documents</p>
    <p v-for="line in notices" :key="line" class="mt-2 text-sm text-stone-600">{{ line }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { FilePlus, FileSpreadsheet, FileText, Image as ImageIcon } from 'lucide-vue-next';
import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_NAME_LENGTH,
  MAX_DOCUMENT_NOTE_LENGTH,
  MAX_PROJECT_DOCUMENTS,
  type ProjectDocumentDto,
} from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import {
  defaultDocumentName,
  documentBlobPath,
  documentExtension,
  formatDocumentSize,
  safeDocumentFileName,
} from '@/utils/project-documents';

const ACCEPT = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const TYPE_MESSAGE = 'Only PDF, Word, Excel, JPEG or PNG files';
const NOT_FOUND_MESSAGE = 'Upload not found. Try again.';

type ItemState = 'waiting' | 'uploading' | 'saving' | 'failed';

interface QueueItem {
  key: number;
  file: File;
  id: string;
  path: string;
  name: string;
  state: ItemState;
  percent: number;
  error: string | null;
}

const props = defineProps<{
  projectId: string;
  // null only while an older server build (mid-deploy) answers without it; uploads stay hidden until it is there
  householdId: string | null;
  documents: ProjectDocumentDto[];
}>();

const emit = defineEmits<{ 'update:documents': [documents: ProjectDocumentDto[]] }>();

const { uploadDocumentFile, registerDocument, getDocumentLink, updateDocument, deleteDocument } = useProjects();

const items = ref<QueueItem[]>([]);
const notices = ref<string[]>([]);
const rowErrors = reactive<Record<string, string>>({});
const busyIds = ref<string[]>([]);
const openingId = ref<string | null>(null);
let nextKey = 0;

const canUpload = computed(() => !!props.householdId);
const roomLeft = computed(() => MAX_PROJECT_DOCUMENTS - props.documents.length - items.value.length);

// The newest list: set at once on every change, because the prop only catches up after the parent re-renders and two
// changes in one tick (two uploads landing together, an upload and an edit) would otherwise overwrite each other.
let latest: ProjectDocumentDto[] = props.documents;
watch(() => props.documents, (value) => { latest = value; });
const current = (): ProjectDocumentDto[] => latest;
const commit = (next: ProjectDocumentDto[]): void => {
  latest = next;
  emit('update:documents', next);
};

const iconFor = (doc: ProjectDocumentDto) => {
  const extension = documentExtension(doc.fileName);
  if (extension === 'xlsx') return FileSpreadsheet;
  if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') return ImageIcon;
  return FileText;
};

const formatDate = (value: Date | string): string => {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

const stateLabel = (item: QueueItem): string => {
  if (item.state === 'waiting') return 'Waiting';
  if (item.state === 'uploading') return `Uploading ${item.percent}%`;
  if (item.state === 'saving') return 'Saving...';
  return 'Failed';
};

const messageOf = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

// Queue work (a pick, a drop, a retry) runs one task at a time, so two of them never touch the same item at once.
let chain: Promise<unknown> = Promise.resolve();
const enqueue = (task: () => Promise<void>): Promise<void> => {
  const result = chain.then(task);
  chain = result.catch(() => undefined);
  return result;
};

const putFile = async (item: QueueItem): Promise<void> => {
  item.state = 'uploading';
  item.percent = 0;
  await uploadDocumentFile(props.projectId, item.path, item.file, (percent) => { item.percent = percent; });
};

const register = async (item: QueueItem): Promise<void> => {
  item.state = 'saving';
  const saved = await registerDocument(props.projectId, { id: item.id, blobPath: item.path, name: item.name, note: null });
  items.value = items.value.filter((candidate) => candidate.key !== item.key);
  if (!current().some((doc) => doc.id === saved.id)) commit([saved, ...current()]);
};

const fail = (item: QueueItem, error: unknown, fallback: string): void => {
  item.state = 'failed';
  item.error = messageOf(error, fallback);
};

const sendItem = async (item: QueueItem): Promise<void> => {
  item.error = null;
  try {
    await putFile(item);
  } catch (error) {
    // The SDK's own errors say nothing useful to a person; the server's reason never reaches it.
    fail(item, null, 'Upload failed. Try again.');
    console.error('[ProjectDocuments] upload failed:', error);
    return;
  }
  try {
    await register(item);
  } catch (error) {
    fail(item, error, 'Could not save the document. Try again.');
  }
};

// A PUT that landed but lost its answer cannot be sent again (the path refuses overwrites), so a retry asks the server
// first and uploads again only when the file is not in storage.
const retryItem = async (item: QueueItem): Promise<void> => {
  item.error = null;
  try {
    await register(item);
    return;
  } catch (error) {
    if (messageOf(error, '') !== NOT_FOUND_MESSAGE) {
      fail(item, error, 'Could not save the document. Try again.');
      return;
    }
  }
  await sendItem(item);
};

const runWaiting = (): Promise<void> => enqueue(async () => {
  for (const item of [...items.value]) {
    if (item.state === 'waiting' && items.value.includes(item)) await sendItem(item);
  }
});

const retry = (key: number): Promise<void> => enqueue(async () => {
  const item = items.value.find((candidate) => candidate.key === key);
  if (item && item.state === 'failed') await retryItem(item);
});

const addFiles = async (files: File[]): Promise<void> => {
  notices.value = [];
  const householdId = props.householdId;
  if (!householdId || files.length === 0) return;
  const accepted: File[] = [];
  let wrongType = 0;
  for (const file of files) {
    if (!documentExtension(file.name)) wrongType++;
    else if (file.size > MAX_DOCUMENT_BYTES) notices.value.push(`${file.name}: Over 25 MB`);
    else accepted.push(file);
  }
  if (wrongType > 0) notices.value.unshift(TYPE_MESSAGE);
  const room = Math.max(0, roomLeft.value);
  if (accepted.length > room) notices.value.push(`This project can hold ${MAX_PROJECT_DOCUMENTS} documents`);
  for (const file of accepted.slice(0, room)) {
    const id = crypto.randomUUID();
    // Not null: documentExtension accepted the name above.
    const fileName = safeDocumentFileName(file.name) as string;
    const item: QueueItem = {
      key: nextKey++,
      file,
      id,
      path: documentBlobPath(householdId, props.projectId, id, fileName),
      name: defaultDocumentName(file.name),
      state: 'waiting',
      percent: 0,
      error: null,
    };
    items.value.push(item);
  }
  await runWaiting();
};

const onPick = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  // Reset so picking the same file again still fires a change event.
  input.value = '';
  await addFiles(files);
};

// dragenter and dragleave fire for every child the pointer crosses; counting them keeps the highlight steady.
const dragging = ref(false);
let dragDepth = 0;
const onDragEnter = (event: DragEvent): void => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  dragDepth++;
  dragging.value = true;
};
const onDragLeave = (): void => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dragging.value = false;
};
const onDrop = async (event: DragEvent): Promise<void> => {
  dragDepth = 0;
  dragging.value = false;
  if (!canUpload.value) return;
  const dropped = Array.from(event.dataTransfer?.files ?? []);
  if (roomLeft.value <= 0 && dropped.length > 0) {
    notices.value = [`This project can hold ${MAX_PROJECT_DOCUMENTS} documents`];
    return;
  }
  await addFiles(dropped);
};

const removeItem = (key: number): void => {
  items.value = items.value.filter((candidate) => candidate.key !== key);
};

// A phone blocks a tab opened after an await, so the tab opens in the tap and is pointed at the file when the link arrives.
const openDocument = async (doc: ProjectDocumentDto): Promise<void> => {
  delete rowErrors[doc.id];
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  openingId.value = doc.id;
  try {
    const { url } = await getDocumentLink(props.projectId, doc.id);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch {
    tab?.close();
    rowErrors[doc.id] = 'Could not open. Try again.';
  } finally {
    openingId.value = null;
  }
};

const editingId = ref<string | null>(null);
const draftName = ref('');
const draftNote = ref('');

const openEditor = (doc: ProjectDocumentDto): void => {
  delete rowErrors[doc.id];
  editingId.value = doc.id;
  draftName.value = doc.name;
  draftNote.value = doc.note ?? '';
};

const closeEditor = (): void => {
  editingId.value = null;
};

const blurTarget = (event: KeyboardEvent): void => {
  (event.target as HTMLElement).blur();
};

const replace = (saved: ProjectDocumentDto): void => {
  commit(current().map((doc) => (doc.id === saved.id ? saved : doc)));
};

const saveName = async (doc: ProjectDocumentDto): Promise<void> => {
  // Escape closed the editor first: the blur that follows is not a save.
  if (editingId.value !== doc.id) return;
  const name = draftName.value.trim();
  if (name === doc.name) return;
  if (name === '') {
    draftName.value = doc.name;
    rowErrors[doc.id] = "Name can't be blank";
    return;
  }
  delete rowErrors[doc.id];
  try {
    replace(await updateDocument(props.projectId, doc.id, { name }));
  } catch (error) {
    draftName.value = doc.name;
    rowErrors[doc.id] = messageOf(error, 'Could not save. Try again.');
  }
};

const saveNote = async (doc: ProjectDocumentDto): Promise<void> => {
  if (editingId.value !== doc.id) return;
  const note = draftNote.value.trim();
  if (note === (doc.note ?? '')) return;
  delete rowErrors[doc.id];
  try {
    replace(await updateDocument(props.projectId, doc.id, { note: note === '' ? null : note }));
  } catch (error) {
    draftNote.value = doc.note ?? '';
    rowErrors[doc.id] = messageOf(error, 'Could not save. Try again.');
  }
};

const removeDocument = async (doc: ProjectDocumentDto): Promise<void> => {
  if (!window.confirm('Remove this document? This cannot be undone.')) return;
  delete rowErrors[doc.id];
  busyIds.value = [...busyIds.value, doc.id];
  try {
    await deleteDocument(props.projectId, doc.id);
    if (editingId.value === doc.id) editingId.value = null;
    commit(current().filter((candidate) => candidate.id !== doc.id));
  } catch (error) {
    rowErrors[doc.id] = messageOf(error, 'Could not remove. Try again.');
  } finally {
    busyIds.value = busyIds.value.filter((id) => id !== doc.id);
  }
};
</script>
