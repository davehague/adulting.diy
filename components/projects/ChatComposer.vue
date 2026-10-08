<template>
  <form class="flex items-end gap-2 border-t border-stone-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" @submit.prevent="submit">
    <label for="chat-text" class="sr-only">Your message</label>
    <textarea id="chat-text"
              ref="box"
              v-model="text"
              :rows="rows"
              :maxlength="MAX_CHAT_MESSAGE_CHARS + 200"
              :disabled="disabled"
              placeholder="Ask about this project…"
              enterkeyhint="send"
              class="w-full min-w-0 resize-none rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-base sm:text-sm disabled:opacity-60"
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
import { ref, computed, onMounted } from 'vue';
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
const rows = computed(() => Math.min(5, Math.max(1, text.value.split('\n').length)));

const submit = (): void => {
  if (!canSend.value) return;
  emit('send', text.value.trim());
};

// The page clears the box only after the server took the message, so a failed send keeps what was typed.
const clear = (): void => {
  text.value = '';
  box.value?.focus();
};

const onEnter = (event: KeyboardEvent): void => {
  if (touch.value || event.shiftKey) return;
  event.preventDefault();
  submit();
};

onMounted(() => {
  touch.value = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
});

defineExpose({ clear });
</script>
