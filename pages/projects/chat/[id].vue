<template>
  <div class="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col">
    <header class="border-b border-stone-200 bg-white px-3 py-2">
      <NuxtLink :to="`/projects/${id}`" class="text-sm text-amber-700 hover:text-amber-800">&larr; Project</NuxtLink>
      <h1 class="truncate text-base font-medium text-stone-900">{{ title || 'Project chat' }}</h1>
      <p class="text-xs text-stone-500">Shared with your household</p>
    </header>

    <div v-if="loadError" class="m-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{{ loadError }}</p>
      <button type="button" class="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100" @click="load">Try again</button>
    </div>
    <p v-else-if="!loaded" class="m-3 text-sm text-stone-600">Loading…</p>
    <p v-else-if="!enabled" class="m-3 text-sm text-stone-600">Chat is not available for this household.</p>

    <template v-else>
      <ChatThread :messages="messages" :pending="pending" :pending-seconds="pendingSeconds" :retryable="retryable" @retry="retry" />
      <p v-if="error" class="px-3 pb-1 text-sm text-red-700" aria-live="polite">{{ error }}</p>
      <ChatComposer ref="composer" :disabled="pending" @send="send" />
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ hideFooter: true });

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { CHAT_BUSY_MESSAGE, CHAT_PENDING_MS, CHAT_POLL_MS, type ChatMessageDto, type ChatSendInput } from '@/types/chat';
import { useProjects } from '@/composables/useProjects';
import { hasApiStatus } from '@/utils/api-error';
import ChatThread from '@/components/projects/ChatThread.vue';
import ChatComposer from '@/components/projects/ChatComposer.vue';

const route = useRoute();
const id = computed(() => String(route.params.id));

const { getProject, getChat, sendChat } = useProjects();

const title = ref('');
const loaded = ref(false);
const loadError = ref<string | null>(null);
const enabled = ref(false);
const messages = ref<ChatMessageDto[]>([]);
// true while this tab's own request runs, or while the server says a reply is on its way
const sending = ref(false);
const serverPending = ref(false);
const error = ref<string | null>(null);
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
const nowMs = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
let poller: ReturnType<typeof setInterval> | null = null;

const last = computed((): ChatMessageDto | undefined => messages.value[messages.value.length - 1]);
const lastAgeMs = computed((): number => (last.value ? nowMs.value - new Date(last.value.createdAt).getTime() : 0));
// Mirrors the server's rule, so the row and the clock decide, not a flag that could go stale.
const pending = computed((): boolean => sending.value || (serverPending.value && last.value?.role === 'user' && !last.value.failed && lastAgeMs.value < CHAT_PENDING_MS));
const retryable = computed((): boolean => !pending.value && last.value?.role === 'user' && (last.value.failed || lastAgeMs.value >= CHAT_PENDING_MS));
const pendingSeconds = computed((): number => Math.max(0, Math.floor(lastAgeMs.value / 1000)));

const stopPolling = (): void => {
  if (poller) clearInterval(poller);
  poller = null;
};

// While the server says a reply is on its way, ask again every few seconds so the reply appears when it lands, even if another member or another tab asked.
const poll = async (): Promise<void> => {
  if (sending.value) return;
  try {
    const state = await getChat(id.value);
    // A send that started while this poll was in flight owns the list now.
    if (sending.value) return;
    messages.value = state.messages ?? [];
    serverPending.value = state.pending === true;
    if (!serverPending.value) {
      stopPolling();
      if (error.value === CHAT_BUSY_MESSAGE) error.value = null;
    }
  } catch {
    // Keep polling; the next tick may succeed.
  }
};

const startPolling = (): void => {
  if (poller) return;
  // Ask once at once, so the composer does not sit open for a whole interval after a busy reply.
  void poll();
  poller = setInterval(poll, CHAT_POLL_MS);
};

const load = async (): Promise<void> => {
  loadError.value = null;
  try {
    const [project, state] = await Promise.all([getProject(id.value), getChat(id.value)]);
    title.value = project.title;
    enabled.value = state.enabled === true;
    messages.value = state.messages ?? [];
    serverPending.value = state.pending === true;
    loaded.value = true;
    if (serverPending.value) startPolling();
  } catch (e) {
    loadError.value = hasApiStatus(e, 404) ? 'Project not found.' : 'Could not load the chat.';
  }
};

// Rows are matched by id, never by identity: a reactive array hands back proxies, so an object pushed in is not `===` to what is read out.
const without = (rowId: string | null): ChatMessageDto[] => messages.value.filter((message) => message.id !== rowId);
const withFailed = (rowId: string | null, failed: boolean): ChatMessageDto[] =>
  messages.value.map((message) => (message.id === rowId ? { ...message, failed, createdAt: failed ? message.createdAt : new Date().toISOString() } : message));

const ask = async (input: ChatSendInput, optimistic: ChatMessageDto | null): Promise<void> => {
  if (pending.value) return;
  sending.value = true;
  error.value = null;
  stopPolling();
  // The row being answered: the one just added, or on a retry the last row.
  const askedId = optimistic ? optimistic.id : (last.value?.id ?? null);
  if (optimistic) messages.value = [...messages.value, optimistic];
  let sent = false;
  let busy = false;
  try {
    const response = await sendChat(id.value, input);
    messages.value = [...without(askedId).filter((message) => message.id !== response.userMessage.id), response.userMessage, response.assistantMessage];
    serverPending.value = false;
    sent = true;
  } catch (e) {
    if (hasApiStatus(e, 409)) {
      // Someone else's question is being answered; keep the text and follow that reply.
      if (optimistic) messages.value = without(askedId);
      error.value = CHAT_BUSY_MESSAGE;
      serverPending.value = true;
      busy = true;
    } else if (hasApiStatus(e, 403)) {
      enabled.value = false;
    } else if (hasApiStatus(e, 502)) {
      // The question was saved and the server marked it failed too, so Retry shows at once.
      messages.value = withFailed(askedId, true);
    } else {
      if (optimistic) messages.value = without(askedId);
      error.value = e instanceof Error && e.message ? e.message : 'Could not send the message.';
    }
  } finally {
    sending.value = false;
    // Polling starts only now: a poll skips itself while this tab is sending, so the first one would be wasted.
    if (busy) startPolling();
    // After sending is false, so the box is enabled again when it takes focus.
    if (sent) void composer.value?.clear();
  }
};

const send = (text: string): void => {
  const optimistic: ChatMessageDto = { id: `local-${Date.now()}`, role: 'user', content: text, mine: true, failed: false, searches: [], createdAt: new Date().toISOString() };
  void ask({ text }, optimistic);
};

const retry = (): void => {
  if (!retryable.value || !last.value) return;
  // Mirrors the server's refresh of the row, so the thinking row counts from now.
  messages.value = withFailed(last.value.id, false);
  void ask({ retry: true }, null);
};

onMounted(() => {
  ticker = setInterval(() => { nowMs.value = Date.now(); }, 1000);
  void load();
});

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
  stopPolling();
});
</script>
