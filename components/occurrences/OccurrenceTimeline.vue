<template>
    <div>
        <h3 class="text-lg font-medium text-gray-900 mb-4">Occurrence History</h3>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-4">
            <p class="text-gray-500">Loading history...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{{ error }}</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="!historyLogs.length" class="text-center py-4 border-t border-gray-200">
            <p class="text-gray-500">No history recorded for this occurrence yet.</p>
        </div>

        <!-- Timeline -->
        <ul v-else class="space-y-4 border-t border-gray-200 pt-4">
            <li v-for="log in historyLogs" :key="log.id" class="flex items-start space-x-3">
                <!-- Icon based on log type -->
                <div class="flex-shrink-0">
                    <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-400">
                        <component :is="getIconComponent(log.log_type)" class="h-5 w-5 text-white" aria-hidden="true" />
                    </span>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm text-gray-500">
                        <span class="font-medium text-gray-900">{{ log.user?.name || 'System' }}</span>
                        {{ formatLogMessage(log) }}
                    </p>
                    <p class="mt-0.5 text-xs text-gray-400">
                        {{ formatDate(log.created_at) }}
                    </p>
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue';
import { useApi } from '@/utils/api';
import type { OccurrenceHistoryLog } from '@/types';
import { ChatBubbleLeftEllipsisIcon, ArrowPathIcon, CalendarDaysIcon, UserGroupIcon, PencilIcon } from '@heroicons/vue/24/solid'; // Example icons

// Props
interface Props {
    occurrenceId: string;
}
const props = defineProps<Props>();

// Setup
const api = useApi();
const historyLogs = ref<OccurrenceHistoryLog[]>([]);
const loading = ref(true);
const error = ref('');

// Fetch history data
onMounted(async () => {
    if (!props.occurrenceId) {
        error.value = 'Occurrence ID is required to load history.';
        loading.value = false;
        return;
    }
    try {
        loading.value = true;
        error.value = '';
        const data = await api.get<OccurrenceHistoryLog[]>(`/api/occurrences/${props.occurrenceId}/history`);
        // Sort logs just in case API doesn't guarantee order (though it should)
        historyLogs.value = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch (err: any) {
        console.error('Error loading occurrence history:', err);
        error.value = err.data?.message || 'Failed to load occurrence history.';
    } finally {
        loading.value = false;
    }
});

// Helper Functions
const formatDate = (date: Date | string): string => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const getIconComponent = (logType: string) => {
    switch (logType) {
        case 'comment': return ChatBubbleLeftEllipsisIcon;
        case 'status_change': return ArrowPathIcon;
        case 'date_change': return CalendarDaysIcon;
        case 'assignment_change': return UserGroupIcon;
        default: return PencilIcon; // Generic edit/change icon
    }
};

const formatLogMessage = (log: OccurrenceHistoryLog): string => {
    switch (log.log_type) {
        case 'comment':
            return `commented: "${log.comment}"`;
        case 'status_change':
            return `changed status from '${log.old_value || 'N/A'}' to '${log.new_value || 'N/A'}'`;
        case 'date_change':
            const oldDate = log.old_value ? new Date(log.old_value).toLocaleDateString() : 'N/A';
            const newDate = log.new_value ? new Date(log.new_value).toLocaleDateString() : 'N/A';
            return `changed due date from ${oldDate} to ${newDate}`;
        case 'assignment_change':
            // TODO: Enhance this to show user names instead of just count/JSON
            const oldAssignees = log.old_value ? JSON.parse(log.old_value).length : 0;
            const newAssignees = log.new_value ? JSON.parse(log.new_value).length : 0;
            return `changed assignees (from ${oldAssignees} to ${newAssignees})`;
        default:
            return `made an update (${log.log_type})`;
    }
};
</script>