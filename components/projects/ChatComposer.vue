<template>
  <form class="border-t border-stone-200 bg-white px-3 py-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]" @submit.prevent="submit">
    <ul v-if="chips.length > 0" class="mb-2 flex gap-2" aria-label="Photos to send">
      <li v-for="chip in chips" :key="chip.key" class="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
        <AuthedImage v-if="chip.photoId" :project-id="projectId" :photo-id="chip.photoId" variant="thumb" alt="" />
        <span v-else class="flex h-full w-full items-center justify-center text-stone-500">
          <Loader2 :size="18" class="animate-spin" aria-hidden="true" />
          <span class="sr-only">Uploading</span>
        </span>
        <button type="button"
                class="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-sm leading-none text-stone-700 hover:bg-white"
                :aria-label="chip.photoId ? 'Remove photo from message' : 'Cancel upload'"
                @click="removeChip(chip.key)">
          &times;
        </button>
      </li>
    </ul>
    <p v-if="photoError" class="mb-1 text-sm text-red-700" aria-live="polite">{{ photoError }}</p>
    <div class="flex items-end gap-2">
      <label class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
             :class="{ 'pointer-events-none opacity-50': disabled || chips.length >= MAX_CHAT_PHOTOS }"
             aria-label="Add photo">
        <Camera :size="18" aria-hidden="true" />
        <input type="file" accept="image/*" multiple class="sr-only" :disabled="disabled || chips.length >= MAX_CHAT_PHOTOS" @change="onPick">
      </label>
      <label for="chat-text" class="sr-only">Your message</label>
      <textarea id="chat-text"
                ref="box"
                v-model="text"
                rows="1"
                :maxlength="MAX_CHAT_MESSAGE_CHARS + 200"
                :disabled="disabled"
                placeholder="Ask about this project…"
                enterkeyhint="send"
                class="w-full min-w-0 resize-none overflow-y-auto rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-base sm:text-sm disabled:opacity-60"
                @keydown.enter="onEnter" />
      <div class="flex shrink-0 flex-col items-end gap-1">
        <span v-if="text.length > MAX_CHAT_MESSAGE_CHARS - 200" class="text-xs" :class="overLimit ? 'text-red-700' : 'text-stone-500'">{{ text.length }} / {{ MAX_CHAT_MESSAGE_CHARS }}</span>
        <button type="submit"
                :disabled="!canSend"
                class="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { Camera, Loader2 } from 'lucide-vue-next';
import { CHAT_PHOTO_COUNT_MESSAGE, CHAT_PHOTO_FAILED_MESSAGE, CHAT_PHOTOS_FULL_MESSAGE, MAX_CHAT_MESSAGE_CHARS, MAX_CHAT_PHOTOS } from '@/types/chat';
import { useProjects } from '@/composables/useProjects';
import { hasApiStatus } from '@/utils/api-error';
import { resizePhoto } from '@/utils/image-resize';
import AuthedImage from '@/components/projects/AuthedImage.vue';

const props = defineProps<{
  // the project the photos are uploaded into
  projectId: string;
  // a reply is in flight or the thread cannot take a message now
  disabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', text: string, photoIds: string[]): void;
}>();

interface Chip {
  key: number;
  // set once the upload is done; the photo is then part of the project
  photoId: string | null;
}

const { uploadPhoto } = useProjects();
const text = ref('');
const chips = ref<Chip[]>([]);
const photoError = ref<string | null>(null);
let nextKey = 0;
// Every upload belongs to the chips row it started in; clearing the row makes the number jump, so a late upload cannot attach to the next message.
let generation = 0;
const box = ref<HTMLTextAreaElement | null>(null);
// On a phone the Enter key adds a line and Send is the button; with a mouse and keyboard Enter sends and Shift+Enter adds a line.
const touch = ref(false);

const overLimit = computed(() => text.value.trim().length > MAX_CHAT_MESSAGE_CHARS);
const uploading = computed(() => chips.value.some((chip) => chip.photoId === null));
const photoIds = computed(() => chips.value.flatMap((chip) => (chip.photoId ? [chip.photoId] : [])));
const canSend = computed(() => !props.disabled && !uploading.value && !overLimit.value && (text.value.trim().length > 0 || photoIds.value.length > 0));
const MAX_VISIBLE_LINES = 5;
const FALLBACK_LINE_HEIGHT_PX = 24;

// Grow with the text, wrapped lines included, up to five lines; after that the box scrolls.
const resize = (): void => {
  const el = box.value;
  if (!el) return;
  const style = getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight);
  // The box is border-box: scrollHeight covers the padding but not the border, so add the border back, and let the cap cover five lines of text plus the padding.
  const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const border = el.offsetHeight - el.clientHeight;
  const cap = MAX_VISIBLE_LINES * (Number.isFinite(lineHeight) ? lineHeight : FALLBACK_LINE_HEIGHT_PX) + padding + border;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + border, cap)}px`;
};

const submit = (): void => {
  if (!canSend.value) return;
  emit('send', text.value.trim(), photoIds.value);
};

const onPick = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  photoError.value = null;
  const room = MAX_CHAT_PHOTOS - chips.value.length;
  if (files.length > room) photoError.value = CHAT_PHOTO_COUNT_MESSAGE;
  const started = generation;
  // Every accepted photo gets its chip at once, so the cap counts photos still uploading and the row shows what is coming.
  const picked = files.slice(0, Math.max(0, room)).map((file) => ({ file, chip: { key: nextKey++, photoId: null } as Chip }));
  chips.value = [...chips.value, ...picked.map((entry) => entry.chip)];
  const present = (key: number): boolean => generation === started && chips.value.some((c) => c.key === key);
  // One at a time, as the project page does: order is kept and phone uploads are more reliable in sequence.
  for (const { file, chip } of picked) {
    // Removed with the x before its turn: nothing to upload.
    if (!present(chip.key)) continue;
    try {
      const resized = await resizePhoto(file);
      const photo = await uploadPhoto(props.projectId, resized);
      if (generation !== started) return;
      chips.value = chips.value.map((c) => (c.key === chip.key ? { ...c, photoId: photo.id } : c));
    } catch (e) {
      if (generation !== started) return;
      // A failure for a chip the person already removed is not worth a message.
      if (!present(chip.key)) continue;
      chips.value = chips.value.filter((c) => c.key !== chip.key);
      photoError.value = hasApiStatus(e, 409) ? CHAT_PHOTOS_FULL_MESSAGE : CHAT_PHOTO_FAILED_MESSAGE;
    }
  }
};

// Removes the photo from the message only; an uploaded photo stays in the project.
const removeChip = (key: number): void => {
  chips.value = chips.value.filter((chip) => chip.key !== key);
};

// The page clears the box as soon as the message is in the thread, and puts the text back if the send never reached the server.
const clear = async (): Promise<void> => {
  text.value = '';
  chips.value = [];
  photoError.value = null;
  generation++;
  // Wait for the box to be enabled again before focusing it.
  await nextTick();
  resize();
  box.value?.focus();
};

const restore = async (value: string, ids: string[]): Promise<void> => {
  text.value = value;
  chips.value = ids.map((photoId) => ({ key: nextKey++, photoId }));
  await nextTick();
  resize();
  box.value?.focus();
};

// The box is disabled while a reply is on its way, which drops focus, so the page asks for it back once the box is enabled again.
const focus = async (): Promise<void> => {
  await nextTick();
  box.value?.focus();
};

const onEnter = (event: KeyboardEvent): void => {
  if (touch.value || event.shiftKey) return;
  event.preventDefault();
  submit();
};

watch(text, async () => {
  await nextTick();
  resize();
});

onMounted(() => {
  resize();
  touch.value = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
});

defineExpose({ clear, restore, focus });
</script>
