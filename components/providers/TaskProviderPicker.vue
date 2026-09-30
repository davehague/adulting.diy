<template>
  <div>
    <div v-if="error" class="mb-2 text-sm text-red-700">{{ error }}</div>

    <p v-if="!loading && linked.length === 0" class="text-sm text-stone-500 mb-2">No providers linked</p>
    <ul v-else class="flex flex-wrap gap-2 mb-3">
      <li v-for="link in linked" :key="link.provider.id"
          class="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-sm pl-3 pr-1 py-0.5">
        <NuxtLink :to="`/providers/${link.provider.id}`" class="hover:underline">{{ link.provider.name }}</NuxtLink>
        <button type="button"
                class="p-0.5 rounded-full hover:bg-amber-200 transition-colors"
                :aria-label="`Unlink ${link.provider.name}`"
                :disabled="busy"
                @click="unlink(link.provider.id)">
          <X :size="14" />
        </button>
      </li>
    </ul>

    <select v-model="selectedId"
            aria-label="Add provider"
            :disabled="busy || available.length === 0"
            class="w-full sm:w-64 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
            @change="link">
      <option value="">{{ available.length === 0 ? 'No more providers to add' : 'Add provider' }}</option>
      <option v-for="p in available" :key="p.id" :value="p.id">{{ p.name }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { X } from 'lucide-vue-next';
import type { ProviderListItem } from '@/types/provider';

interface LinkedProvider {
  provider: { id: string; name: string };
}

const props = defineProps<{ taskId: string }>();

const api = useApi();
const { listProviders } = useProviders();

const linked = ref<LinkedProvider[]>([]);
const allProviders = ref<ProviderListItem[]>([]);
const selectedId = ref('');
const loading = ref(true);
const busy = ref(false);
const error = ref<string | null>(null);

const available = computed(() => {
  const linkedIds = new Set(linked.value.map(l => l.provider.id));
  return allProviders.value.filter(p => !linkedIds.has(p.id));
});

const loadLinked = async () => {
  linked.value = await api.get<LinkedProvider[]>(`/api/tasks/${props.taskId}/providers`);
};

const run = async (action: () => Promise<void>, failure: string) => {
  busy.value = true;
  error.value = null;
  try {
    await action();
  } catch (e) {
    error.value = e instanceof Error ? e.message : failure;
  } finally {
    busy.value = false;
  }
};

const link = () => {
  const providerId = selectedId.value;
  if (!providerId) return;
  return run(async () => {
    await api.post(`/api/tasks/${props.taskId}/providers`, { providerId });
    selectedId.value = '';
    await loadLinked();
  }, 'Failed to link provider');
};

const unlink = (providerId: string) =>
  run(async () => {
    await api.delete(`/api/tasks/${props.taskId}/providers/${providerId}`);
    await loadLinked();
  }, 'Failed to unlink provider');

onMounted(async () => {
  try {
    const [links, providers] = await Promise.all([
      api.get<LinkedProvider[]>(`/api/tasks/${props.taskId}/providers`),
      listProviders({ includeHidden: true, sort: 'name' }),
    ]);
    linked.value = links;
    allProviders.value = providers;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load providers';
  } finally {
    loading.value = false;
  }
});
</script>
