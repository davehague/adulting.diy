<template>
  <img v-if="src" :src="src" :alt="alt" class="w-full h-full object-cover">
  <div v-else class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 text-xs">
    {{ failed ? 'Photo unavailable' : '' }}
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { type PhotoVariant } from '@/types/project';
import { useProjects } from '@/composables/useProjects';

const props = withDefaults(defineProps<{
  projectId: string;
  photoId: string;
  variant?: PhotoVariant;
  alt?: string;
}>(), { variant: 'thumb', alt: '' });

const { fetchPhotoBlob } = useProjects();

const src = ref<string | null>(null);
const failed = ref(false);
let latestRequest = 0;

const release = (): void => {
  if (src.value) URL.revokeObjectURL(src.value);
  src.value = null;
};

const load = async (): Promise<void> => {
  const request = ++latestRequest;
  failed.value = false;
  try {
    const blob = await fetchPhotoBlob(props.projectId, props.photoId, props.variant);
    // A newer request (or unmount) superseded this one; drop the result.
    if (request !== latestRequest) return;
    release();
    src.value = URL.createObjectURL(blob);
  } catch {
    if (request !== latestRequest) return;
    release();
    failed.value = true;
  }
};

watch(() => [props.projectId, props.photoId, props.variant], load, { immediate: true });

onBeforeUnmount(() => {
  latestRequest++;
  release();
});
</script>
