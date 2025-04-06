<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-gray-600">Loading task details...</p>
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      <p>{{ error }}</p>
      <div class="mt-2">
        <NuxtLink to="/tasks" class="text-blue-600 hover:text-blue-800">
          Return to task list
        </NuxtLink>
      </div>
    </div>

    <!-- Task Details -->
    <div v-else class="mb-8">
      <div class="flex justify-between items-start mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ task.name }}</h1>
          <div class="flex items-center mt-2">
            <span class="px-2 py-1 text-xs font-semibold rounded-full mr-2" :class="getStatusClass(task.meta_status)">
              {{ formatStatus(task.meta_status) }}
            </span>
            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
              {{ getCategoryName(task.category_id) }}
            </span>
          </div>
        </div>
        <div class="flex space-x-2">
          <NuxtLink :to="`/tasks/${task.id}/edit`"
            class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
            Edit Task
          </NuxtLink>
          <button v-if="task.meta_status === 'active'" @click="pauseTask"
            class="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600">
            Pause Task
          </button>
          <button v-if="task.meta_status === 'paused'" @click="unpauseTask"
            class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
            Unpause Task
          </button>
          <button v-if="task.meta_status !== 'soft-deleted'" @click="deleteTask"
            class="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
            Delete Task
          </button>
        </div>
      </div>

      <!-- Task Content -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 class="text-lg font-semibold mb-3">Task Details</h2>

            <div v-if="task.description" class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-1">Description</h3>
              <p class="text-gray-800">{{ task.description }}</p>
            </div>

            <div v-if="task.instructions" class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-1">Instructions</h3>
              <p class="text-gray-800 whitespace-pre-line">{{ task.instructions }}</p>
            </div>

            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-1">Default Assignees</h3>
              <p class="text-gray-800">
                {{ task.default_assignee_ids?.length ? 'Has default assignees' : 'No default assignees' }}
              </p>
            </div>
          </div>

          <div>
            <h2 class="text-lg font-semibold mb-3">Schedule</h2>

            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-1">Schedule Type</h3>
              <p class="text-gray-800">{{ formatSchedule(task.schedule_config) }}</p>
            </div>

            <div v-if="task.reminder_config" class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-1">Reminders</h3>
              <ul class="list-disc pl-5 text-gray-800">
                <li v-if="task.reminder_config.initialReminder">
                  Initial: {{ task.reminder_config.initialReminder }} days before due date
                </li>
                <li v-if="task.reminder_config.followUpReminder">
                  Follow-up: {{ task.reminder_config.followUpReminder }} days before due date
                </li>
                <li v-if="task.reminder_config.overdueReminder">
                  Overdue: {{ task.reminder_config.overdueReminder }} days after due date
                </li>
              </ul>
            </div>

            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-1">Created</h3>
              <p class="text-gray-800">{{ formatDate(task.created_at) }}</p>
            </div>

            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-1">Last Updated</h3>
              <p class="text-gray-800">{{ formatDate(task.updated_at) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Occurrences Section -->
      <div class="mb-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Occurrences</h2>
          <NuxtLink :to="`/tasks/${task.id}/occurrences`" class="text-blue-600 hover:text-blue-800">
            View All Occurrences
          </NuxtLink>
        </div>

        <!-- Occurrences Loading -->
        <div v-if="loadingOccurrences" class="text-center py-4">
          <p class="text-gray-600">Loading occurrences...</p>
        </div>

        <!-- Empty State for Occurrences -->
        <div v-else-if="!occurrences.length" class="bg-white rounded-lg shadow-md p-6 text-center">
          <h3 class="text-lg font-semibold text-gray-700 mb-2">No Occurrences</h3>
          <p class="text-gray-500 mb-4">
            {{
              task.meta_status === 'active'
                ? 'This task has no occurrences yet. They will be automatically generated based on the schedule.'
                : 'This task is not active, so no occurrences will be generated.'
            }}
          </p>
        </div>

        <!-- Occurrences List -->
        <div v-else class="bg-white rounded-lg shadow-md overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assignees
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="occurrence in occurrences.slice(0, 5)" :key="occurrence.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatDate(occurrence.dueDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="getOccurrenceStatusClass(occurrence.status)">
                    {{ formatOccurrenceStatus(occurrence.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ getAssigneeNames(occurrence.assigneeIds) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <NuxtLink :to="`/occurrences/${occurrence.id}`" class="text-blue-600 hover:text-blue-900">
                    View
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Show More Link if more than 5 occurrences -->
          <div v-if="occurrences.length > 5" class="px-6 py-3 bg-gray-50 text-right">
            <NuxtLink :to="`/tasks/${task.id}/occurrences`" class="text-blue-600 hover:text-blue-800">
              View all {{ occurrences.length }} occurrences
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Back to Tasks List -->
      <div class="mt-8">
        <NuxtLink to="/tasks" class="text-blue-600 hover:text-blue-800">
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
    // console.log('Fetched Household Users (Task Detail):', JSON.stringify(householdUsers.value)); // Optional debug log
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
  if (!status) return 'Unknown'; // Handle null/undefined
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
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatOccurrenceStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getOccurrenceStatusClass = (status: string): string => {
  switch (status) {
    case 'created':
      return 'bg-gray-100 text-gray-800';
    case 'assigned':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'skipped':
      return 'bg-yellow-100 text-yellow-800';
    case 'deleted':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatSchedule = (scheduleConfig: any): string => {
  if (!scheduleConfig) return 'No schedule';

  switch (scheduleConfig.type) {
    case 'once':
      return 'One time';
    case 'fixed_interval':
      return `Every ${scheduleConfig.interval} ${scheduleConfig.intervalUnit}${scheduleConfig.interval > 1 ? 's' : ''}`;
    case 'specific_days_of_week':
      const days = Object.entries(scheduleConfig.daysOfWeek || {})
        .filter(([_, enabled]) => enabled)
        .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(', ');
      return `Weekly on ${days}`;
    case 'specific_day_of_month':
      return `Monthly on day ${scheduleConfig.dayOfMonth}`;
    case 'specific_weekday_of_month':
      if (scheduleConfig.weekdayOfMonth) {
        const { occurrence, weekday } = scheduleConfig.weekdayOfMonth;
        return `${occurrence.charAt(0).toUpperCase() + occurrence.slice(1)} ${weekday.charAt(0).toUpperCase() + weekday.slice(1)} of each month`;
      }
      return 'Monthly';
    case 'variable_interval':
      if (scheduleConfig.variableInterval) {
        const { interval, unit } = scheduleConfig.variableInterval;
        return `${interval} ${unit}${interval > 1 ? 's' : ''} after completion`;
      }
      return 'Variable schedule';
    default:
      return 'Custom schedule';
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
  const names = assigneeIds
    .map(id => householdUsers.value.find(user => user.id === id)?.name)
    .filter(name => !!name); // Filter out undefined names if user not found

  return names.length > 0 ? names.join(', ') : 'Unknown User(s)';
};

</script>
