<template>
  <div
    ref="scrollerEl"
    class="carousel-scroller flex w-full h-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
    @scroll="onScroll"
  >
    <div
      v-for="(photoId, index) in photoIds"
      :key="photoId"
      class="w-full h-full flex-shrink-0 snap-start"
      :class="contain ? 'flex items-center justify-center' : ''"
    >
      <AuthedImage
        :project-id="projectId"
        :photo-id="photoId"
        :variant="variant"
        :alt="alt"
        :contain="contain"
        lazy
        :class="contain ? 'max-h-[90vh] max-w-full' : undefined"
        @click="onPhotoClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { type PhotoVariant } from '@/types/project';
import AuthedImage from '@/components/projects/AuthedImage.vue';

// The swipeable strip used both for a list card's thumbnails and the full-size viewer. Horizontal
// scroll + CSS scroll snap does the swiping; this component only tracks which slide is in view and
// exposes next()/prev() for buttons and keys.
const props = withDefaults(defineProps<{
  projectId: string;
  photoIds: string[];
  variant?: PhotoVariant;
  // Full-size viewer mode: shows the whole photo (object-contain) instead of cropping it, and treats
  // a tap on the photo itself as "just viewing" rather than a tap on the dark area around it.
  contain?: boolean;
  startIndex?: number;
  alt?: string;
}>(), { variant: 'thumb', contain: false, startIndex: 0, alt: '' });

const emit = defineEmits<{ 'update:current-index': [index: number] }>();

const scrollerEl = ref<HTMLElement | null>(null);

const clampIndex = (index: number): number => {
  if (props.photoIds.length === 0) return 0;
  return Math.min(Math.max(index, 0), props.photoIds.length - 1);
};

// Plain variable, not a ref: only read/written from within this script, never bound in the template.
let currentIndex = clampIndex(props.startIndex);

const scrollToIndex = (index: number, smooth: boolean): void => {
  const el = scrollerEl.value;
  if (!el) return;
  el.scrollTo({ left: clampIndex(index) * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
};

const onScroll = (): void => {
  const el = scrollerEl.value;
  if (!el || el.clientWidth === 0) return;
  const index = clampIndex(Math.round(el.scrollLeft / el.clientWidth));
  if (index !== currentIndex) {
    currentIndex = index;
    emit('update:current-index', currentIndex);
  }
};

// In contain (viewer) mode a tap on the photo itself must not close the viewer; a tap on the dark
// area around it (any other part of the carousel) should still bubble up and close it. In thumb
// (card) mode the click must bubble so the enclosing NuxtLink navigates, so this is a no-op there.
const onPhotoClick = (event: MouseEvent): void => {
  if (props.contain) event.stopPropagation();
};

// Exposed for the viewer's buttons and arrow keys. Clamped at the ends, so pressing past the last
// photo (or before the first) is a harmless no-op rather than wrapping or erroring.
const next = (): void => scrollToIndex(currentIndex + 1, true);
const prev = (): void => scrollToIndex(currentIndex - 1, true);

onMounted(async () => {
  // Wait for the container to be laid out (and have a measurable width) before jumping to the
  // starting slide, and jump instead of smooth-scrolling so it never visibly slides from photo 1.
  await nextTick();
  scrollToIndex(currentIndex, false);
  emit('update:current-index', currentIndex);
});

defineExpose({ next, prev });
</script>

<style scoped>
.carousel-scroller {
  scrollbar-width: none; /* Firefox */
}

.carousel-scroller::-webkit-scrollbar {
  display: none; /* Safari / Chrome */
}
</style>
