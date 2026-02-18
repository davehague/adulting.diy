<template>
    <div class="mt-6 flow-root">
        <h3 class="font-heading text-lg font-medium text-stone-900 mb-4">Occurrence History</h3>
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
                            <div class="flex-1 min-w-0">
                                <p class="text-sm text-stone-500">
                                    <span class="font-medium" :class="log.user && isFormerMember(log.userId) ? 'text-stone-400 italic' : 'text-stone-900'">{{ log.user?.name || 'System' }}</span>
                                    {{ formatLogMessage(log) }}
                                </p>
                                <!-- Comment display / edit -->
                                <div v-if="log.logType === 'comment' && log.comment">
                                    <!-- Edit mode -->
                                    <div v-if="editingCommentId === log.id" class="mt-1">
                                        <textarea v-model="editCommentText" rows="2"
                                            class="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2"
                                        ></textarea>
                                        <div class="mt-1.5 flex items-center gap-2">
                                            <button @click="saveEdit(log)"
                                                :disabled="isSavingEdit || !editCommentText.trim()"
                                                class="text-xs font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50">
                                                {{ isSavingEdit ? 'Saving...' : 'Save' }}
                                            </button>
                                            <button @click="cancelEdit"
                                                :disabled="isSavingEdit"
                                                class="text-xs font-medium text-stone-500 hover:text-stone-700 disabled:opacity-50">
                                                Cancel
                                            </button>
                                        </div>
                                        <p v-if="editError" class="mt-1 text-xs text-red-600">{{ editError }}</p>
                                    </div>
                                    <!-- Read mode -->
                                    <div v-else class="mt-2 group">
                                        <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                            <p class="text-sm text-stone-800">
                                                {{ log.comment }}
                                                <span v-if="log.updatedAt" class="text-xs text-stone-400 ml-1">(edited)</span>
                                            </p>
                                        </div>
                                        <button v-if="isOwnComment(log)"
                                            @click="startEdit(log)"
                                            class="opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 align-middle text-stone-400 hover:text-stone-600"
                                            title="Edit comment">
                                            <PencilIcon class="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="whitespace-nowrap text-right text-sm text-stone-500">
                                <time :datetime="log.createdAt.toISOString()">{{ formatRelativeTime(log.createdAt)
                                }}</time>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        </ul>
        <div v-else class="text-center text-stone-500 py-4">No history found for this occurrence.</div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useApi } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import type { OccurrenceHistoryLog } from '@/types';
import type { FormerHouseholdMember } from '@/types/user';
import { formatDistanceToNow } from 'date-fns';

import {
    ChatBubbleLeftEllipsisIcon,
    CheckCircleIcon,
    XCircleIcon,
    PencilIcon,
    UserGroupIcon,
    CalendarIcon,
    PlusCircleIcon
} from '@heroicons/vue/24/solid';

// Props
const props = defineProps<{
    occurrenceId: string;
    formerMembers?: FormerHouseholdMember[];
    householdUsers?: { id: string; name: string }[];
}>();

const isFormerMember = (userId: string): boolean => {
    return (props.formerMembers || []).some(fm => fm.userId === userId);
};

// State
const historyLogs = ref<OccurrenceHistoryLog[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const api = useApi();
const authStore = useAuthStore();

// Edit state
const editingCommentId = ref<string | null>(null);
const editCommentText = ref('');
const isSavingEdit = ref(false);
const editError = ref<string | null>(null);

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
        historyLogs.value = data.map(log => ({
            ...log,
            createdAt: new Date(log.createdAt),
            ...(log.updatedAt && { updatedAt: new Date(log.updatedAt) }),
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

// --- Comment editing ---

const isOwnComment = (log: OccurrenceHistoryLog): boolean => {
    return log.userId === authStore.user?.id;
};

const startEdit = (log: OccurrenceHistoryLog) => {
    editingCommentId.value = log.id;
    editCommentText.value = log.comment || '';
    editError.value = null;
};

const cancelEdit = () => {
    editingCommentId.value = null;
    editCommentText.value = '';
    editError.value = null;
};

const saveEdit = async (log: OccurrenceHistoryLog) => {
    if (!editCommentText.value.trim()) return;
    isSavingEdit.value = true;
    editError.value = null;
    try {
        await api.put(`/api/occurrences/${props.occurrenceId}/comments/${log.id}`, {
            comment: editCommentText.value.trim()
        });
        editingCommentId.value = null;
        editCommentText.value = '';
        await fetchHistory();
    } catch (err: any) {
        console.error("Error updating comment:", err);
        editError.value = err.data?.message || 'Failed to update comment';
    } finally {
        isSavingEdit.value = false;
    }
};

// --- Formatting and Icon Helpers ---

const formatRelativeTime = (date: Date): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Invalid date';
    }
    return formatDistanceToNow(date, { addSuffix: true });
};

const getIcon = (logType: OccurrenceHistoryLog['logType']) => {
    switch (logType) {
        case 'comment': return ChatBubbleLeftEllipsisIcon;
        case 'status_change':
            return CheckCircleIcon;
        case 'assignment_change': return UserGroupIcon;
        case 'date_change': return CalendarIcon;
        default: return PencilIcon;
    }
};

const getIconBackground = (logType: OccurrenceHistoryLog['logType']) => {
    switch (logType) {
        case 'comment': return 'bg-stone-400';
        case 'status_change': return 'bg-amber-600';
        case 'assignment_change': return 'bg-yellow-500';
        case 'date_change': return 'bg-purple-500';
        default: return 'bg-stone-400';
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
                if (log.newValue === 'created' || log.newValue === 'assigned') {
                    return `created occurrence (status: ${log.newValue})`;
                }
                return `changed status to ${log.newValue}`;
            }
            return 'changed status';
        case 'assignment_change': {
            const resolveNames = (json: string | undefined): string => {
                if (!json) return '?';
                try {
                    const ids: string[] = JSON.parse(json);
                    if (ids.length === 0) return 'none';
                    return ids.map(id => {
                        const user = (props.householdUsers || []).find(u => u.id === id);
                        if (user) return user.name;
                        const former = (props.formerMembers || []).find(u => u.userId === id);
                        if (former) return former.name;
                        return 'Unknown';
                    }).join(', ');
                } catch {
                    return '?';
                }
            };
            return `changed assignees from ${resolveNames(log.oldValue)} to ${resolveNames(log.newValue)}`;
        }
        case 'date_change':
            return `changed due date from ${log.oldValue ? new Date(log.oldValue).toLocaleDateString() : '?'} to ${log.newValue ? new Date(log.newValue).toLocaleDateString() : '?'}`;
        default:
            return `made an update`;
    }
};

</script>
