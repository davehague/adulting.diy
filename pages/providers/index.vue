<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-wrap justify-between items-center gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-stone-900 font-heading">Providers</h1>
        <p class="text-stone-600 mt-1">Contractors and service providers your neighbors recommend</p>
      </div>
      <NuxtLink to="/providers/new"
                class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
        <Plus :size="16" />Add provider
      </NuxtLink>
    </div>

    <!-- Toolbar -->
    <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 mb-6 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input v-model="search"
               type="search"
               placeholder="Search providers"
               aria-label="Search providers"
               class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
        <select v-model="categoryId"
                aria-label="Category"
                class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
          <option value="">All categories</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <select v-model="statusId"
                aria-label="Status"
                class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
          <option value="">All statuses</option>
          <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-model="sort"
                aria-label="Sort"
                class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
          <option value="mentions">Most mentioned</option>
          <option value="lastSighting">Recently mentioned</option>
          <option value="rating">Highest rated</option>
          <option value="name">Name</option>
        </select>
      </div>
      <label class="inline-flex items-center gap-2 text-sm text-stone-700">
        <input v-model="includeHidden" type="checkbox" class="rounded border-stone-300 text-amber-600 focus:ring-amber-500">
        Show hidden statuses (e.g. Leads)
      </label>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <ExclamationTriangleIcon class="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error</h3>
          <div class="mt-2 text-sm text-red-700">{{ error }}</div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading && providers.length === 0" class="text-center py-8">
      <p class="text-stone-600">Loading providers...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="providers.length === 0"
         class="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
      <p v-if="hasActiveFilter" class="text-stone-600">No providers match your filters.</p>
      <p v-else class="text-stone-600">No providers yet. Add one, or point the watcher at your ingest API.</p>
    </div>

    <!-- List -->
    <ul v-else class="space-y-3">
      <li v-for="p in providers" :key="p.id"
          class="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <NuxtLink :to="`/providers/${p.id}`"
                      class="text-lg font-semibold text-stone-900 hover:text-amber-700 font-heading break-words">
              {{ p.name }}
            </NuxtLink>
            <p v-if="p.company" class="text-sm text-stone-600 break-words">{{ p.company }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
              {{ p.category.name }}
            </span>
            <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusClass(p.status.kind)]">
              {{ p.status.name }}
            </span>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-600">
          <a v-if="p.phone" :href="`tel:${p.phone}`" class="text-amber-700 hover:text-amber-800">{{ p.phone }}</a>
          <span v-if="p.rating" :aria-label="`Rating ${p.rating} out of 5`" class="text-amber-600">
            {{ '★'.repeat(p.rating) }}<span class="text-stone-300">{{ '★'.repeat(Math.max(0, 5 - p.rating)) }}</span>
          </span>
          <span v-if="p.neighborCount > 0"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            Recommended by {{ p.neighborCount }} neighbor{{ p.neighborCount !== 1 ? 's' : '' }}
          </span>
          <span v-if="p.mentionCount > 0" class="text-stone-500">
            {{ p.mentionCount }} mention{{ p.mentionCount !== 1 ? 's' : '' }}
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Plus } from 'lucide-vue-next';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import {
  type ProviderCategoryDto,
  type ProviderListItem,
  type ProviderSort,
  type ProviderStatusDto,
  type ProviderStatusKind,
} from '@/types/provider';
import { useProviders } from '@/composables/useProviders';

const { listProviders, listCategories, listStatuses } = useProviders();

const providers = ref<ProviderListItem[]>([]);
const categories = ref<ProviderCategoryDto[]>([]);
const statuses = ref<ProviderStatusDto[]>([]);
const loading = ref(true);
const providerError = ref<string | null>(null);
const filterError = ref<string | null>(null);
const error = computed(() => filterError.value ?? providerError.value);
const hasActiveFilter = computed(() => !!(search.value.trim() || categoryId.value || statusId.value || includeHidden.value));

const search = ref('');
const categoryId = ref('');
const statusId = ref('');
const sort = ref<ProviderSort>('mentions');
const includeHidden = ref(false);

const statusClass = (kind: ProviderStatusKind): string => {
  if (kind === 'positive') return 'bg-green-100 text-green-800';
  if (kind === 'negative') return 'bg-red-50 text-red-700';
  return 'bg-stone-100 text-stone-700';
};

let latestRequestId = 0;

const loadProviders = async (): Promise<void> => {
  const requestId = ++latestRequestId;
  loading.value = true;
  try {
    const result = await listProviders({
      search: search.value.trim(),
      categoryId: categoryId.value,
      statusId: statusId.value,
      sort: sort.value,
      includeHidden: includeHidden.value,
    });
    if (requestId !== latestRequestId) return;
    providers.value = result;
    providerError.value = null;
  } catch (e) {
    if (requestId !== latestRequestId) return;
    providerError.value = e instanceof Error ? e.message : 'Failed to load providers';
  } finally {
    if (requestId === latestRequestId) loading.value = false;
  }
};

let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProviders, 250);
});
watch([categoryId, statusId, sort, includeHidden], () => {
  clearTimeout(searchTimer);
  loadProviders();
});

onMounted(async () => {
  try {
    [categories.value, statuses.value] = await Promise.all([listCategories(), listStatuses()]);
  } catch (e) {
    filterError.value = e instanceof Error ? e.message : 'Failed to load filters';
  }
  await loadProviders();
});

onBeforeUnmount(() => clearTimeout(searchTimer));
</script>
