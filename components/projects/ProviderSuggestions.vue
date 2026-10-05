<template>
  <!-- Rendered only for a household that has suggestions turned on; everyone else sees the window as it was. -->
  <section v-if="enabled" class="border-b border-stone-200 bg-amber-50/50 px-3 py-3" aria-label="Suggested providers">
    <p v-if="error" class="mb-2 text-sm text-red-700" aria-live="polite">{{ error }}</p>

    <div class="flex flex-col gap-2 sm:flex-row">
      <input v-model="extraText"
             type="text"
             :maxlength="MAX_EXTRA_TEXT_LENGTH"
             :disabled="running"
             placeholder="Anything to add? (optional)"
             enterkeyhint="go"
             aria-label="Anything to add?"
             class="w-full min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm disabled:opacity-60"
             @keydown.enter.prevent="run">
      <button type="button"
              :disabled="running || limitReached"
              class="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              @click="run">
        {{ buttonLabel }}
      </button>
    </div>

    <p v-if="running" class="mt-2 text-sm text-stone-600" aria-live="polite">{{ waitingLine }}</p>
    <p v-else-if="suggestion" class="mt-1 text-xs text-stone-500">Suggested {{ formatDay(suggestion.createdAt) }}</p>

    <div v-if="fallback" class="mt-3">
      <h3 class="text-sm font-medium text-stone-900">Top providers by your ratings and neighbor recommendations</h3>
      <ul v-if="fallback.providers.length > 0" class="mt-1 divide-y divide-stone-100">
        <li v-for="provider in fallback.providers" :key="provider.id" class="flex items-start gap-2 py-2">
          <button type="button" class="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left hover:bg-amber-100" @click="emit('details', provider.id)">
            <span class="block text-sm font-medium text-stone-900 break-words">{{ provider.name }}</span>
            <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="providerStatusBadgeClass(provider.status.kind)">{{ provider.status.name }}</span>
              <span v-if="neighborLabel(provider.neighborCount)" class="text-xs text-stone-600">{{ neighborLabel(provider.neighborCount) }}</span>
              <span v-if="provider.rating" class="text-xs text-stone-600">{{ provider.rating }}/5</span>
            </span>
          </button>
          <span v-if="isLinked(provider.id)" class="shrink-0 pt-1 text-xs font-medium text-stone-500">On this project</span>
          <button v-else
                  type="button"
                  :aria-label="`Add ${provider.name} to project`"
                  :disabled="linking"
                  class="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                  @click="emit('add', provider.id)">
            Add
          </button>
        </li>
      </ul>
      <p class="mt-1 text-sm">
        <a :href="fallback.searchUrl" target="_blank" rel="noopener noreferrer" class="font-medium text-amber-700 hover:text-amber-800">Search Google</a>
      </p>
    </div>

    <template v-if="suggestion && !running">
      <p v-if="suggestion.tooVague" class="mt-2 text-sm text-stone-700">
        Not enough to go on. Add a sentence about what's wrong or what you want done.
      </p>
      <ol v-else class="mt-3 space-y-4">
        <li v-for="(part, index) in suggestion.parts" :key="index">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="min-w-0 text-sm font-medium text-stone-900 break-words">{{ index + 1 }}. {{ part.name }}</h3>
            <span v-if="part.category" class="shrink-0 text-xs text-stone-500">{{ part.category.name }}</span>
          </div>
          <p class="mt-0.5 text-sm text-stone-600">{{ part.why }}</p>

          <ul v-if="part.picks.length > 0" class="mt-1 divide-y divide-stone-100">
            <li v-for="pick in part.picks" :key="pick.provider.id" class="flex items-start gap-2 py-2">
              <button type="button" class="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left hover:bg-amber-100" @click="emit('details', pick.provider.id)">
                <span class="block text-sm font-medium text-stone-900 break-words">{{ pick.provider.name }}</span>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="providerStatusBadgeClass(pick.provider.status.kind)">{{ pick.provider.status.name }}</span>
                  <span v-if="neighborLabel(pick.provider.neighborCount)" class="text-xs text-stone-600">{{ neighborLabel(pick.provider.neighborCount) }}</span>
                  <span v-if="pick.provider.rating" class="text-xs text-stone-600">{{ pick.provider.rating }}/5</span>
                </span>
                <span class="mt-1 block text-sm text-stone-700">{{ pick.reason }}</span>
              </button>
              <span v-if="isLinked(pick.provider.id)" class="shrink-0 pt-1 text-xs font-medium text-stone-500">On this project</span>
              <button v-else
                      type="button"
                      :aria-label="`Add ${pick.provider.name} to project`"
                      :disabled="linking"
                      class="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                      @click="emit('add', pick.provider.id)">
                Add
              </button>
            </li>
          </ul>
          <p v-else class="mt-1 text-sm text-stone-500">{{ emptyNote(part) }}</p>

          <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button v-if="part.category"
                    type="button"
                    class="font-medium text-amber-700 hover:text-amber-800"
                    @click="emit('see-all', part.category.id)">
              See all in {{ part.category.name }}
            </button>
            <a :href="part.searchUrl" target="_blank" rel="noopener noreferrer" class="font-medium text-amber-700 hover:text-amber-800">Search Google</a>
          </p>
        </li>
      </ol>
    </template>
  </section>
</template>

<script lang="ts">
import { type SuggestionRunResponse } from '@/types/suggestion';

interface InFlightAsk {
  promise: Promise<SuggestionRunResponse>;
  extraText: string;
}

// Asks still waiting for the server, by project id. It lives here, outside any one mount, so closing the window during the wait and opening it again picks the same ask up instead of offering a second one. It is per browser tab and is lost on a page reload.
const inFlight = new Map<string, InFlightAsk>();
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { format } from 'date-fns';
import {
  MAX_EXTRA_TEXT_LENGTH,
  type ProjectSuggestionDto,
  type SuggestionFallbackDto,
  type SuggestionPartDto,
} from '@/types/suggestion';
import { useProjects } from '@/composables/useProjects';
import { hasApiStatus } from '@/utils/api-error';
import { neighborLabel, providerStatusBadgeClass } from '@/utils/project-providers';

const props = defineProps<{
  projectId: string;
  linkedProviderIds: string[];
  // a link request is in flight in the window
  linking: boolean;
}>();

const emit = defineEmits<{
  (e: 'add', providerId: string): void;
  (e: 'details', providerId: string): void;
  (e: 'see-all', categoryId: string): void;
  // the first read of the saved state has finished, whether or not it worked
  (e: 'ready'): void;
}>();

const { getSuggestions, runSuggestions } = useProjects();

// Off until the server says this household has suggestions; a failed check leaves the panel hidden.
const enabled = ref(false);
const limitReached = ref(false);
const suggestion = ref<ProjectSuggestionDto | null>(null);
const fallback = ref<SuggestionFallbackDto | null>(null);
const extraText = ref('');
const running = ref(false);
const failed = ref(false);
const error = ref<string | null>(null);
const waitingLine = ref('');

const linkedSet = computed(() => new Set(props.linkedProviderIds));
const isLinked = (providerId: string): boolean => linkedSet.value.has(providerId);

const buttonLabel = computed((): string => {
  if (limitReached.value) return 'Daily limit reached. Try again later.';
  if (failed.value) return 'Try again';
  return suggestion.value ? 'Suggest again' : 'Suggest providers';
});

const emptyNote = (part: SuggestionPartDto): string => {
  if (!part.category) return 'No matching category in your directory';
  return part.poolSize === 0 ? 'No one to suggest' : 'No one stood out';
};

const formatDay = (value: string | Date): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'MMM d');
};

// The server does not report progress; the second line is shown on a timer, about when the first call usually ends.
let waitingTimer: ReturnType<typeof setTimeout> | undefined;
const startWaiting = (): void => {
  waitingLine.value = 'Working out which trades this needs...';
  waitingTimer = setTimeout(() => {
    waitingLine.value = 'Choosing providers...';
  }, 4000);
};
const stopWaiting = (): void => {
  clearTimeout(waitingTimer);
  waitingLine.value = '';
};

// Shows the outcome of an ask. It never rejects, so every caller can await it.
const follow = async (promise: Promise<SuggestionRunResponse>): Promise<void> => {
  try {
    const response = await promise;
    limitReached.value = response.limitReached === true;
    // On a failure this is the previous result, so what was on screen stays there under the error.
    suggestion.value = response.suggestion ?? null;
    if (response.status === 'failed') {
      failed.value = true;
      error.value = 'Could not get suggestions.';
      fallback.value = response.fallback ?? null;
    }
  } catch (e) {
    if (hasApiStatus(e, 429)) {
      limitReached.value = true;
    } else if (hasApiStatus(e, 403)) {
      enabled.value = false;
    } else {
      failed.value = true;
      error.value = 'Could not get suggestions.';
    }
  } finally {
    running.value = false;
    stopWaiting();
  }
};

const run = async (): Promise<void> => {
  if (running.value || limitReached.value) return;
  running.value = true;
  failed.value = false;
  error.value = null;
  fallback.value = null;
  startWaiting();

  const projectId = props.projectId;
  const text = extraText.value.trim();
  // Wrapped so that even a synchronous throw becomes a rejection that follow() handles.
  const promise = (async () => runSuggestions(projectId, text))();
  const entry: InFlightAsk = { promise, extraText: text };
  inFlight.set(projectId, entry);
  // Removed when the ask settles, whether it worked or not and whether or not this panel is still on screen. A newer ask for the same project is left alone.
  const release = (): void => {
    if (inFlight.get(projectId) === entry) inFlight.delete(projectId);
  };
  promise.then(release, release);

  await follow(promise);
};

onMounted(async () => {
  const pending = inFlight.get(props.projectId);
  if (pending) {
    // The window was closed during an ask and opened again before the answer came: pick that ask up, and do not read the saved state, which is still the old one.
    enabled.value = true;
    extraText.value = pending.extraText;
    running.value = true;
    startWaiting();
    emit('ready');
    await follow(pending.promise);
    return;
  }
  try {
    const state = await getSuggestions(props.projectId);
    enabled.value = state.enabled === true;
    limitReached.value = state.limitReached === true;
    suggestion.value = state.suggestion ?? null;
    extraText.value = state.suggestion?.extraText ?? '';
  } catch {
    // The window works without suggestions; say nothing.
  } finally {
    // The list below waits for this, so the panel cannot appear above a list that is already on screen.
    emit('ready');
  }
});

onBeforeUnmount(() => clearTimeout(waitingTimer));
</script>
