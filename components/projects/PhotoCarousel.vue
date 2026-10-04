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
        :active="nearViewport && Math.abs(index - currentIndex) <= 1"
        :class="contain ? 'max-h-[90vh] max-w-full' : undefined"
        @click="onPhotoClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { type PhotoVariant } from '@/types/project';
import AuthedImage from '@/components/projects/AuthedImage.vue';

// The swipeable strip used both for a list card's thumbnails and the full-size viewer. Horizontal
// scroll + CSS scroll snap does the swiping; this component tracks which slide is in view, decides
// which AuthedImages are allowed to fetch (see `active` below), and exposes next()/prev() for the
// viewer's buttons and keys.
const props = withDefaults(defineProps<{
  projectId: string;
  // Optional, defaulting to empty: a list response from an older server build (mid-deploy) may not
  // include this field yet, and an empty carousel should just show nothing rather than throw.
  photoIds?: string[];
  variant?: PhotoVariant;
  // Full-size viewer mode: shows the whole photo (object-contain) instead of cropping it, and treats
  // a tap on the photo itself as "just viewing" rather than a tap on the dark area around it.
  contain?: boolean;
  startIndex?: number;
  alt?: string;
}>(), { photoIds: () => [], variant: 'thumb', contain: false, startIndex: 0, alt: '' });

const emit = defineEmits<{ 'update:current-index': [index: number] }>();

const scrollerEl = ref<HTMLElement | null>(null);

const clampIndex = (index: number): number => {
  if (props.photoIds.length === 0) return 0;
  return Math.min(Math.max(index, 0), props.photoIds.length - 1);
};

// Reactive: each slide's `active` binding below depends on it, so it must trigger a re-render as
// the carousel scrolls (a plain variable would not).
const currentIndex = ref(clampIndex(props.startIndex));

// Whether this carousel is itself near the page viewport at all. Gates every slide below, so a
// card far down a long list fetches nothing until scrolled near — independent of AuthedImage's own
// `active` prop, which only ever looks at slide position, not the carousel's place on the page.
// Defaults to true when IntersectionObserver isn't available, so photos still load (just eagerly,
// the same as if this carousel didn't lazy-load at all) rather than never loading.
const nearViewport = ref(typeof IntersectionObserver === 'undefined');
let visibilityObserver: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;

const scrollToIndex = (index: number, smooth: boolean): void => {
  const el = scrollerEl.value;
  if (!el) return;
  el.scrollTo({ left: clampIndex(index) * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
};

const onScroll = (): void => {
  const el = scrollerEl.value;
  if (!el || el.clientWidth === 0) return;
  const index = clampIndex(Math.round(el.scrollLeft / el.clientWidth));
  if (index !== currentIndex.value) {
    currentIndex.value = index;
    emit('update:current-index', index);
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
const next = (): void => scrollToIndex(currentIndex.value + 1, true);
const prev = (): void => scrollToIndex(currentIndex.value - 1, true);

onMounted(async () => {
  // Wait for the container to be laid out (and have a measurable width) before jumping to the
  // starting slide, and jump instead of smooth-scrolling so it never visibly slides from photo 1.
  await nextTick();
  scrollToIndex(currentIndex.value, false);
  emit('update:current-index', currentIndex.value);

  const el = scrollerEl.value;
  if (!el) return;

  if (typeof IntersectionObserver !== 'undefined') {
    // Vertical margin only: this is about the carousel's place on the page, not slide position.
    visibilityObserver = new IntersectionObserver((entries) => {
      nearViewport.value = entries.some((entry) => entry.isIntersecting);
    }, { rootMargin: '200px 0px 200px 0px' });
    visibilityObserver.observe(el);
  }

  if (typeof ResizeObserver !== 'undefined') {
    // scrollLeft is in pixels, so a width change alone (e.g. an orientation change) leaves it
    // pointing at the wrong slide; snap back to the current one without animating.
    resizeObserver = new ResizeObserver(() => scrollToIndex(currentIndex.value, false));
    resizeObserver.observe(el);
  }
});

onBeforeUnmount(() => {
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
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
