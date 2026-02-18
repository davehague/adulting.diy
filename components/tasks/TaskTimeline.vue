<template>
  <div class="mt-6 flow-root">
    <h3 class="font-heading text-lg font-medium text-stone-900 mb-4">Task Activity</h3>
    <div v-if="loading" class="text-center text-stone-500 py-4">Loading history...</div>
    <div v-else-if="error" class="text-center text-red-600 py-4">
      Error loading history: {{ error }}
    </div>
    <ul v-else-if="historyLogs.length > 0" role="list" class="-mb-8">
      <li v-for="(log, logIdx) in historyLogs" :key="log.id">
        <div class="relative pb-8">
          <!-- Vertical line connector -->
          <span v-if="logIdx !== historyLogs.length - 1"
            class="absolute left-4 top-4 -ml-px h-full w-0.5 bg-stone-200" aria-hidden="true"></span>
          <div class="relative flex space-x-3">
            <div>
              <span
                :class="[getIconBackground(log.logType), 'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white']">
                <component :is="getIcon(log.logType)" class="h-5 w-5 text-white" aria-hidden="true" />
              </span>
            </div>
            <div class="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
              <div>
                <p class="text-sm text-stone-500">
                  {{ formatLogMessage(log) }}
                  <span class="font-medium text-stone-900">{{ log.user?.name || 'System' }}</span>
                </p>
                <p v-if="log.comment" class="mt-1 text-sm text-stone-700 italic">
                  "{{ log.comment }}"
                </p>
              </div>
              <div class="whitespace-nowrap text-right text-sm text-stone-500">
                <time :datetime="log.createdAt.toISOString()">{{ formatRelativeTime(log.createdAt) }}</time>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ul>
    <div v-else class="text-center text-stone-500 py-4">No task activity yet.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useApi } from '@/utils/api';
import type { TaskHistoryLog } from '@/types';
import { formatDistanceToNow } from 'date-fns';

// @ts-ignore - Suppress type error as @types/heroicons__vue is unavailable
import {
  ArrowPathIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  PencilIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@heroicons/vue/24/solid';

// Props
const props = defineProps<{
  taskId: string;
}>();

// State
const historyLogs = ref<TaskHistoryLog[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const api = useApi();

// Fetch history function
const fetchHistory = async () => {
  if (!props.taskId) {
    historyLogs.value = [];
    error.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const data = await api.get<TaskHistoryLog[]>(`/api/tasks/${props.taskId}/history`);
    // Ensure dates are Date objects
    historyLogs.value = data.map(log => ({
      ...log,
      createdAt: new Date(log.createdAt),
    }));
  } catch (err: any) {
    console.error("Error fetching task history:", err);
    error.value = err.data?.message || err.message || 'Failed to load history';
    historyLogs.value = [];
  } finally {
    loading.value = false;
  }
};

// Watch for taskId changes and fetch initial data
watch(() => props.taskId, fetchHistory, { immediate: true });

// Expose the fetchHistory method so parent components can call it
defineExpose({ fetchHistory });

// --- Formatting and Icon Helpers ---

const formatRelativeTime = (date: Date): string => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid date';
  }
  return formatDistanceToNow(date, { addSuffix: true });
};

const getIcon = (logType: string) => {
  switch (logType) {
    case 'catch_up': return ArrowPathIcon;
    case 'paused': return PauseCircleIcon;
    case 'unpaused': return PlayCircleIcon;
    case 'edited': return PencilIcon;
    case 'created': return PlusCircleIcon;
    case 'soft_deleted': return TrashIcon;
    default: return PencilIcon;
  }
};

const getIconBackground = (logType: string) => {
  switch (logType) {
    case 'catch_up': return 'bg-amber-600';
    case 'paused': return 'bg-yellow-500';
    case 'unpaused': return 'bg-green-500';
    case 'created': return 'bg-blue-500';
    case 'soft_deleted': return 'bg-red-500';
    default: return 'bg-stone-400';
  }
};

const formatLogMessage = (log: TaskHistoryLog): string => {
  switch (log.logType) {
    case 'catch_up': {
      const details = log.details as any;
      const skipped = details?.occurrencesSkipped ?? 0;
      const newDate = details?.newDueDate
        ? new Date(details.newDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'none';
      return `Caught up \u2014 ${skipped} occurrence${skipped !== 1 ? 's' : ''} skipped. Next due: ${newDate}. By `;
    }
    case 'paused': return 'Paused task. By ';
    case 'unpaused': return 'Unpaused task. By ';
    case 'created': return 'Created task. By ';
    case 'edited': return 'Edited task. By ';
    case 'soft_deleted': return 'Deleted task. By ';
    default: return 'Updated task. By ';
  }
};
</script>
