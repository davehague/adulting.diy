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
      <div class="flex justify-between items-start mb-6">
        <div>
          <h1 class="font-heading text-2xl font-bold text-stone-900">{{ task.name }}</h1>
        </div>
        <div class="flex space-x-2">
          <button v-if="hasOverdueOccurrences" @click="showCatchUpModal = true"
            class="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700">
            Catch Up
          </button>
          <NuxtLink :to="`/tasks/${task.id}/edit`"
            class="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700">
            Edit Task
          </NuxtLink>
          <button v-if="task.metaStatus === 'active'" @click="pauseTask"
            class="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600">
            Pause Task
          </button>
          <button v-if="task.metaStatus === 'paused'" @click="unpauseTask"
            class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
            Unpause Task
          </button>
          <button v-if="task.metaStatus !== 'soft-deleted'" @click="deleteTask"
            class="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
            Delete Task
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
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"
                    @click.stop>
                  <NuxtLink :to="`/occurrences/${occurrence.id}`" class="text-amber-700 hover:text-amber-900" title="View">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>

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
        @confirm="handleCatchUp"
        @cancel="showCatchUpModal = false"
      />

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
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '@/utils/api'; // Keep for categories/occurrences for now
import { useTaskStore } from '@/stores/tasks';
import type { TaskDefinition, TaskOccurrence, Category, User } from '@/types'; // Add User type

const route = useRoute();
const router = useRouter();
const api = useApi();
const taskStore = useTaskStore();

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

const handleCatchUp = async (comment: string) => {
  try {
    const result = await api.post<{ occurrencesSkipped: number; newDueDate: string | null }>(
      `/api/tasks/${taskId}/catch-up`,
      { comment: comment || undefined }
    );

    showCatchUpModal.value = false;
    catchUpModalRef.value?.reset();

    // Refresh data
    await Promise.all([
      taskStore.fetchTaskById(taskId),
      fetchOccurrences(),
    ]);
    taskTimelineRef.value?.fetchHistory();

    alert(`Caught up — ${result.occurrencesSkipped} occurrence${result.occurrencesSkipped !== 1 ? 's' : ''} skipped.${result.newDueDate ? ' Next due: ' + new Date(result.newDueDate).toLocaleDateString() : ''}`);
  } catch (err: any) {
    console.error('Error catching up task:', err);
    alert(err.data?.message || 'Failed to catch up task');
    catchUpModalRef.value?.reset();
  }
};

</script>
