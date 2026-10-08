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
import { CHAT_BUSY_MESSAGE, CHAT_PENDING_MS, CHAT_POLL_MS, type ChatMessageDto, type ChatSendInput, type ChatStateResponse } from '@/types/chat';
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
// Counts the sends. A read that began before a send and lands after it is older than the send's own answer, so it is dropped.
let sequence = 0;
// Set when the page is left, so nothing started earlier touches the screen afterwards or starts polling again.
let gone = false;

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
  if (gone || sending.value) return;
  const seen = sequence;
  try {
    const state = await getChat(id.value);
    // A send that started while this poll was in flight owns the list now, and one that finished meanwhile has already shown its answer.
    if (gone || sequence !== seen || sending.value) return;
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
  if (gone || poller) return;
  // Ask once at once, so the composer does not sit open for a whole interval after a busy reply.
  void poll();
  poller = setInterval(poll, CHAT_POLL_MS);
};

const load = async (): Promise<void> => {
  loadError.value = null;
  try {
    const [project, state] = await Promise.all([getProject(id.value), getChat(id.value)]);
    if (gone) return;
    title.value = project.title;
    enabled.value = state.enabled === true;
    messages.value = state.messages ?? [];
    serverPending.value = state.pending === true;
    loaded.value = true;
    if (serverPending.value) startPolling();
  } catch (e) {
    if (gone) return;
    loadError.value = hasApiStatus(e, 404) ? 'Project not found.' : 'Could not load the chat.';
  }
};

// Rows are matched by id, never by identity: a reactive array hands back proxies, so an object pushed in is not `===` to what is read out.
const without = (rowId: string | null): ChatMessageDto[] => messages.value.filter((message) => message.id !== rowId);
const withFailed = (rowId: string | null, failed: boolean): ChatMessageDto[] =>
  messages.value.map((message) => (message.id === rowId ? { ...message, failed, createdAt: failed ? message.createdAt : new Date().toISOString() } : message));

// After a failure that carries no status (a dropped connection, a timeout, a 500), the server may still have taken the question. Read the thread once and say whether it did: a new row with the text that was sent, or on a retry a thread that grew or a reply on its way. Null when the read fails or this send is no longer the current one.
const tookQuestion = async (input: ChatSendInput, knownIds: Set<string>, rowsBefore: number, mine: number): Promise<ChatStateResponse | null> => {
  try {
    const state = await getChat(id.value);
    if (gone || sequence !== mine) return null;
    const rows = state.messages ?? [];
    const newest = [...rows].reverse().find((message) => message.role === 'user');
    const sameText = 'text' in input && newest !== undefined && !knownIds.has(newest.id) && newest.content === input.text;
    // Only a retry can tell by the row count: on a plain send, rows another member added would look the same.
    const grew = 'retry' in input && rows.length > rowsBefore;
    const retryTaken = 'retry' in input && state.pending === true;
    return sameText || grew || retryTaken ? state : null;
  } catch {
    return null;
  }
};

const ask = async (input: ChatSendInput, optimistic: ChatMessageDto | null): Promise<void> => {
  if (pending.value) return;
  const mine = ++sequence;
  sending.value = true;
  error.value = null;
  stopPolling();
  // The row being answered: the one just added, or on a retry the last row.
  const askedId = optimistic ? optimistic.id : (last.value?.id ?? null);
  // What this tab had before the send, so a thread read after a failure can be told apart from it.
  const knownIds = new Set(messages.value.map((message) => message.id));
  const rowsBefore = messages.value.length;
  if (optimistic) messages.value = [...messages.value, optimistic];
  let sent = false;
  let follow = false;
  try {
    const response = await sendChat(id.value, input);
    if (gone || sequence !== mine) return;
    messages.value = [...without(askedId).filter((message) => message.id !== response.userMessage.id), response.userMessage, response.assistantMessage];
    serverPending.value = false;
    sent = true;
  } catch (e) {
    if (gone || sequence !== mine) return;
    if (hasApiStatus(e, 409)) {
      // Someone else's question is being answered; keep the text and follow that reply.
      if (optimistic) messages.value = without(askedId);
      error.value = CHAT_BUSY_MESSAGE;
      serverPending.value = true;
      follow = true;
    } else if (hasApiStatus(e, 403)) {
      enabled.value = false;
    } else if (hasApiStatus(e, 502)) {
      // The question was saved and the server marked it failed too, so Retry shows at once. On a plain send the box is cleared, as the question is in the thread; a retry leaves any separate draft alone.
      messages.value = withFailed(askedId, true);
      if (optimistic) sent = true;
    } else {
      const state = await tookQuestion(input, knownIds, rowsBefore, mine);
      if (gone || sequence !== mine) return;
      if (state) {
        // The connection failed but the server has the question: show its thread, follow the reply if it is still coming, and clear the box as for a send that worked.
        messages.value = state.messages ?? [];
        serverPending.value = state.pending === true;
        follow = serverPending.value;
        sent = true;
      } else {
        if (optimistic) messages.value = without(askedId);
        error.value = e instanceof Error && e.message ? e.message : 'Could not send the message.';
      }
    }
  } finally {
    if (!gone) {
      sending.value = false;
      // Polling starts only now: a poll skips itself while this tab is sending, so the first one would be wasted.
      if (follow) startPolling();
      // After sending is false, so the box is enabled again when it takes focus.
      if (sent) void composer.value?.clear();
    }
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
  gone = true;
  if (ticker) clearInterval(ticker);
  stopPolling();
});
</script>
