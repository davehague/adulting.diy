<template>
  <div ref="list" class="flex-1 overflow-y-auto px-3 py-4 space-y-3" aria-label="Messages">
    <p v-if="messages.length === 0 && !pending" class="text-sm text-stone-600">
      Ask anything about this project. I know its notes, steps, plan and providers, and I can look things up.
    </p>

    <template v-for="(message, index) in messages" :key="message.id">
      <div v-if="message.role === 'user'" class="flex flex-col items-end">
        <span v-if="!message.mine" class="mb-0.5 text-xs text-stone-500">Household member</span>
        <p class="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-amber-50 px-3 py-2 text-sm text-stone-900">{{ message.content }}</p>
        <div v-if="index === messages.length - 1 && retryable" class="mt-1 flex items-center gap-2 text-sm text-stone-600" aria-live="polite">
          <span>Couldn't get a reply.</span>
          <button type="button"
                  :disabled="pending"
                  class="rounded-lg border border-amber-600 px-2.5 py-0.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  @click="emit('retry')">
            Retry
          </button>
        </div>
      </div>
      <div v-else class="flex flex-col items-start">
        <!-- Rendered by utils/chat-markdown.ts, which escapes everything before it links or bolds. -->
        <div class="chat-reply max-w-[85%] break-words rounded-2xl rounded-bl-sm border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" v-html="renderChatMarkdown(message.content)" />
        <p v-if="message.searches.length > 0" class="mt-0.5 max-w-[85%] break-words text-xs text-stone-500">Searched: {{ message.searches.join(' · ') }}</p>
      </div>
    </template>

    <p v-if="pending" class="text-sm text-stone-600" aria-live="polite">Thinking… {{ pendingSeconds }} s</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { type ChatMessageDto } from '@/types/chat';
import { renderChatMarkdown } from '@/utils/chat-markdown';

const props = defineProps<{
  messages: ChatMessageDto[];
  // a reply is on its way for the last message
  pending: boolean;
  pendingSeconds: number;
  // the last message is a question with no reply and no request running
  retryable: boolean;
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
}>();

const list = ref<HTMLDivElement | null>(null);

const scrollToBottom = async (): Promise<void> => {
  await nextTick();
  if (list.value) list.value.scrollTop = list.value.scrollHeight;
};

watch(() => [props.messages.length, props.pending], scrollToBottom, { immediate: true });
</script>

<style scoped>
.chat-reply :deep(p + p),
.chat-reply :deep(ol),
.chat-reply :deep(ul) {
  margin-top: 0.5rem;
}
.chat-reply :deep(ol) {
  list-style: decimal;
  padding-left: 1.25rem;
}
.chat-reply :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
}
.chat-reply :deep(li + li) {
  margin-top: 0.25rem;
}
.chat-reply :deep(code) {
  font-size: 0.8125rem;
  background: #f5f5f4;
  padding: 0 0.25rem;
  border-radius: 0.25rem;
}
.chat-reply :deep(a) {
  color: #b45309;
  text-decoration: underline;
  overflow-wrap: anywhere;
}
</style>
