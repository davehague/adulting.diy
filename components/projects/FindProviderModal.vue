<template>
  <!-- Full screen on a phone, a centred dialog from sm up. Tapping the dimmed area (this wrapper itself, not the panel inside it) closes it. -->
  <div class="fixed inset-0 z-50 flex items-stretch justify-center bg-stone-500 bg-opacity-75 sm:items-center sm:p-4"
       aria-labelledby="find-provider-title"
       role="dialog"
       aria-modal="true"
       @click.self="requestClose">
    <div class="flex h-full w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-xl">
      <div class="shrink-0 flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <h2 id="find-provider-title" class="text-lg font-medium text-stone-900 font-heading">Find a provider</h2>
        <button type="button"
                aria-label="Close"
                :disabled="linking"
                class="shrink-0 rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
                @click="requestClose">
          <X :size="20" />
        </button>
      </div>

      <p v-if="linkError" class="shrink-0 px-4 pt-3 text-sm text-red-700" aria-live="polite">{{ linkError }}</p>

      <!-- Hidden, not removed, while a provider's details are open, so the filters and results are exactly as they were. -->
      <div v-show="detailId === null" class="flex min-h-0 flex-col">
        <div class="shrink-0 grid grid-cols-2 gap-2 border-b border-stone-200 p-3 sm:grid-cols-3">
          <input v-model="search"
                 type="search"
                 placeholder="Search providers"
                 aria-label="Search providers"
                 class="col-span-2 w-full min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm sm:col-span-3">
          <select v-model="categoryId"
                  aria-label="Category"
                  class="w-full min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
            <option value="">All categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
          <select v-model="statusId"
                  aria-label="Status"
                  class="w-full min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
            <option value="">All statuses</option>
            <option v-for="status in statuses" :key="status.id" :value="status.id">{{ status.name }}</option>
          </select>
          <select v-model="sort"
                  aria-label="Sort"
                  class="col-span-2 w-full min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm sm:col-span-1">
            <option value="mentions">Most mentioned</option>
            <option value="lastSighting">Recently mentioned</option>
            <option value="rating">Highest rated</option>
            <option value="name">Name</option>
          </select>
        </div>

        <!-- The suggestions panel is inside the scrolling area so it scrolls away with the list and never pins the list off a phone screen. -->
        <div ref="listArea" class="min-h-0 overflow-y-auto overscroll-contain">
          <ProviderSuggestions :project-id="projectId"
                               :linked-provider-ids="linkedProviderIds"
                               :linking="linking"
                               @add="addSuggested"
                               @details="openSuggestedDetails"
                               @see-all="seeAll" />
          <div ref="resultsTop"></div>
          <p v-if="loading" class="p-4 text-sm text-stone-600">Loading providers...</p>
          <p v-else-if="loadError" class="p-4 text-sm text-stone-600">
            {{ loadError }}
            <button type="button" class="font-medium text-amber-700 hover:text-amber-800" @click="load">Try again</button>
          </p>
          <p v-else-if="providers.length === 0" class="p-4 text-sm text-stone-600">No providers match these filters.</p>
          <ul v-else class="divide-y divide-stone-100">
            <li v-for="provider in providers" :key="provider.id" class="flex items-start gap-2 px-3 py-2">
              <button type="button"
                      class="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left hover:bg-amber-50"
                      @click="openDetails(provider.id)">
                <span class="block text-sm font-medium text-stone-900 break-words">{{ provider.name }}</span>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        :class="providerStatusBadgeClass(provider.status.kind)">{{ provider.status.name }}</span>
                  <span v-if="neighborLabel(provider.neighborCount)" class="text-xs text-stone-600">{{ neighborLabel(provider.neighborCount) }}</span>
                  <span v-if="provider.rating" class="text-xs text-stone-600">{{ provider.rating }}/5</span>
                </span>
                <span v-if="provider.lastSightingAt" class="mt-0.5 block text-xs text-stone-500">
                  Last mentioned {{ formatDate(provider.lastSightingAt) }}
                </span>
              </button>
              <span v-if="isLinked(provider.id)" class="shrink-0 pt-1 text-xs font-medium text-stone-500">On this project</span>
              <button v-else
                      type="button"
                      :aria-label="`Add ${provider.name} to project`"
                      :disabled="linking"
                      class="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                      @click="addProvider(provider.id)">
                Add
              </button>
            </li>
          </ul>
        </div>
      </div>

      <FindProviderDetails v-if="detailId !== null"
                           :provider-id="detailId"
                           :linked="isLinked(detailId)"
                           :linking="linking"
                           @back="closeDetails"
                           @add="addDetailProvider" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { format } from 'date-fns';
import { X } from 'lucide-vue-next';
import { type ProjectProviderDto } from '@/types/project';
import {
  type ProviderCategoryDto,
  type ProviderListItem,
  type ProviderSort,
  type ProviderStatusDto,
} from '@/types/provider';
import { useProjects } from '@/composables/useProjects';
import { useProviders } from '@/composables/useProviders';
import { hasApiStatus } from '@/utils/api-error';
import { neighborLabel, providerStatusBadgeClass } from '@/utils/project-providers';
import FindProviderDetails from '@/components/projects/FindProviderDetails.vue';
import ProviderSuggestions from '@/components/projects/ProviderSuggestions.vue';

const props = defineProps<{
  projectId: string;
  categories: ProviderCategoryDto[];
  // the project's saved category; null means none chosen yet
  categoryId: string | null;
  linkedProviderIds: string[];
}>();

const emit = defineEmits<{
  // a provider was linked; carries the project's full list. keepOpen is true when the add came from a suggestion.
  (e: 'linked', links: ProjectProviderDto[], keepOpen: boolean): void;
  // the project had no category and one was just picked here, so the parent should save it
  (e: 'save-category', categoryId: string): void;
  // the link was refused because the list on screen is out of date
  (e: 'stale'): void;
  (e: 'close'): void;
}>();

const { linkProvider } = useProjects();
const { listProviders, listStatuses } = useProviders();

const search = ref('');
// Starts on the project's saved category unless it has since been deleted. Changing it here never changes the saved one.
const categoryId = ref<string>(
  props.categoryId && props.categories.some((category) => category.id === props.categoryId) ? props.categoryId : '',
);
const statusId = ref('');
const sort = ref<ProviderSort>('mentions');
const statuses = ref<ProviderStatusDto[]>([]);

const providers = ref<ProviderListItem[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);

const detailId = ref<string | null>(null);
const listArea = ref<HTMLElement | null>(null);
const resultsTop = ref<HTMLElement | null>(null);
// The details view was opened from a suggested row, so adding from it must not close the window.
const detailFromSuggestion = ref(false);
// "See all" changes the filter without that counting as the person choosing the project's category.
let categorySetBySuggestion = false;
let listScrollTop = 0;

const linking = ref(false);
const linkError = ref<string | null>(null);

const linkedSet = computed(() => new Set(props.linkedProviderIds));
const isLinked = (providerId: string): boolean => linkedSet.value.has(providerId);

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

// lastSightingAt is typed Date but arrives over the wire as an ISO string; new Date() takes either.
// Date-only values are stored as UTC midnight; format their UTC calendar day so local timezones don't shift it.
const formatDate = (value: string | Date): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const [y, m, d] = parsed.toISOString().slice(0, 10).split('-').map(Number);
  return format(new Date(y, m - 1, d), 'MMM d, yyyy');
};

// Ignore a slow response that arrives after a newer request was made.
let latestRequestId = 0;

const load = async (): Promise<void> => {
  const requestId = ++latestRequestId;
  loading.value = true;
  loadError.value = null;
  try {
    // Hidden statuses (Lead, out of the box) are included: most of the directory sits there.
    const result = await listProviders({
      search: search.value.trim(),
      categoryId: categoryId.value,
      statusId: statusId.value,
      includeHidden: true,
      sort: sort.value,
    });
    if (requestId !== latestRequestId) return;
    providers.value = result;
  } catch (e) {
    if (requestId !== latestRequestId) return;
    providers.value = [];
    loadError.value = messageOf(e, 'Could not load providers');
  } finally {
    if (requestId === latestRequestId) loading.value = false;
  }
};

let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
});
watch([statusId, sort], () => {
  clearTimeout(searchTimer);
  void load();
});
watch(categoryId, (picked) => {
  clearTimeout(searchTimer);
  void load();
  const fromSuggestion = categorySetBySuggestion;
  categorySetBySuggestion = false;
  // Only a project with no category takes the first one picked here by hand; "See all" never saves one.
  if (picked !== '' && props.categoryId === null && !fromSuggestion) emit('save-category', picked);
});

const openDetails = (providerId: string): void => {
  listScrollTop = listArea.value?.scrollTop ?? 0;
  linkError.value = null;
  detailFromSuggestion.value = false;
  detailId.value = providerId;
};

const openSuggestedDetails = (providerId: string): void => {
  openDetails(providerId);
  detailFromSuggestion.value = true;
};

const closeDetails = async (): Promise<void> => {
  linkError.value = null;
  detailId.value = null;
  await nextTick();
  if (listArea.value) listArea.value.scrollTop = listScrollTop;
};

// Returns true when the provider was linked.
const addProvider = async (providerId: string, keepOpen = false): Promise<boolean> => {
  if (linking.value) return false;
  linking.value = true;
  linkError.value = null;
  try {
    emit('linked', await linkProvider(props.projectId, providerId), keepOpen);
    return true;
  } catch (e) {
    linkError.value = messageOf(e, 'Could not add the provider');
    // 409: someone else linked this provider, or the project is full. Ask the parent to reload.
    if (hasApiStatus(e, 409)) emit('stale');
    return false;
  } finally {
    linking.value = false;
  }
};

const addSuggested = (providerId: string): void => {
  void addProvider(providerId, true);
};

const addDetailProvider = async (): Promise<void> => {
  if (detailId.value === null) return;
  const keepOpen = detailFromSuggestion.value;
  const added = await addProvider(detailId.value, keepOpen);
  // From a suggestion the window stays open, so go back to the results the person came from.
  if (added && keepOpen) await closeDetails();
};

const seeAll = async (id: string): Promise<void> => {
  if (!props.categories.some((category) => category.id === id)) return;
  if (categoryId.value !== id) {
    categorySetBySuggestion = true;
    categoryId.value = id;
  }
  await nextTick();
  resultsTop.value?.scrollIntoView({ block: 'start' });
};

const requestClose = (): void => {
  if (!linking.value) emit('close');
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') requestClose();
};

let previousBodyOverflow = '';

// The parent mounts this only while it is open, so the page lock and the key listener live exactly as long as it does.
onMounted(async () => {
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKeydown);
  void load();
  try {
    statuses.value = await listStatuses();
  } catch {
    // The Status filter keeps just "All statuses"; the list itself still works.
  }
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  latestRequestId++;
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = previousBodyOverflow;
});
</script>
