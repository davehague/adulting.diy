<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-stone-600">Loading task details...</p>
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      <p>{{ error }}</p>
      <div class="mt-2">
        <NuxtLink to="/tasks" class="text-amber-700 hover:text-amber-800">
          Return to task list
        </NuxtLink>
      </div>
    </div>

    <!-- Task Details -->
    <div v-else class="mb-8">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 class="font-heading text-2xl font-bold text-stone-900">{{ task.name }}</h1>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="hasOverdueOccurrences" @click="openCatchUpModal"
            class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
            <FastForward :size="16" /> Catch Up
          </button>
          <NuxtLink :to="`/tasks/${task.id}/edit`"
            class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50">
            <Pencil :size="16" /> Edit Task
          </NuxtLink>
          <button v-if="task.metaStatus === 'active'" @click="pauseTask"
            class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50">
            <Pause :size="16" /> Pause Task
          </button>
          <button v-if="task.metaStatus === 'paused'" @click="unpauseTask"
            class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50">
            <Play :size="16" /> Unpause Task
          </button>
          <button v-if="task.metaStatus !== 'soft-deleted'" @click="deleteTask"
            class="inline-flex items-center gap-1.5 text-red-500 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
            <Trash2 :size="16" /> Delete Task
          </button>
        </div>
      </div>

      <!-- Task Content -->
      <TaskDetails 
        :task="task" 
        :categories="categories" 
        :household-users="householdUsers"
        class="mb-6"
      />

      <!-- Occurrences Section -->
      <div class="mb-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="font-heading text-xl font-semibold text-stone-900">Occurrences</h2>
          <NuxtLink :to="`/tasks/${task.id}/occurrences`" class="text-amber-700 hover:text-amber-800">
            View All Occurrences
          </NuxtLink>
        </div>

        <!-- Occurrences Loading -->
        <div v-if="loadingOccurrences" class="text-center py-4">
          <p class="text-stone-600">Loading occurrences...</p>
        </div>

        <!-- Empty State for Occurrences -->
        <div v-else-if="!occurrences.length" class="bg-white rounded-xl shadow-sm border border-stone-200 p-6 text-center">
          <h3 class="font-heading text-lg font-semibold text-stone-700 mb-2">No Occurrences</h3>
          <p class="text-stone-500 mb-4">
            {{
              task.metaStatus === 'active'
                ? 'This task has no occurrences yet. They will be automatically generated based on the schedule.'
                : 'This task is not active, so no occurrences will be generated.'
            }}
          </p>
        </div>

        <!-- Occurrences List -->
        <div v-else class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <!-- Mobile occurrence cards -->
          <div class="md:hidden divide-y divide-stone-100">
            <div v-for="occurrence in occurrences.slice(0, 5)" :key="'m-' + occurrence.id"
                 @click="navigateToOccurrence(occurrence.id)"
                 class="p-4 cursor-pointer hover:bg-stone-50 transition-colors">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-stone-900">{{ formatDate(occurrence.dueDate) }}</span>
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="getOccurrenceStatusClass(occurrence.status)">
                  {{ formatOccurrenceStatus(occurrence.status) }}
                </span>
              </div>
              <div class="text-xs text-stone-500">{{ getAssigneeNames(occurrence.assigneeIds) }}</div>
            </div>
          </div>
          <!-- Desktop table -->
          <div class="hidden md:block">
          <table class="min-w-full divide-y divide-stone-200">
            <thead class="bg-stone-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Assignees
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-stone-200">
              <tr v-for="occurrence in occurrences.slice(0, 5)" :key="occurrence.id"
                  @click="navigateToOccurrence(occurrence.id)"
                  class="cursor-pointer hover:bg-stone-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-900">
                  {{ formatDate(occurrence.dueDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="getOccurrenceStatusClass(occurrence.status)">
                    {{ formatOccurrenceStatus(occurrence.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                  {{ getAssigneeNames(occurrence.assigneeIds) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                    @click.stop>
                  <div class="relative inline-block text-left">
                    <button
                      @click="toggleDropdown(occurrence.id)"
                      class="text-stone-400 hover:text-stone-600 focus:outline-none"
                      title="Actions"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>

                    <div
                      v-if="openDropdownId === occurrence.id"
                      class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                    >
                      <div class="py-1">
                        <NuxtLink
                          :to="`/occurrences/${occurrence.id}`"
                          class="group flex items-center px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                        >
                          <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </NuxtLink>

                        <button
                          v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                          @click="handleEdit(occurrence)"
                          class="group flex items-center w-full px-4 py-2 text-sm text-amber-700 hover:bg-stone-100"
                        >
                          <svg class="mr-3 h-4 w-4 text-amber-500 group-hover:text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>

                        <button
                          v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                          @click="handleExecute(occurrence.id)"
                          class="group flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-stone-100"
                        >
                          <svg class="mr-3 h-4 w-4 text-green-400 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Complete
                        </button>

                        <button
                          v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                          @click="handleSkip(occurrence.id)"
                          class="group flex items-center w-full px-4 py-2 text-sm text-yellow-600 hover:bg-stone-100"
                        >
                          <svg class="mr-3 h-4 w-4 text-yellow-400 group-hover:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Skip
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          <!-- Show More Link if more than 5 occurrences -->
          <div v-if="occurrences.length > 5" class="px-6 py-3 bg-stone-50 text-right">
            <NuxtLink :to="`/tasks/${task.id}/occurrences`" class="text-amber-700 hover:text-amber-800">
              View all {{ occurrences.length }} occurrences
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Task Activity Timeline -->
      <TaskTimeline ref="taskTimelineRef" :task-id="taskId" />

      <!-- Catch Up Modal -->
      <CatchUpModal
        ref="catchUpModalRef"
        :visible="showCatchUpModal"
        :task-name="task.name"
        :overdue-count="overdueOccurrenceCount"
        :calculated-next-due-date="calculatedNextDueDate"
        @confirm="handleCatchUp"
        @cancel="showCatchUpModal = false"
      />

      <!-- Skip Modal -->
      <SkipModal
        :show="showSkipModal"
        :is-variable-interval="isVariableInterval"
        :disabled="isSubmittingSkip"
        @confirm="handleSkipConfirm"
        @cancel="handleSkipCancel"
      />

      <!-- Edit Modal -->
      <div v-if="showEditModal"
        class="fixed inset-0 z-10 overflow-y-auto bg-stone-500 bg-opacity-75 transition-opacity"
        aria-labelledby="edit-modal-title" role="dialog" aria-modal="true">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
            <div>
              <h3 class="text-lg font-medium leading-6 text-stone-900 font-heading" id="edit-modal-title">Edit Occurrence</h3>
              <div class="mt-4">
                <OccurrenceEditForm
                  v-if="editTargetOccurrence"
                  :occurrence="editTargetOccurrence"
                  @submit="handleEditSubmit"
                  @cancel="handleEditCancel"
                  :disabled="isSubmittingEdit"
                />
                <p v-if="editError" class="mt-3 text-sm text-red-600">{{ editError }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Back to Tasks List -->
      <div class="mt-8">
        <NuxtLink to="/tasks" class="text-amber-700 hover:text-amber-800">
          &larr; Back to Tasks List
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '@/utils/api'; // Keep for categories/occurrences for now
import { useTaskStore } from '@/stores/tasks';
import type { TaskDefinition, TaskOccurrence, Category, User } from '@/types'; // Add User type
import CatchUpModal from '@/components/tasks/CatchUpModal.vue';
import TaskTimeline from '@/components/tasks/TaskTimeline.vue';
import { useToast } from '@/composables/useToast';
import SkipModal from '@/components/occurrences/SkipModal.vue';
import OccurrenceEditForm from '@/components/occurrences/OccurrenceEditForm.vue';
import { Pencil, Pause, Play, Trash2, FastForward } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const api = useApi();
const taskStore = useTaskStore();
const toast = useToast();

// Task ID from route params
const taskId = route.params.id as string;

// State
// State
// Use computed properties for task details from store
const task = computed(() => taskStore.selectedTask || {} as TaskDefinition);
const loading = computed(() => taskStore.isLoading);
const error = computed(() => taskStore.error);

// Keep local state for occurrences and categories
const occurrences = ref<TaskOccurrence[]>([]);
const categories = ref<Category[]>([]);
const householdUsers = ref<User[]>([]); // State for household users
const loadingOccurrences = ref(true);
const loadingUsers = ref(false); // Add loading state for users
const taskTimelineRef = ref<InstanceType<typeof TaskTimeline> | null>(null);

// Dropdown state
const openDropdownId = ref<string | null>(null);

// Skip modal state
const showSkipModal = ref(false);
const skipTargetId = ref<string | null>(null);
const isSubmittingSkip = ref(false);

// Edit modal state
const showEditModal = ref(false);
const editTargetOccurrence = ref<TaskOccurrence | null>(null);
const isSubmittingEdit = ref(false);
const editError = ref<string | null>(null);

// Determine if the task uses variable interval scheduling
const isVariableInterval = computed(() => {
  return (task.value?.scheduleConfig as any)?.type === 'variable_interval';
});

// Load data
onMounted(async () => {
  try {
    // Load categories
    const categoriesData = await api.get<Category[]>('/api/categories');
    categories.value = categoriesData;

    // Load task details via store action
    await taskStore.fetchTaskById(taskId);
    // await fetchTask(); // Removed local fetch

    // Load occurrences
    // Fetch occurrences and users in parallel
    await Promise.all([
      fetchOccurrences(),
      fetchHouseholdUsers()
    ]);
    // Store handles loading/error state for the task itself
  } catch (err) {
    // Log error, but primary error display relies on store.error
    console.error("Error during initial data load:", err);
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', handleClickOutside);
});

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.relative')) {
    openDropdownId.value = null;
  }
};

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Removed local fetchTask function

// Fetch task occurrences
const fetchOccurrences = async () => {
  try {
    loadingOccurrences.value = true;
    const occurrencesData = await api.get<TaskOccurrence[]>(`/api/tasks/${taskId}/occurrences`);
    occurrences.value = occurrencesData;
    loadingOccurrences.value = false;
  } catch (err) {
    loadingOccurrences.value = false;
    console.error('Error loading occurrences:', err);
    // Don't set the main error state here, let the task loading handle that.
    // Maybe add a specific occurrence loading error message if needed.
  }
};

// Fetch household users
const fetchHouseholdUsers = async () => {
  try {
    loadingUsers.value = true;
    const usersData = await api.get<User[]>('/api/household/users');
    householdUsers.value = usersData;
    // Removed debug log
  } catch (err: any) {
    console.error('Error loading household users:', err);
    // Handle user loading error if needed, maybe display a message
  } finally {
    loadingUsers.value = false;
  }
};

// Dropdown management
const toggleDropdown = (occurrenceId: string) => {
  openDropdownId.value = openDropdownId.value === occurrenceId ? null : occurrenceId;
};

const closeDropdown = () => {
  openDropdownId.value = null;
};

// Occurrence action handlers
const handleExecute = async (occurrenceId: string) => {
  closeDropdown();
  try {
    await taskStore.executeOccurrence(occurrenceId);
    await fetchOccurrences();
    taskTimelineRef.value?.fetchHistory();
  } catch (err) {
    console.error("Execute failed:", err);
    toast.error(`Error completing occurrence: ${taskStore.error || 'Unknown error'}`);
  }
};

const handleSkip = (occurrenceId: string) => {
  closeDropdown();
  skipTargetId.value = occurrenceId;
  showSkipModal.value = true;
};

const handleSkipConfirm = async (reason: string) => {
  if (!skipTargetId.value) return;
  isSubmittingSkip.value = true;
  try {
    await taskStore.skipOccurrence(skipTargetId.value, reason);
    showSkipModal.value = false;
    skipTargetId.value = null;
    await fetchOccurrences();
    taskTimelineRef.value?.fetchHistory();
  } catch (err) {
    console.error("Skip failed:", err);
    toast.error(`Error skipping occurrence: ${taskStore.error || 'Unknown error'}`);
  } finally {
    isSubmittingSkip.value = false;
  }
};

const handleSkipCancel = () => {
  showSkipModal.value = false;
  skipTargetId.value = null;
};

const handleEdit = (occurrence: TaskOccurrence) => {
  closeDropdown();
  editTargetOccurrence.value = occurrence;
  showEditModal.value = true;
};

const handleEditSubmit = async (formData: { dueDate: string; assigneeIds: string[] }) => {
  if (!editTargetOccurrence.value) return;
  isSubmittingEdit.value = true;
  editError.value = null;
  try {
    await taskStore.updateOccurrence(editTargetOccurrence.value.id, {
      dueDate: formData.dueDate,
      assigneeIds: formData.assigneeIds,
    });
    showEditModal.value = false;
    editTargetOccurrence.value = null;
    await fetchOccurrences();
    taskTimelineRef.value?.fetchHistory();
  } catch (err: any) {
    console.error("Edit failed:", err);
    editError.value = err.data?.message || taskStore.error || 'Failed to save changes';
  } finally {
    isSubmittingEdit.value = false;
  }
};

const handleEditCancel = () => {
  showEditModal.value = false;
  editTargetOccurrence.value = null;
  editError.value = null;
};

// Task action functions
const pauseTask = async () => {
  // TODO: Implement pauseTask action in store and call it here
  try {
    // TODO: Implement pauseTask action in store and call it here
    // Placeholder: Direct API call for now, ideally move to store action
    await api.post(`/api/tasks/${taskId}/pause`, {});
    await taskStore.fetchTaskById(taskId); // Refetch task via store
    await fetchOccurrences(); // Refetch occurrences locally for now
  } catch (err) {
    console.error("Error pausing task:", err);
    // Rely on store error or add specific message
  }
};

const unpauseTask = async () => {
  // TODO: Implement unpauseTask action in store and call it here
  try {
    // Placeholder: Direct API call for now, ideally move to store action
    await api.post(`/api/tasks/${taskId}/unpause`, {});
    await taskStore.fetchTaskById(taskId); // Refetch task via store
    await fetchOccurrences(); // Refetch occurrences locally for now
  } catch (err) {
    console.error("Error unpausing task:", err);
    // Rely on store error or add specific message
  }
};

const deleteTask = async () => {
  try {
    if (!confirm('Are you sure you want to delete this task? This will remove all future occurrences.')) {
      return;
    }

    // TODO: Implement deleteTask action in store and call it here
    // Placeholder: Direct API call for now, ideally move to store action
    await api.delete(`/api/tasks/${taskId}`);
    // On successful deletion, navigate away
    router.push('/tasks');
  } catch (err) {
    console.error("Error deleting task:", err);
    // Rely on store error or add specific message
  }
};

// Removed local handleError function

const getCategoryName = (categoryId: string): string => {
  const category = categories.value.find(c => c.id === categoryId);
  return category ? category.name : 'Unknown';
};

// Navigation
const navigateToOccurrence = (occurrenceId: string) => {
  router.push(`/occurrences/${occurrenceId}`);
};

const formatDate = (date: Date | string): string => {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatStatus = (status: string | undefined | null): string => {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
};

const getStatusClass = (status: string): string => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'soft-deleted':
      return 'bg-red-100 text-red-800';
    case 'completed':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-stone-100 text-stone-800';
  }
};

const formatOccurrenceStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getOccurrenceStatusClass = (status: string): string => {
  switch (status) {
    case 'created':
      return 'bg-stone-100 text-stone-800';
    case 'assigned':
      return 'bg-amber-100 text-amber-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'skipped':
      return 'bg-yellow-100 text-yellow-800';
    case 'deleted':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-stone-100 text-stone-800';
  }
};


// Helper to get assignee names
const getAssigneeNames = (assigneeIds: string[] | undefined): string => {
  if (!assigneeIds || assigneeIds.length === 0) {
    return 'Unassigned';
  }
  if (loadingUsers.value) {
    return 'Loading...'; // Indicate users are still loading
  }
  // Removed debug logs from getAssigneeNames
  const names = assigneeIds
    .map(id => {
      const user = householdUsers.value.find(user => user.id === id);
      return user?.name;
    })
    .filter(name => !!name); // Filter out undefined names if user not found

  return names.length > 0 ? names.join(', ') : 'Unknown User(s)';
};

// Catch-up state
const showCatchUpModal = ref(false);
const catchUpModalRef = ref<any>(null);
const calculatedNextDueDate = ref<string | null>(null);

const openCatchUpModal = async () => {
  try {
    const preview = await api.get<{ calculatedNextDueDate: string | null }>(`/api/tasks/${taskId}/catch-up-preview`);
    calculatedNextDueDate.value = preview.calculatedNextDueDate;
  } catch {
    calculatedNextDueDate.value = null;
  }
  showCatchUpModal.value = true;
};

const hasOverdueOccurrences = computed(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return occurrences.value.some(occ => {
    const dueDate = new Date(occ.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return (occ.status === 'created' || occ.status === 'assigned') && dueDate < now;
  });
});

const overdueOccurrenceCount = computed(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return occurrences.value.filter(occ => {
    const dueDate = new Date(occ.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return (occ.status === 'created' || occ.status === 'assigned') && dueDate < now;
  }).length;
});

const handleCatchUp = async (payload: { comment: string; overrideNextDueDate?: string }) => {
  try {
    const result = await api.post<{ occurrencesSkipped: number; newDueDate: string | null }>(
      `/api/tasks/${taskId}/catch-up`,
      {
        comment: payload.comment || undefined,
        overrideNextDueDate: payload.overrideNextDueDate || undefined,
      }
    );

    showCatchUpModal.value = false;
    catchUpModalRef.value?.reset();

    // Refresh data
    await Promise.all([
      taskStore.fetchTaskById(taskId),
      fetchOccurrences(),
    ]);
    taskTimelineRef.value?.fetchHistory();

    toast.success(`Caught up — ${result.occurrencesSkipped} occurrence${result.occurrencesSkipped !== 1 ? 's' : ''} skipped.${result.newDueDate ? ' Next due: ' + new Date(result.newDueDate).toLocaleDateString() : ''}`);
  } catch (err: any) {
    console.error('Error catching up task:', err);
    toast.error(err.data?.message || 'Failed to catch up task');
    catchUpModalRef.value?.reset();
  }
};

</script>
