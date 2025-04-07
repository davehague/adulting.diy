<template>
    <div class="mt-6 flow-root">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Occurrence History</h3>
        <div v-if="loading" class="text-center text-gray-500 py-4">Loading history...</div>
        <div v-else-if="error" class="text-center text-red-600 py-4">
            Error loading history: {{ error }}
        </div>
        <ul v-else-if="historyLogs.length > 0" role="list" class="-mb-8">
            <li v-for="(log, logIdx) in historyLogs" :key="log.id">
                <div class="relative pb-8">
                    <!-- Vertical line connector -->
                    <span v-if="logIdx !== historyLogs.length - 1"
                        class="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                    <div class="relative flex space-x-3">
                        <div>
                            <span
                                :class="[getIconBackground(log.logType), 'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white']">
                                <component :is="getIcon(log.logType)" class="h-5 w-5 text-white" aria-hidden="true" />
                            </span>
                        </div>
                        <div class="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                            <div>
                                <p class="text-sm text-gray-500">
                                    {{ formatLogMessage(log) }}
                                    <span class="font-medium text-gray-900">{{ log.user?.name || 'System' }}</span>
                                </p>
                                <p v-if="log.logType === 'comment' && log.comment"
                                    class="mt-1 text-sm text-gray-700 italic">
                                    "{{ log.comment }}"
                                </p>
                            </div>
                            <div class="whitespace-nowrap text-right text-sm text-gray-500">
                                <time :datetime="log.createdAt.toISOString()">{{ formatRelativeTime(log.createdAt)
                                }}</time>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        </ul>
        <div v-else class="text-center text-gray-500 py-4">No history found for this occurrence.</div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useApi } from '@/utils/api';
import type { OccurrenceHistoryLog } from '@/types';
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting

// Import icons (assuming Heroicons v1 - adjust path/import if using v2 or other library)
// @ts-ignore - Suppress type error as @types/heroicons__vue is unavailable
import {
    ChatAltIcon,
    CheckCircleIcon,
    XCircleIcon,
    PencilIcon,
    UserGroupIcon,
    CalendarIcon,
    PlusCircleIcon
} from '@heroicons/vue/solid'; // Revert to original import path

// Props
const props = defineProps<{
    occurrenceId: string;
}>();

// State
const historyLogs = ref<OccurrenceHistoryLog[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const api = useApi();

// Fetch history function
const fetchHistory = async () => {
    if (!props.occurrenceId) {
        historyLogs.value = [];
        error.value = null;
        return;
    }
    loading.value = true;
    error.value = null;
    try {
        const data = await api.get<OccurrenceHistoryLog[]>(`/api/occurrences/${props.occurrenceId}/history`);
        // Ensure dates are Date objects
        historyLogs.value = data.map(log => ({
            ...log,
            createdAt: new Date(log.createdAt) // Convert string date from API to Date object
        }));
    } catch (err: any) {
        console.error("Error fetching occurrence history:", err);
        error.value = err.data?.message || err.message || 'Failed to load history';
        historyLogs.value = [];
    } finally {
        loading.value = false;
    }
};

// Watch for occurrenceId changes and fetch initial data
watch(() => props.occurrenceId, fetchHistory, { immediate: true });
// onMounted(fetchHistory); // immediate: true in watch handles initial load

// --- Formatting and Icon Helpers ---

const formatRelativeTime = (date: Date): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Invalid date';
    }
    return formatDistanceToNow(date, { addSuffix: true });
};

const getIcon = (logType: OccurrenceHistoryLog['logType']) => {
    switch (logType) {
        case 'comment': return ChatAltIcon;
        case 'status_change':
            // Could refine based on newValue (e.g., completed, skipped)
            return CheckCircleIcon; // Default status change icon
        case 'assignment_change': return UserGroupIcon;
        case 'date_change': return CalendarIcon;
        // Add case for initial creation if logged that way
        // case 'created': return PlusCircleIcon;
        default: return PencilIcon; // Generic change
    }
};

const getIconBackground = (logType: OccurrenceHistoryLog['logType']) => {
    switch (logType) {
        case 'comment': return 'bg-gray-400';
        case 'status_change': return 'bg-blue-500'; // Example: blue for status
        case 'assignment_change': return 'bg-yellow-500'; // Example: yellow for assignment
        case 'date_change': return 'bg-purple-500'; // Example: purple for date
        default: return 'bg-gray-400';
    }
};

// Expose the fetchHistory method so parent components can call it
defineExpose({
    fetchHistory
});

const formatLogMessage = (log: OccurrenceHistoryLog): string => {
    switch (log.logType) {
        case 'comment':
            return 'commented';
        case 'status_change':
            if (log.oldValue && log.newValue) {
                return `changed status from ${log.oldValue} to ${log.newValue}`;
            } else if (log.newValue) {
                // Handle initial creation log
                if (log.newValue === 'created' || log.newValue === 'assigned') {
                    return `created occurrence (status: ${log.newValue})`;
                }
                return `changed status to ${log.newValue}`;
            }
            return 'changed status'; // Fallback
        case 'assignment_change':
            // Could potentially parse oldValue/newValue JSON for better message
            return 'changed assignees';
        case 'date_change':
            return `changed due date from ${log.oldValue ? new Date(log.oldValue).toLocaleDateString() : '?'} to ${log.newValue ? new Date(log.newValue).toLocaleDateString() : '?'}`;
        default:
            return `made an update`;
    }
};

</script>