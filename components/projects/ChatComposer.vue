<template>
  <form class="flex items-end gap-2 border-t border-stone-200 bg-white px-3 py-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]" @submit.prevent="submit">
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
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { MAX_CHAT_MESSAGE_CHARS } from '@/types/chat';

const props = defineProps<{
  // a reply is in flight or the thread cannot take a message now
  disabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', text: string): void;
}>();

const text = ref('');
const box = ref<HTMLTextAreaElement | null>(null);
// On a phone the Enter key adds a line and Send is the button; with a mouse and keyboard Enter sends and Shift+Enter adds a line.
const touch = ref(false);

const overLimit = computed(() => text.value.trim().length > MAX_CHAT_MESSAGE_CHARS);
const canSend = computed(() => !props.disabled && text.value.trim().length > 0 && !overLimit.value);
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
  emit('send', text.value.trim());
};

// The page clears the box as soon as the message is in the thread, and puts the text back if the send never reached the server.
const clear = async (): Promise<void> => {
  text.value = '';
  // Wait for the box to be enabled again before focusing it.
  await nextTick();
  resize();
  box.value?.focus();
};

const restore = async (value: string): Promise<void> => {
  text.value = value;
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
