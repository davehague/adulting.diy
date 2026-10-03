<template>
  <img v-if="src" :src="src" :alt="alt" :class="imgClass">
  <div v-else :class="fallbackClass">
    {{ failed ? 'Photo unavailable' : '' }}
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import { type PhotoVariant } from '@/types/project';
import { useProjects } from '@/composables/useProjects';

const props = withDefaults(defineProps<{
  projectId: string;
  photoId: string;
  variant?: PhotoVariant;
  alt?: string;
  // Shows the whole photo scaled to fit its box instead of cropping to fill it (the full-size viewer).
  contain?: boolean;
}>(), { variant: 'thumb', alt: '', contain: false });

// In "contain" mode the box has no fixed height (the viewer sizes to the photo), so the image
// must not be forced to w-full/h-full: it keeps its intrinsic size, capped by classes the caller passes in.
const imgClass = computed(() => (props.contain ? 'object-contain' : 'w-full h-full object-cover'));
const fallbackClass = computed(() => (props.contain
  ? 'flex items-center justify-center bg-stone-100 text-stone-400 text-xs rounded-lg p-12'
  : 'w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 text-xs'));

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
