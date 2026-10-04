<template>
  <img v-if="src" ref="rootEl" :src="src" :alt="alt" :class="imgClass">
  <div v-else ref="rootEl" :class="fallbackClass">
    {{ failed ? 'Photo unavailable' : '' }}
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { type PhotoVariant } from '@/types/project';
import { useProjects } from '@/composables/useProjects';

// Within this margin of the viewport a lazy image is considered "near" and starts fetching, so the
// slide either side of the one in view is ready by the time a swipe reaches it. Horizontal-only
// (0 top/bottom) so a card further down a long list is not fetched just because it exists.
const LAZY_ROOT_MARGIN = '0px 150px 0px 150px';

const props = withDefaults(defineProps<{
  projectId: string;
  photoId: string;
  variant?: PhotoVariant;
  alt?: string;
  // Shows the whole photo scaled to fit its box instead of cropping to fill it (the full-size viewer).
  contain?: boolean;
  // Defers the fetch until this image is in or near the viewport (see LAZY_ROOT_MARGIN), for a
  // carousel that may hold several photos at once. Falls back to loading immediately if
  // IntersectionObserver isn't available. Default false keeps every existing caller unchanged.
  lazy?: boolean;
}>(), { variant: 'thumb', alt: '', contain: false, lazy: false });

// In "contain" mode the box has no fixed height (the viewer sizes to the photo), so the image
// must not be forced to w-full/h-full: it keeps its intrinsic size, capped by classes the caller passes in.
const imgClass = computed(() => (props.contain ? 'object-contain' : 'w-full h-full object-cover'));
const fallbackClass = computed(() => (props.contain
  ? 'flex items-center justify-center bg-stone-100 text-stone-400 text-xs rounded-lg p-12'
  : 'w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 text-xs'));

const { fetchPhotoBlob } = useProjects();

const src = ref<string | null>(null);
const failed = ref(false);
const rootEl = ref<HTMLElement | null>(null);
// Non-lazy images are ready to load the moment they're created, same as before this prop existed.
const shouldLoad = ref(!props.lazy);
let latestRequest = 0;
let observer: IntersectionObserver | null = null;

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

watch(() => [props.projectId, props.photoId, props.variant, shouldLoad.value], () => {
  if (shouldLoad.value) load();
}, { immediate: true });

onMounted(() => {
  if (!props.lazy) return;
  if (typeof IntersectionObserver === 'undefined') {
    // No observer support: fall back to loading immediately rather than never loading at all.
    shouldLoad.value = true;
    return;
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      shouldLoad.value = true;
      observer?.disconnect();
      observer = null;
    }
  }, { rootMargin: LAZY_ROOT_MARGIN });
  if (rootEl.value) observer.observe(rootEl.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  latestRequest++;
  release();
});
</script>
