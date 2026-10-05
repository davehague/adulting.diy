<template>
  <div class="rounded-lg border border-stone-200 bg-stone-50 p-3">
    <label :for="`provider-picker-category-${projectId}`" class="block text-sm font-medium text-stone-700">
      {{ selected === '' ? 'What kind of provider?' : 'Category' }}
    </label>
    <select :id="`provider-picker-category-${projectId}`"
            v-model="selected"
            class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
            @change="onCategoryPicked">
      <option v-if="selected === ''" value="" disabled>Choose a category</option>
      <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
    </select>

    <p v-if="error" class="mt-2 text-sm text-red-700" aria-live="polite">{{ error }}</p>

    <template v-if="selected !== ''">
      <p v-if="loading" class="mt-3 text-sm text-stone-600">Loading providers...</p>
      <p v-else-if="loadFailed" class="mt-3 text-sm text-stone-600">
        <button type="button" class="font-medium text-amber-700 hover:text-amber-800" @click="load">Try again</button>
      </p>
      <p v-else-if="providers.length === 0" class="mt-3 text-sm text-stone-600">No providers in this category</p>
      <p v-else-if="available.length === 0" class="mt-3 text-sm text-stone-600">Every provider in this category is already linked</p>
      <ul v-else class="mt-3 divide-y divide-stone-200 max-h-80 overflow-y-auto rounded-md border border-stone-200 bg-white">
        <li v-for="provider in available" :key="provider.id">
          <button type="button"
                  class="w-full text-left px-3 py-2 hover:bg-amber-50 disabled:opacity-50"
                  :disabled="linkingId !== null"
                  @click="pick(provider)">
            <span class="block text-sm font-medium text-stone-900 break-words">{{ provider.name }}</span>
            <span class="flex flex-wrap items-center gap-2 mt-0.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="statusClass(provider.status.kind)">{{ provider.status.name }}</span>
              <span v-if="neighborLabel(provider.neighborCount)" class="text-xs text-stone-600">
                {{ neighborLabel(provider.neighborCount) }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <div class="mt-3 flex justify-end">
      <button type="button"
              class="text-sm font-medium text-stone-600 px-2 py-1 rounded-lg hover:bg-stone-100 disabled:opacity-50"
              :disabled="linkingId !== null"
              @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { type ProjectProviderDto } from '@/types/project';
import { type ProviderCategoryDto, type ProviderListItem, type ProviderStatusKind } from '@/types/provider';
import { useProjects } from '@/composables/useProjects';
import { useProviders } from '@/composables/useProviders';
import { hasApiStatus } from '@/utils/api-error';
import { neighborLabel } from '@/utils/project-providers';

const props = defineProps<{
  projectId: string;
  categories: ProviderCategoryDto[];
  // the project's saved category; null means none chosen yet
  categoryId: string | null;
  linkedProviderIds: string[];
}>();

const emit = defineEmits<{
  // a provider was linked; carries the project's full list
  (e: 'linked', links: ProjectProviderDto[]): void;
  // the project had no category and one was just picked here, so the parent should save it
  (e: 'save-category', categoryId: string): void;
  // the link was refused because the list on screen is out of date
  (e: 'stale'): void;
  (e: 'cancel'): void;
}>();

const { linkProvider } = useProjects();
const { listProviders } = useProviders();

// A saved category that has since been deleted is treated as none.
const selected = ref<string>(
  props.categoryId && props.categories.some((category) => category.id === props.categoryId) ? props.categoryId : '',
);
const providers = ref<ProviderListItem[]>([]);
const loading = ref(false);
const loadFailed = ref(false);
const error = ref<string | null>(null);
const linkingId = ref<string | null>(null);

const available = computed(() => providers.value.filter((provider) => !props.linkedProviderIds.includes(provider.id)));

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

const statusClass = (kind: ProviderStatusKind): string => {
  if (kind === 'positive') return 'bg-green-100 text-green-800';
  if (kind === 'negative') return 'bg-red-50 text-red-700';
  return 'bg-stone-100 text-stone-700';
};

// Ignore a slow response that arrives after the category was switched again.
let latestRequestId = 0;

const load = async (): Promise<void> => {
  if (selected.value === '') return;
  const requestId = ++latestRequestId;
  loading.value = true;
  loadFailed.value = false;
  error.value = null;
  try {
    // Hidden statuses (Lead, out of the box) are included: most of the directory sits there.
    const result = await listProviders({ categoryId: selected.value, includeHidden: true, sort: 'mentions' });
    if (requestId !== latestRequestId) return;
    providers.value = result;
  } catch (e) {
    if (requestId !== latestRequestId) return;
    providers.value = [];
    loadFailed.value = true;
    error.value = messageOf(e, 'Could not load providers');
  } finally {
    if (requestId === latestRequestId) loading.value = false;
  }
};

const onCategoryPicked = (): void => {
  // Switching here never changes a category the project already has.
  if (props.categoryId === null && selected.value !== '') emit('save-category', selected.value);
  void load();
};

const pick = async (provider: ProviderListItem): Promise<void> => {
  if (linkingId.value !== null) return;
  linkingId.value = provider.id;
  error.value = null;
  try {
    emit('linked', await linkProvider(props.projectId, provider.id));
  } catch (e) {
    error.value = messageOf(e, 'Could not add the provider');
    // 409: someone else linked this provider, or the project is full. Ask the parent to reload.
    if (hasApiStatus(e, 409)) emit('stale');
  } finally {
    linkingId.value = null;
  }
};

onMounted(load);
</script>
