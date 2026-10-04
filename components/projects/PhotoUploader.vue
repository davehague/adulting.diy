<template>
  <div>
    <ul v-if="items.length" class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
      <li v-for="item in items" :key="item.key" class="relative">
        <img :src="item.previewUrl" alt="" class="w-full aspect-square object-cover rounded-lg border border-stone-200">
        <span class="absolute bottom-1 left-1 text-xs font-medium px-1.5 py-0.5 rounded bg-white/90"
              :class="item.state === 'failed' ? 'text-red-700' : 'text-stone-700'">
          {{ STATE_LABELS[item.state] }}
        </span>
        <button v-if="item.state === 'waiting' || item.state === 'failed'"
                type="button"
                class="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-stone-700 text-sm leading-none hover:bg-white"
                aria-label="Remove photo"
                @click="removeItem(item.key)">
          &times;
        </button>
        <button v-if="item.state === 'failed' && canRetry"
                type="button"
                class="mt-1 w-full text-xs font-medium text-amber-700 hover:text-amber-800"
                @click="retry(item.key)">
          Retry
        </button>
        <p v-if="item.error" class="mt-1 text-xs text-red-700 break-words">{{ item.error }}</p>
      </li>
    </ul>

    <label v-if="roomLeft > 0"
           class="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 transition-colors cursor-pointer">
      <Camera :size="16" />Add photo
      <input type="file" accept="image/*" multiple class="sr-only" @change="onPick">
    </label>
    <p v-else class="text-sm text-stone-600">This project has the maximum of {{ MAX_PROJECT_PHOTOS }} photos.</p>
    <p v-if="notice" class="mt-2 text-sm text-stone-600">{{ notice }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import { Camera } from 'lucide-vue-next';
import { MAX_PROJECT_PHOTOS, type ProjectPhotoDto } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { resizePhoto } from '@/utils/image-resize';

type UploadState = 'waiting' | 'uploading' | 'done' | 'failed';

interface UploadItem {
  key: number;
  file: File;
  previewUrl: string;
  state: UploadState;
  error: string | null;
}

const STATE_LABELS: Record<UploadState, string> = {
  waiting: 'Ready',
  uploading: 'Uploading...',
  done: 'Uploaded',
  failed: 'Failed',
};

const props = withDefaults(defineProps<{
  // How many more photos the project can take, not counting ones picked here.
  remaining: number;
  projectId?: string;
  // Upload as soon as photos are picked (used on an existing project, and on the new-project form).
  autoUpload?: boolean;
  // Creates the project (once) and returns its id. Used for auto-upload when there is no projectId
  // yet (the new-project form); the caller is expected to memoise the in-flight create so that
  // concurrent calls (two picks, or a pick racing a Save) share one request.
  ensureProjectId?: () => Promise<string>;
  // Keep finished items visible instead of clearing them, for forms with no other photo grid.
  keepUploaded?: boolean;
}>(), { projectId: undefined, autoUpload: false, ensureProjectId: undefined, keepUploaded: false });

const emit = defineEmits<{ uploaded: [photo: ProjectPhotoDto] }>();

const { uploadPhoto } = useProjects();

const items = ref<UploadItem[]>([]);
const notice = ref<string | null>(null);
const targetProjectId = ref<string | null>(props.projectId ?? null);
let nextKey = 0;

const unsent = computed(() => items.value.filter((item) => item.state !== 'done'));
const roomLeft = computed(() => props.remaining - unsent.value.length);
const hasPending = computed(() => unsent.value.length > 0);
// Whether a Retry button can do anything: either we already know the project, or we have a way to create it.
const canRetry = computed(() => !!(targetProjectId.value || props.projectId || props.ensureProjectId));
// Exposed as a plain function (not a computed/ref) so a parent can call it fresh on every check,
// without depending on how defineExpose happens to (un)wrap a returned ref.
const hasFailedPhotos = (): boolean => items.value.some((item) => item.state === 'failed');

// Every operation that touches the upload queue (auto-upload on pick, a per-photo retry, and the
// parent's own uploadAll on Save) runs through this chain, one at a time, so two of them can never
// race against the same items. The chain itself never rejects, so a failing task never blocks later ones.
let chain: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
  const result = chain.then(task);
  chain = result.catch(() => undefined);
  return result;
};

const uploadOne = async (item: UploadItem, projectId: string): Promise<void> => {
  item.state = 'uploading';
  item.error = null;
  try {
    const resized = await resizePhoto(item.file);
    const photo = await uploadPhoto(projectId, resized);
    item.state = 'done';
    emit('uploaded', photo);
  } catch (e) {
    item.state = 'failed';
    item.error = e instanceof Error ? e.message : 'Upload failed';
  }
};

// One at a time: phone uploads on cellular data are more reliable in sequence, and photo order is kept.
const uploadAllTask = async (projectId: string): Promise<boolean> => {
  targetProjectId.value = projectId;
  for (const item of items.value) {
    if (item.state === 'waiting' || item.state === 'failed') await uploadOne(item, projectId);
  }
  const allDone = items.value.every((item) => item.state === 'done');
  if (props.autoUpload && !props.keepUploaded) clearDone();
  return allDone;
};

const uploadAll = (projectId: string): Promise<boolean> => enqueue(() => uploadAllTask(projectId));

// Resolves the project to upload into for the auto-upload and retry paths: the given projectId, or
// (on the new-project form) ensureProjectId, which creates it on first use.
const resolveTarget = (): Promise<string> => {
  if (props.projectId) return Promise.resolve(props.projectId);
  if (props.ensureProjectId) return props.ensureProjectId();
  return Promise.reject(new Error('No project to upload to'));
};

const clearDone = (): void => {
  for (const item of items.value) {
    if (item.state === 'done') URL.revokeObjectURL(item.previewUrl);
  }
  items.value = items.value.filter((item) => item.state !== 'done');
};

const startAutoUpload = (): Promise<void> => enqueue(async () => {
  let projectId: string;
  try {
    projectId = await resolveTarget();
  } catch (e) {
    // The project could not be created (e.g. no signal): leave the just-picked photos as failed so
    // Retry (per photo, or a later Save) can try creating it again.
    const message = e instanceof Error ? e.message : 'Could not create the project';
    for (const item of items.value) {
      if (item.state === 'waiting') {
        item.state = 'failed';
        item.error = message;
      }
    }
    return;
  }
  await uploadAllTask(projectId);
});

const onPick = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  // Reset so picking the same file again still fires a change event.
  input.value = '';
  notice.value = null;
  const room = Math.max(0, roomLeft.value);
  if (files.length > room) {
    notice.value = `Only ${room} more photo${room === 1 ? '' : 's'} can be added (this project can have ${MAX_PROJECT_PHOTOS}).`;
  }
  for (const file of files.slice(0, room)) {
    items.value.push({ key: nextKey++, file, previewUrl: URL.createObjectURL(file), state: 'waiting', error: null });
  }
  if (props.autoUpload) await startAutoUpload();
};

const removeItem = (key: number): void => {
  const item = items.value.find((candidate) => candidate.key === key);
  if (item) URL.revokeObjectURL(item.previewUrl);
  items.value = items.value.filter((candidate) => candidate.key !== key);
};

const retry = (key: number): Promise<void> => enqueue(async () => {
  const item = items.value.find((candidate) => candidate.key === key);
  if (!item) return;
  let projectId = targetProjectId.value;
  if (!projectId) {
    try {
      projectId = await resolveTarget();
    } catch (e) {
      item.state = 'failed';
      item.error = e instanceof Error ? e.message : 'Could not create the project';
      return;
    }
  }
  await uploadOne(item, projectId);
  if (props.autoUpload && !props.keepUploaded) clearDone();
});

onBeforeUnmount(() => {
  for (const item of items.value) URL.revokeObjectURL(item.previewUrl);
});

defineExpose({ uploadAll, hasPending, hasFailedPhotos });
</script>
