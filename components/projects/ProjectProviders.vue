<template>
  <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h2 class="text-lg font-medium text-stone-900">Providers</h2>
      <select v-if="categories.length > 0"
              :value="(pendingCategory !== undefined ? pendingCategory : knownCategoryId) ?? ''"
              aria-label="Provider category"
              :disabled="savingCategory"
              class="min-w-0 max-w-[60%] rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
              @change="changeCategory">
        <option value="">No category</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
    </div>

    <p v-if="error" class="text-sm text-red-700 mb-3" aria-live="polite">{{ error }}</p>

    <ul v-if="links.length > 0" class="divide-y divide-stone-100 mb-3">
      <li v-for="link in links" :key="link.providerId" class="py-2" :class="link.status === 'passed' ? 'opacity-60' : ''">
        <div class="flex items-center gap-3">
          <NuxtLink :to="`/providers/${link.providerId}`"
                    class="flex-1 min-w-0 text-sm font-medium text-stone-900 break-words hover:text-amber-700">
            {{ link.provider.name }}
          </NuxtLink>
          <select :value="pendingStatus[link.providerId] ?? link.status"
                  :aria-label="`Status for ${link.provider.name}`"
                  :disabled="busyIds.includes(link.providerId)"
                  class="shrink-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                  @change="changeStatus(link, $event)">
            <option v-for="status in PROJECT_PROVIDER_STATUSES" :key="status" :value="status">
              {{ PROVIDER_LINK_STATUS_LABELS[status] }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2 mt-1 text-xs text-stone-600">
          <a v-if="telHref(link.provider.phone)"
             :href="telHref(link.provider.phone) ?? undefined"
             class="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800">
            <Phone :size="12" />{{ link.provider.phone }}
          </a>
          <span v-else>{{ link.provider.phone || 'No phone on file' }}</span>
          <span v-if="neighborLabel(link.provider.neighborCount)">&middot; {{ neighborLabel(link.provider.neighborCount) }}</span>
          <span class="flex-1" />
          <button type="button"
                  class="text-sm font-medium text-red-700 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  :disabled="busyIds.includes(link.providerId)"
                  @click="remove(link)">
            Remove
          </button>
        </div>
      </li>
    </ul>

    <p v-if="categoriesFailed" class="text-sm text-stone-600">
      Could not load provider categories.
      <button type="button" class="font-medium text-amber-700 hover:text-amber-800" @click="loadCategories">Try again</button>
    </p>
    <p v-else-if="categoriesLoaded && categories.length === 0" class="text-sm text-stone-600">
      Add a provider category in Household &gt; Provider settings to link providers.
    </p>
    <template v-else-if="categoriesLoaded">
      <p v-if="links.length >= MAX_PROJECT_PROVIDERS" class="text-sm text-stone-600">
        That's the maximum of {{ MAX_PROJECT_PROVIDERS }} providers for a project.
      </p>
      <ProjectProviderPicker v-else-if="pickerOpen"
                             :project-id="projectId"
                             :categories="categories"
                             :category-id="knownCategoryId"
                             :linked-provider-ids="links.map((link) => link.providerId)"
                             @linked="onLinked"
                             @save-category="saveCategory"
                             @stale="reloadLinks"
                             @cancel="pickerOpen = false" />
      <button v-else
              type="button"
              class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
              @click="pickerOpen = true">
        <Plus :size="16" />Add provider
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Phone, Plus } from 'lucide-vue-next';
import {
  MAX_PROJECT_PROVIDERS,
  PROJECT_PROVIDER_STATUSES,
  type ProjectProviderDto,
  type ProjectProviderStatus,
} from '@/types/project';
import { type ProviderCategoryDto } from '@/types/provider';
import { useProjects } from '@/composables/useProjects';
import { useProviders } from '@/composables/useProviders';
import { PROVIDER_LINK_STATUS_LABELS, neighborLabel, telHref } from '@/utils/project-providers';
import ProjectProviderPicker from '@/components/projects/ProjectProviderPicker.vue';

const props = defineProps<{
  projectId: string;
  // the project's saved provider category; null means none
  categoryId: string | null;
  links: ProjectProviderDto[];
}>();

const emit = defineEmits<{
  (e: 'update:links', links: ProjectProviderDto[]): void;
  (e: 'update:category', categoryId: string | null): void;
}>();

const { updateProject, listProjectProviders, setProviderLinkStatus, unlinkProvider } = useProjects();
const { listCategories } = useProviders();

const categories = ref<ProviderCategoryDto[]>([]);
const categoriesLoaded = ref(false);
const categoriesFailed = ref(false);
const savingCategory = ref(false);
const error = ref<string | null>(null);
const busyIds = ref<string[]>([]);
// What the user just picked while its save is in flight. The dropdowns show it instead of the saved
// value, because any re-render (busy, disabled) would otherwise snap them back to the old value.
const pendingStatus = ref<Record<string, ProjectProviderStatus>>({});
// undefined means no category save is pending from the header dropdown; null means "No category" was picked.
const pendingCategory = ref<string | null | undefined>(undefined);
const pickerOpen = ref(false);

// A saved category that is not in the household's list (deleted since) shows as "No category".
const knownCategoryId = computed<string | null>(() =>
  props.categoryId && categories.value.some((category) => category.id === props.categoryId) ? props.categoryId : null,
);

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

const setBusy = (providerId: string, busy: boolean): void => {
  busyIds.value = busy ? [...busyIds.value, providerId] : busyIds.value.filter((id) => id !== providerId);
};

const setPendingStatus = (providerId: string, status: ProjectProviderStatus | null): void => {
  const { [providerId]: _previous, ...rest } = pendingStatus.value;
  pendingStatus.value = status === null ? rest : { ...rest, [providerId]: status };
};

const loadCategories = async (): Promise<void> => {
  categoriesFailed.value = false;
  try {
    categories.value = await listCategories();
    categoriesLoaded.value = true;
  } catch {
    categoriesFailed.value = true;
  }
};

// Returns whether the save worked.
const saveCategory = async (categoryId: string | null): Promise<boolean> => {
  savingCategory.value = true;
  error.value = null;
  try {
    const updated = await updateProject(props.projectId, { providerCategoryId: categoryId });
    emit('update:category', updated.providerCategoryId ?? null);
    return true;
  } catch (e) {
    error.value = messageOf(e, 'Could not save the category');
    return false;
  } finally {
    savingCategory.value = false;
  }
};

const changeCategory = async (event: Event): Promise<void> => {
  const select = event.target as HTMLSelectElement;
  pendingCategory.value = select.value === '' ? null : select.value;
  try {
    await saveCategory(pendingCategory.value);
  } finally {
    // On a failure this puts the dropdown back to the saved category; on success the saved value is the picked one.
    pendingCategory.value = undefined;
  }
};

const changeStatus = async (link: ProjectProviderDto, event: Event): Promise<void> => {
  const select = event.target as HTMLSelectElement;
  const status = select.value as ProjectProviderStatus;
  if (status === link.status) return;
  error.value = null;
  setBusy(link.providerId, true);
  setPendingStatus(link.providerId, status);
  try {
    emit('update:links', await setProviderLinkStatus(props.projectId, link.providerId, status));
  } catch (e) {
    // Dropping the pending value below puts the dropdown back to the saved status.
    error.value = messageOf(e, 'Could not save the status');
  } finally {
    setPendingStatus(link.providerId, null);
    setBusy(link.providerId, false);
  }
};

const remove = async (link: ProjectProviderDto): Promise<void> => {
  const question = `Remove ${link.provider.name} from this project? To keep a record that you considered them, set them to Passed instead.`;
  if (!window.confirm(question)) return;
  error.value = null;
  setBusy(link.providerId, true);
  try {
    await unlinkProvider(props.projectId, link.providerId);
    emit('update:links', props.links.filter((existing) => existing.providerId !== link.providerId));
  } catch (e) {
    error.value = messageOf(e, 'Could not remove the provider');
  } finally {
    setBusy(link.providerId, false);
  }
};

const onLinked = (links: ProjectProviderDto[]): void => {
  emit('update:links', links);
  pickerOpen.value = false;
};

// The picker was refused because this list is out of date; show what the server has now.
const reloadLinks = async (): Promise<void> => {
  try {
    const latest = await listProjectProviders(props.projectId);
    emit('update:links', latest);
    // At the cap the picker is replaced by the maximum message; close it so it does not reopen by itself after a removal.
    if (latest.length >= MAX_PROJECT_PROVIDERS) pickerOpen.value = false;
  } catch {
    // The picker already shows the server's message; a failed reload adds nothing to say.
  }
};

onMounted(loadCategories);
</script>
