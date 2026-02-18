<template>
    <div class="container mx-auto p-4 md:p-6">
        <div v-if="loading" class="text-center py-10 text-stone-500">Loading occurrence details...</div>
        <div v-else-if="error" class="text-center py-10 text-red-600">
            Error loading occurrence: {{ error }}
        </div>
        <div v-else-if="occurrence" class="space-y-6">
            <!-- Header -->
            <div class="md:flex md:items-center md:justify-between pb-4 border-b border-stone-200">
                <div class="min-w-0 flex-1">
                    <NuxtLink :to="`/tasks/${occurrence.taskId}`"
                        class="text-sm font-medium text-amber-700 hover:text-amber-800">
                        &larr; Back to Task Details
                    </NuxtLink>
                    <h2 class="mt-2 text-2xl font-bold leading-7 text-stone-900 sm:truncate sm:text-3xl font-heading">
                        {{ occurrence.task?.name || 'Task' }} ({{ formatDate(occurrence.dueDate) }})
                    </h2>
                </div>
            </div>

            <!-- Task Details -->
            <TaskDetails 
                v-if="fullTask" 
                :task="fullTask" 
                :categories="categories"
                :household-users="householdUsers"
                :collapsible="true"
                :default-expanded="true"
            />

            <!-- Occurrence Details -->
            <div class="bg-white shadow-sm border border-stone-200 overflow-hidden sm:rounded-xl">
                <div class="px-4 py-5 sm:px-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h3 class="text-lg leading-6 font-medium text-stone-900 font-heading">Occurrence Details</h3>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" @click="showEditModal = true"
                            class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                            <Pencil :size="16" />
                            Edit
                        </button>
                        <button type="button" @click="showSkipModal = true" :disabled="isActionDisabled"
                            class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50">
                            <SkipForward :size="16" />
                            Skip
                        </button>
                        <button type="button" @click="showCompleteModal = true" :disabled="isActionDisabled"
                            class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
                            <CheckCircle :size="16" />
                            Complete
                        </button>
                    </div>
                </div>
                <div class="border-t border-stone-200 px-4 py-5 sm:p-0">
                    <dl class="sm:divide-y sm:divide-stone-200">
                        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt class="text-sm font-medium text-stone-500">Category</dt>
                            <dd class="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                                {{ occurrence.task?.category?.name || 'N/A' }}
                            </dd>
                        </div>
                        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt class="text-sm font-medium text-stone-500">Status</dt>
                            <dd class="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0 capitalize">
                                <span :class="getStatusClass(occurrence.status)">
                                    {{ occurrence.status }}
                                </span>
                            </dd>
                        </div>
                        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt class="text-sm font-medium text-stone-500">Due Date</dt>
                            <dd class="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">{{
                                formatDate(occurrence.dueDate) }}</dd>
                        </div>
                        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt class="text-sm font-medium text-stone-500">Assignees</dt>
                            <dd class="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                                {{ formatAssignees(occurrence.assigneeIds) || 'Unassigned' }}
                            </dd>
                        </div>
                        <div v-if="occurrence.status === 'completed'"
                            class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt class="text-sm font-medium text-stone-500">Completed At</dt>
                            <dd class="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">{{
                                formatDateTime(occurrence.completedAt) }}</dd>
                        </div>
                        <div v-if="occurrence.status === 'skipped'"
                            class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt class="text-sm font-medium text-stone-500">Skipped At</dt>
                            <dd class="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">{{
                                formatDateTime(occurrence.skippedAt) }}</dd>
                        </div>
                    </dl>
                </div>
            </div>

            <!-- Comment Form Placeholder -->
            <div class="mt-6">
                <h3 class="text-lg font-medium text-stone-900 mb-2 font-heading">Add Comment</h3>
                <form @submit.prevent="addComment">
                    <div>
                        <label for="comment" class="sr-only">Comment</label>
                        <textarea id="comment" v-model="newComment" rows="3" required
                            class="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3"
                            placeholder="Add your comment..."></textarea>
                    </div>
                    <div class="mt-3 flex justify-end">
                        <button type="submit" :disabled="isSubmittingComment"
                            class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
                            <MessageSquare :size="16" />
                            {{ isSubmittingComment ? 'Adding...' : 'Add Comment' }}
                        </button>
                    </div>
                    <p v-if="commentError" class="mt-2 text-sm text-red-600">{{ commentError }}</p>
                </form>
            </div>


            <!-- History Timeline -->
            <OccurrenceTimeline :occurrence-id="occurrenceId" ref="timelineComponent" />

        </div>
        <div v-else class="text-center py-10 text-stone-500">
            Occurrence not found.
        </div>

        <!-- Edit Modal -->
        <div v-if="showEditModal"
            class="fixed inset-0 z-10 overflow-y-auto bg-stone-500 bg-opacity-75 transition-opacity"
            aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div
                    class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                    <div>
                        <h3 class="text-lg font-medium leading-6 text-stone-900 font-heading" id="modal-title">Edit Occurrence</h3>
                        <div class="mt-4">
                            <OccurrenceEditForm v-if="occurrence" :occurrence="occurrence" @submit="handleEditSubmit"
                                @cancel="handleEditCancel" :disabled="isSubmittingEdit" />
                            <!-- Display submission error within the modal -->
                            <p v-if="editError" class="mt-3 text-sm text-red-600">{{ editError }}</p>
                        </div>
                    </div>
                    <!-- Buttons are now inside the form component -->
                </div>
            </div>
        </div>

        <!-- Skip Modal -->
        <SkipModal
            :show="showSkipModal"
            :is-variable-interval="isVariableInterval"
            :disabled="isSubmittingSkip"
            @confirm="handleSkipConfirm"
            @cancel="handleSkipCancel"
        />

        <!-- Complete Modal -->
        <CompleteModal
            :show="showCompleteModal"
            :disabled="isSubmittingComplete"
            @confirm="handleCompleteConfirm"
            @cancel="handleCompleteCancel"
        />

    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '@/utils/api';
import type { TaskOccurrence, User, Category, TaskDefinition } from '@/types';
import OccurrenceTimeline from '@/components/occurrences/OccurrenceTimeline.vue';
import OccurrenceEditForm from '@/components/occurrences/OccurrenceEditForm.vue';
import SkipModal from '@/components/occurrences/SkipModal.vue';
import CompleteModal from '@/components/occurrences/CompleteModal.vue';
import { Pencil, SkipForward, CheckCircle, MessageSquare } from 'lucide-vue-next';
import { format } from 'date-fns';

// Setup
const route = useRoute();
const router = useRouter();
const api = useApi();
const occurrenceId = computed(() => route.params.id as string);

// State
const occurrence = ref<TaskOccurrence | null>(null);
const fullTask = ref<TaskDefinition | null>(null); // Full task details for TaskDetails component
const householdUsers = ref<Pick<User, 'id' | 'name'>[]>([]); // For assignee formatting
const categories = ref<Category[]>([]); // For category names
const loading = ref(false);
const error = ref<string | null>(null);
const newComment = ref('');
const isSubmittingComment = ref(false);
const commentError = ref<string | null>(null);
const timelineComponent = ref<InstanceType<typeof OccurrenceTimeline> | null>(null); // Ref for timeline

// Modals State
const showSkipModal = ref(false);
const showEditModal = ref(false);
const showCompleteModal = ref(false);
const isSubmittingEdit = ref(false);
const editError = ref<string | null>(null);
const isSubmittingSkip = ref(false);
const skipError = ref<string | null>(null);
const isSubmittingComplete = ref(false);

// Fetch Occurrence Data
const fetchOccurrence = async () => {
    if (!occurrenceId.value) return;
    loading.value = true;
    error.value = null;
    try {
        // Fetch occurrence details - API should include task.name, task.category.name, task.householdId
        const data = await api.get<TaskOccurrence>(`/api/occurrences/${occurrenceId.value}`);
        // Convert date strings from API to Date objects
        occurrence.value = {
            ...data,
            dueDate: new Date(data.dueDate),
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            ...(data.completedAt && { completedAt: new Date(data.completedAt) }),
            ...(data.skippedAt && { skippedAt: new Date(data.skippedAt) }),
        };

        // Fetch full task details for TaskDetails component
        if (data.taskId) {
            fetchFullTask(data.taskId);
        }

        // Fetch household users if needed for formatting assignees (can be optimized)
        if (data.assigneeIds?.length > 0) {
            fetchHouseholdUsers();
        }

    } catch (err: any) {
        console.error("Error fetching occurrence:", err);
        error.value = err.data?.message || err.message || 'Failed to load occurrence details';
        occurrence.value = null;
    } finally {
        loading.value = false;
    }
};

// Fetch Household Users (for assignee formatting)
const fetchHouseholdUsers = async () => {
    try {
        const usersData = await api.get<Pick<User, 'id' | 'name'>[]>('/api/household/users');
        householdUsers.value = usersData;
    } catch (err) {
        console.error('Error fetching household users for formatting:', err);
        // Non-critical, assignee IDs will be shown instead of names
    }
};

// Fetch Categories (for task details)
const fetchCategories = async () => {
    try {
        const categoriesData = await api.get<Category[]>('/api/categories');
        categories.value = categoriesData;
    } catch (err) {
        console.error('Error fetching categories:', err);
        // Non-critical, category will show as 'Unknown'
    }
};

// Fetch Full Task Details (for TaskDetails component)
const fetchFullTask = async (taskId: string) => {
    try {
        const taskData = await api.get<TaskDefinition>(`/api/tasks/${taskId}`);
        fullTask.value = taskData;
    } catch (err) {
        console.error('Error fetching full task details:', err);
        // Non-critical, will fall back to basic task info from occurrence
    }
};


// Computed property to disable actions if occurrence is completed/skipped/deleted
const isActionDisabled = computed(() => {
    return !occurrence.value || ['completed', 'skipped', 'deleted'].includes(occurrence.value.status);
});

// Determine if the task uses variable interval scheduling
const isVariableInterval = computed(() => {
    return (fullTask.value?.scheduleConfig as any)?.type === 'variable_interval';
});

// --- Formatting Helpers ---
const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'N/A';
    try {
        return format(new Date(date), 'PPP'); // e.g., Jun 20, 2024
    } catch {
        return 'Invalid Date';
    }
};

const formatDateTime = (date: Date | string | undefined): string => {
    if (!date) return 'N/A';
    try {
        return format(new Date(date), 'Pp'); // e.g., Jun 20, 2024, 4:30 PM
    } catch {
        return 'Invalid Date';
    }
};

const formatAssignees = (assigneeIds: string[] | undefined): string => {
    if (!assigneeIds || assigneeIds.length === 0) return '';
    if (householdUsers.value.length === 0) return assigneeIds.join(', '); // Fallback to IDs

    return assigneeIds.map(id => {
        const user = householdUsers.value.find(u => u.id === id);
        return user ? user.name : id; // Show name or ID if user not found
    }).join(', ');
};

const getStatusClass = (status: string): string => {
    switch (status) {
        case 'completed': return 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800';
        case 'skipped': return 'inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800';
        case 'deleted': return 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800';
        case 'assigned': return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800';
        case 'created': return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-800';
        default: return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-800';
    }
};

// --- Actions ---

const addComment = async () => {
    if (!newComment.value.trim() || !occurrenceId.value) return;
    isSubmittingComment.value = true;
    commentError.value = null;
    try {
        await api.post(`/api/occurrences/${occurrenceId.value}/comments`, {
            comment: newComment.value.trim()
        });
        newComment.value = ''; // Clear comment box
        // Refresh timeline
        if (timelineComponent.value) {
            timelineComponent.value.fetchHistory();
        }
    } catch (err: any) {
        console.error("Error adding comment:", err);
        commentError.value = err.data?.message || 'Failed to add comment';
    } finally {
        isSubmittingComment.value = false;
    }
};

// --- Complete Occurrence Logic ---
const handleCompleteConfirm = async (completionDate: string) => {
    if (!occurrenceId.value || isActionDisabled.value) return;
    isSubmittingComplete.value = true;
    try {
        await api.post(`/api/occurrences/${occurrenceId.value}/execute`, {
            executedAt: completionDate,
        });
        showCompleteModal.value = false;
        fetchOccurrence();
        if (timelineComponent.value) {
            timelineComponent.value.fetchHistory();
        }
    } catch (err: any) {
        console.error("Error executing occurrence:", err);
        error.value = err.data?.message || 'Failed to complete occurrence';
    } finally {
        isSubmittingComplete.value = false;
    }
};

const handleCompleteCancel = () => {
    showCompleteModal.value = false;
};

// --- Edit Occurrence Logic ---
const handleEditSubmit = async (formData: { dueDate: string; assigneeIds: string[] }) => {
    if (!occurrenceId.value) return;
    isSubmittingEdit.value = true;
    editError.value = null;
    try {
        await api.put(`/api/occurrences/${occurrenceId.value}`, {
            dueDate: formData.dueDate, // Already formatted as YYYY-MM-DD string
            assigneeIds: formData.assigneeIds
        });
        showEditModal.value = false;
        // Refresh data after successful edit
        fetchOccurrence();
        if (timelineComponent.value) {
            timelineComponent.value.fetchHistory();
        }
    } catch (err: any) {
        console.error("Error updating occurrence:", err);
        editError.value = err.data?.message || 'Failed to save changes';
        // Keep modal open to show error
    } finally {
        isSubmittingEdit.value = false;
    }
};

const handleEditCancel = () => {
    showEditModal.value = false;
    editError.value = null; // Clear error on cancel
};

// --- Skip Occurrence Logic ---
const handleSkipConfirm = async (reason: string) => {
    if (!occurrenceId.value || isActionDisabled.value) return;
    isSubmittingSkip.value = true;
    skipError.value = null;
    try {
        await api.post(`/api/occurrences/${occurrenceId.value}/skip`, {
            reason
        });
        showSkipModal.value = false;
        // Refresh data after successful skip
        fetchOccurrence();
        if (timelineComponent.value) {
            timelineComponent.value.fetchHistory();
        }
    } catch (err: any) {
        console.error("Error skipping occurrence:", err);
        skipError.value = err.data?.message || 'Failed to skip occurrence';
    } finally {
        isSubmittingSkip.value = false;
    }
};

const handleSkipCancel = () => {
    showSkipModal.value = false;
    skipError.value = null;
};


// Fetch data on component mount
onMounted(async () => {
    await Promise.all([
        fetchOccurrence(),
        fetchCategories()
    ]);
});

</script>