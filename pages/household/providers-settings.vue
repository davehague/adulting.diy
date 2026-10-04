<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/household" class="text-sm text-amber-700 hover:text-amber-800">&larr; Household</NuxtLink>
      <h1 class="text-2xl font-bold text-stone-900 font-heading mt-1">Provider Settings</h1>
      <p class="text-stone-600 mt-1">Categories, statuses, and API keys for your provider directory</p>
    </div>

    <div v-if="loading" class="text-center py-8">
      <p class="text-stone-600">Loading settings...</p>
    </div>

    <div v-else-if="!isAdmin" class="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <p class="text-stone-700">Only household admins can manage these settings</p>
    </div>

    <div v-else class="space-y-6">
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex justify-between gap-3">
        <span>{{ error }}</span>
        <button class="text-red-500 hover:text-red-700" aria-label="Dismiss" @click="error = ''"><X :size="16" /></button>
      </div>

      <!-- Categories and statuses share the same list editor -->
      <div v-for="section in sections" :key="section.kind"
           class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div class="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <h2 class="text-lg font-semibold text-stone-900 font-heading">{{ section.title }}</h2>
          <p class="mt-1 text-sm text-stone-600">{{ section.description }}</p>
        </div>
        <ul class="divide-y divide-stone-100">
          <li v-for="(item, index) in section.items" :key="item.id" class="p-4 flex flex-wrap items-center gap-2">
            <div class="flex flex-col">
              <button class="text-stone-400 hover:text-stone-700 disabled:opacity-30" :disabled="index === 0"
                      aria-label="Move up" @click="move(section, index, -1)"><ChevronUp :size="16" /></button>
              <button class="text-stone-400 hover:text-stone-700 disabled:opacity-30"
                      :disabled="index === section.items.length - 1"
                      aria-label="Move down" @click="move(section, index, 1)"><ChevronDown :size="16" /></button>
            </div>

            <template v-if="editing?.id === item.id">
              <input v-model="editing.name" type="text"
                     class="flex-1 min-w-[10rem] rounded-md border-stone-300 shadow-sm text-sm focus:border-amber-500 focus:ring-amber-500"
                     @keyup.enter="saveRename(section, item)" @keyup.escape="editing = null">
              <button class="bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
                      @click="saveRename(section, item)">Save</button>
              <button class="text-stone-600 text-sm px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                      @click="editing = null">Cancel</button>
            </template>
            <template v-else>
              <span class="flex-1 min-w-[8rem] text-stone-900 font-medium">
                <span v-if="section.kind === 'status'"
                      class="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                      :class="badgeClass((item as ProviderStatusDto).kind)">{{ item.name }}</span>
                <template v-else>{{ item.name }}</template>
                <span class="text-xs text-stone-400 font-normal ml-1">{{ usageCount(section, item.id) }} in use</span>
              </span>
              <template v-if="section.kind === 'status'">
                <label class="inline-flex items-center gap-1.5 text-sm text-stone-600">
                  Badge color
                  <select :value="(item as ProviderStatusDto).kind"
                          class="rounded-md border-stone-300 shadow-sm text-sm focus:border-amber-500 focus:ring-amber-500"
                          :aria-label="`Badge color for ${item.name}`"
                          @change="updateStatus(item as ProviderStatusDto, { kind: ($event.target as HTMLSelectElement).value as ProviderStatusKind })">
                    <option value="neutral">Gray (neutral)</option>
                    <option value="positive">Green (good)</option>
                    <option value="negative">Red (avoid)</option>
                  </select>
                </label>
                <label class="inline-flex items-center gap-1.5 text-sm text-stone-600"
                       title="When on, providers with this status are left out of the main Providers list. Use the 'Show hidden statuses' checkbox on that page, or pick this status in its filter, to see them.">
                  <input type="checkbox" :checked="(item as ProviderStatusDto).hiddenByDefault"
                         class="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                         @change="updateStatus(item as ProviderStatusDto, { hiddenByDefault: ($event.target as HTMLInputElement).checked })">
                  Keep out of the main list
                </label>
              </template>
              <button class="text-amber-700 hover:text-amber-800 text-sm" @click="editing = { id: item.id, name: item.name }">Rename</button>
              <button class="text-red-600 hover:text-red-800 text-sm" @click="requestDelete(section, item)">Delete</button>
            </template>
          </li>
          <li v-if="section.items.length === 0" class="p-4 text-sm text-stone-500">None yet.</li>
        </ul>
        <form class="p-4 border-t border-stone-100 flex gap-2" @submit.prevent="addItem(section)">
          <input v-model="newNames[section.kind]" type="text" :placeholder="`New ${section.kind}`"
                 class="flex-1 rounded-md border-stone-300 shadow-sm text-sm focus:border-amber-500 focus:ring-amber-500">
          <button type="submit"
                  class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
            <Plus :size="16" />Add
          </button>
        </form>
      </div>

      <!-- API keys -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div class="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <h2 class="text-lg font-semibold text-stone-900 font-heading">API Keys</h2>
        </div>

        <div v-if="newKey" class="m-4 p-4 rounded-lg border border-amber-300 bg-amber-50">
          <p class="text-sm font-medium text-amber-900 mb-2">Copy this now — it won't be shown again.</p>
          <div class="flex flex-wrap items-center gap-2">
            <code class="flex-1 min-w-0 break-all bg-white border border-amber-200 px-3 py-2 rounded-md font-mono text-sm">{{ newKey.key }}</code>
            <button class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
                    @click="copyKey"><Copy :size="16" />{{ copiedKey ? 'Copied!' : 'Copy' }}</button>
            <button class="text-stone-600 text-sm px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                    @click="newKey = null">Done</button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-stone-200">
            <thead class="bg-stone-50">
              <tr>
                <th v-for="h in ['Name', 'Prefix', 'Created', 'Last used', 'Revoked', '']" :key="h"
                    scope="col" class="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">{{ h }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              <tr v-for="k in apiKeys" :key="k.id" :class="k.revokedAt ? 'text-stone-400' : 'text-stone-800'">
                <td class="px-4 py-3 text-sm whitespace-nowrap">{{ k.name }}</td>
                <td class="px-4 py-3 text-sm font-mono whitespace-nowrap">{{ k.prefix }}…</td>
                <td class="px-4 py-3 text-sm whitespace-nowrap">{{ fmt(k.createdAt) }}</td>
                <td class="px-4 py-3 text-sm whitespace-nowrap">{{ k.lastUsedAt ? fmt(k.lastUsedAt) : 'Never' }}</td>
                <td class="px-4 py-3 text-sm whitespace-nowrap">{{ k.revokedAt ? fmt(k.revokedAt) : '' }}</td>
                <td class="px-4 py-3 text-sm text-right whitespace-nowrap">
                  <button v-if="!k.revokedAt" class="text-red-600 hover:text-red-800" @click="revokeKey(k)">Revoke</button>
                </td>
              </tr>
              <tr v-if="apiKeys.length === 0">
                <td colspan="6" class="px-4 py-4 text-sm text-stone-500">No API keys yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <form class="p-4 border-t border-stone-100 flex gap-2" @submit.prevent="createKey">
          <input v-model="newKeyName" type="text" placeholder="Key name (e.g. Facebook loader)"
                 class="flex-1 rounded-md border-stone-300 shadow-sm text-sm focus:border-amber-500 focus:ring-amber-500">
          <button type="submit"
                  class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
            <Plus :size="16" />Create key
          </button>
        </form>
      </div>
    </div>

    <!-- Move-and-delete dialog -->
    <Teleport to="body">
      <div v-if="moveDialog" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="fixed inset-0 bg-black/50" @click="moveDialog = null"></div>
        <div class="relative bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full mx-4 p-6">
          <h3 class="text-lg font-semibold text-stone-900 font-heading mb-2">Delete "{{ moveDialog.item.name }}"</h3>
          <p class="text-sm text-stone-600 mb-4">Providers using it must be moved first.</p>
          <label class="block text-sm font-medium text-stone-700 mb-1" for="move-to">Move providers to:</label>
          <select id="move-to" v-model="moveDialog.moveToId"
                  class="w-full rounded-md border-stone-300 shadow-sm text-sm focus:border-amber-500 focus:ring-amber-500 mb-6">
            <option v-for="o in moveOptions" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
          <p v-if="moveOptions.length === 0" class="text-sm text-red-700 mb-4">Create another one first to move providers into.</p>
          <div class="flex justify-end gap-3">
            <button class="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
                    @click="moveDialog = null">Cancel</button>
            <button :disabled="!moveDialog.moveToId"
                    class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    @click="confirmMoveDelete">Move and delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/utils/api';
import { hasApiStatus } from '@/utils/api-error';
import { X, Copy, Plus, ChevronUp, ChevronDown } from 'lucide-vue-next';
import type {
  ProviderCategoryDto,
  ProviderStatusDto,
  ProviderStatusKind,
  ProviderListItem,
} from '@/types/provider';

type SectionKind = 'category' | 'status';
type NamedItem = ProviderCategoryDto | ProviderStatusDto;

interface Section {
  kind: SectionKind;
  title: string;
  description: string;
  path: string;
  items: NamedItem[];
}

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface MoveDialog {
  section: Section;
  item: NamedItem;
  moveToId: string;
}

const api = useApi();

const loading = ref(true);
const isAdmin = ref(false);
const error = ref('');
const categories = ref<ProviderCategoryDto[]>([]);
const statuses = ref<ProviderStatusDto[]>([]);
const providers = ref<ProviderListItem[]>([]);
const apiKeys = ref<ApiKeyRow[]>([]);
const editing = ref<{ id: string; name: string } | null>(null);
const newNames = ref<Record<SectionKind, string>>({ category: '', status: '' });
const newKeyName = ref('');
const newKey = ref<{ id: string; name: string; prefix: string; key: string } | null>(null);
const copiedKey = ref(false);
const moveDialog = ref<MoveDialog | null>(null);

const sections = computed<Section[]>(() => [
  {
    kind: 'category',
    title: 'Categories',
    description: 'Groups for your providers, like Roofing or Plumbing. Use them to filter the Providers list.',
    path: '/api/provider-categories',
    items: categories.value,
  },
  {
    kind: 'status',
    title: 'Statuses',
    description: 'Where a provider stands with you. Badge color is the color of its label on the list (green for good, red for avoid). "Keep out of the main list" hides providers with that status unless you turn on "Show hidden statuses" on the Providers page.',
    path: '/api/provider-statuses',
    items: statuses.value,
  },
]);

const badgeClass = (kind: ProviderStatusKind): string =>
  kind === 'positive'
    ? 'bg-green-100 text-green-800'
    : kind === 'negative'
      ? 'bg-red-50 text-red-700'
      : 'bg-stone-100 text-stone-700';

const moveOptions = computed<NamedItem[]>(() =>
  moveDialog.value ? moveDialog.value.section.items.filter((i) => i.id !== moveDialog.value?.item.id) : []
);

const fmt = (value: string): string =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

const usageCount = (section: Section, id: string): number =>
  providers.value.filter((p) => (section.kind === 'category' ? p.category.id : p.status.id) === id).length;

const setItems = (section: Section, items: NamedItem[]) => {
  if (section.kind === 'category') categories.value = items as ProviderCategoryDto[];
  else statuses.value = items as ProviderStatusDto[];
};

const loadProviders = async () => {
  providers.value = await api.get<ProviderListItem[]>('/api/providers', { params: { includeHidden: 'true' } });
};

const loadAll = async () => {
  try {
    loading.value = true;
    const household = await api.get<{ isCurrentUserAdmin: boolean }>('/api/household');
    isAdmin.value = household.isCurrentUserAdmin;
    if (!isAdmin.value) return;
    const [cats, stats, list, keys] = await Promise.all([
      api.get<ProviderCategoryDto[]>('/api/provider-categories'),
      api.get<ProviderStatusDto[]>('/api/provider-statuses'),
      api.get<ProviderListItem[]>('/api/providers', { params: { includeHidden: 'true' } }),
      api.get<ApiKeyRow[]>('/api/api-keys'),
    ]);
    categories.value = cats;
    statuses.value = stats;
    providers.value = list;
    apiKeys.value = keys;
  } catch (err) {
    error.value = errorMessage(err, 'Failed to load settings');
  } finally {
    loading.value = false;
  }
};

onMounted(loadAll);

const addItem = async (section: Section) => {
  const name = newNames.value[section.kind].trim();
  if (!name) return;
  try {
    const created = await api.post<NamedItem>(section.path, { name });
    setItems(section, [...section.items, created]);
    newNames.value[section.kind] = '';
  } catch (err) {
    error.value = errorMessage(err, `Failed to add ${section.kind}`);
  }
};

const saveRename = async (section: Section, item: NamedItem) => {
  const name = editing.value?.name.trim();
  if (!name || name === item.name) {
    editing.value = null;
    return;
  }
  try {
    const updated = await api.put<NamedItem>(`${section.path}/${item.id}`, { name });
    setItems(section, section.items.map((i) => (i.id === item.id ? { ...i, ...updated } : i)));
    editing.value = null;
  } catch (err) {
    error.value = errorMessage(err, `Failed to rename ${section.kind}`);
  }
};

const updateStatus = async (item: ProviderStatusDto, patch: Partial<Pick<ProviderStatusDto, 'kind' | 'hiddenByDefault'>>) => {
  try {
    const updated = await api.put<ProviderStatusDto>(`/api/provider-statuses/${item.id}`, patch);
    statuses.value = statuses.value.map((s) => (s.id === item.id ? { ...s, ...updated } : s));
  } catch (err) {
    error.value = errorMessage(err, 'Failed to update status');
    statuses.value = [...statuses.value]; // re-render so the control snaps back
  }
};

const move = async (section: Section, index: number, delta: number) => {
  const target = index + delta;
  if (target < 0 || target >= section.items.length) return;
  const reordered = [...section.items];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const previous = section.items;
  setItems(section, reordered);
  try {
    await api.put(`${section.path}/reorder`, { orderedIds: reordered.map((i) => i.id) });
  } catch (err) {
    setItems(section, previous);
    error.value = errorMessage(err, 'Failed to reorder');
  }
};

const removeItem = async (section: Section, item: NamedItem, moveToId?: string) => {
  await api.delete(`${section.path}/${item.id}`, moveToId ? { body: JSON.stringify({ moveToId }) } : {});
  setItems(section, section.items.filter((i) => i.id !== item.id));
  await loadProviders();
};

const openMoveDialog = (section: Section, item: NamedItem) => {
  const first = section.items.find((i) => i.id !== item.id);
  moveDialog.value = { section, item, moveToId: first?.id ?? '' };
};

const requestDelete = async (section: Section, item: NamedItem) => {
  if (usageCount(section, item.id) > 0) {
    openMoveDialog(section, item);
    return;
  }
  if (!confirm(`Delete "${item.name}"?`)) return;
  try {
    await removeItem(section, item);
  } catch (err) {
    // Usage data can be stale; the API answers 409 when providers still use it.
    if (hasApiStatus(err, 409)) openMoveDialog(section, item);
    else error.value = errorMessage(err, `Failed to delete ${section.kind}`);
  }
};

const confirmMoveDelete = async () => {
  const dialog = moveDialog.value;
  if (!dialog || !dialog.moveToId) return;
  try {
    await removeItem(dialog.section, dialog.item, dialog.moveToId);
    moveDialog.value = null;
  } catch (err) {
    moveDialog.value = null;
    error.value = errorMessage(err, `Failed to delete ${dialog.section.kind}`);
  }
};

const createKey = async () => {
  const name = newKeyName.value.trim();
  if (!name) return;
  try {
    const created = await api.post<{ id: string; name: string; prefix: string; key: string }>('/api/api-keys', { name });
    newKey.value = created;
    copiedKey.value = false;
    newKeyName.value = '';
    apiKeys.value = await api.get<ApiKeyRow[]>('/api/api-keys');
  } catch (err) {
    error.value = errorMessage(err, 'Failed to create API key');
  }
};

const copyKey = async () => {
  if (!newKey.value) return;
  try {
    await navigator.clipboard.writeText(newKey.value.key);
    copiedKey.value = true;
    setTimeout(() => { copiedKey.value = false; }, 2000);
  } catch {
    error.value = 'Could not copy automatically; select the key and copy it manually.';
  }
};

const revokeKey = async (k: ApiKeyRow) => {
  if (!confirm(`Revoke "${k.name}"? Anything using this key will stop working.`)) return;
  try {
    await api.delete(`/api/api-keys/${k.id}`);
    apiKeys.value = await api.get<ApiKeyRow[]>('/api/api-keys');
  } catch (err) {
    error.value = errorMessage(err, 'Failed to revoke API key');
  }
};

definePageMeta({
  title: 'Provider Settings',
});
</script>
