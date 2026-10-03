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
        <button v-if="item.state === 'failed' && targetProjectId"
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
  // Upload as soon as photos are picked (used on an existing project).
  autoUpload?: boolean;
}>(), { projectId: undefined, autoUpload: false });

const emit = defineEmits<{ uploaded: [photo: ProjectPhotoDto] }>();

const { uploadPhoto } = useProjects();

const items = ref<UploadItem[]>([]);
const notice = ref<string | null>(null);
const targetProjectId = ref<string | null>(props.projectId ?? null);
let nextKey = 0;

const unsent = computed(() => items.value.filter((item) => item.state !== 'done'));
const roomLeft = computed(() => props.remaining - unsent.value.length);
const hasPending = computed(() => unsent.value.length > 0);

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
const uploadAll = async (projectId: string): Promise<boolean> => {
  targetProjectId.value = projectId;
  for (const item of items.value) {
    if (item.state === 'waiting' || item.state === 'failed') await uploadOne(item, projectId);
  }
  const allDone = items.value.every((item) => item.state === 'done');
  if (props.autoUpload) clearDone();
  return allDone;
};

const clearDone = (): void => {
  for (const item of items.value) {
    if (item.state === 'done') URL.revokeObjectURL(item.previewUrl);
  }
  items.value = items.value.filter((item) => item.state !== 'done');
};

const onPick = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  // Reset so picking the same file again still fires a change event.
  input.value = '';
  notice.value = null;
  const room = Math.max(0, roomLeft.value);
  if (files.length > room) {
    notice.value = `Only ${room} more photo${room === 1 ? '' : 's'} can be added (limit ${MAX_PROJECT_PHOTOS}).`;
  }
  for (const file of files.slice(0, room)) {
    items.value.push({ key: nextKey++, file, previewUrl: URL.createObjectURL(file), state: 'waiting', error: null });
  }
  if (props.autoUpload && props.projectId) await uploadAll(props.projectId);
};

const removeItem = (key: number): void => {
  const item = items.value.find((candidate) => candidate.key === key);
  if (item) URL.revokeObjectURL(item.previewUrl);
  items.value = items.value.filter((candidate) => candidate.key !== key);
};

const retry = async (key: number): Promise<void> => {
  const item = items.value.find((candidate) => candidate.key === key);
  if (!item || !targetProjectId.value) return;
  await uploadOne(item, targetProjectId.value);
  if (props.autoUpload) clearDone();
};

onBeforeUnmount(() => {
  for (const item of items.value) URL.revokeObjectURL(item.previewUrl);
});

defineExpose({ uploadAll, hasPending });
</script>
