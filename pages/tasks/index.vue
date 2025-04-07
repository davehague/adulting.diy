<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Task List</h1>
      <NuxtLink to="/tasks/create" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
        Create Task
      </NuxtLink>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white rounded-lg shadow-md p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Status filter -->
        <div>
          <label for="statusFilter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select id="statusFilter" v-model="filters.status"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="soft-deleted">Deleted</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <!-- Category filter -->
        <div>
          <label for="categoryFilter" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select id="categoryFilter" v-model="filters.categoryId"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>

        <!-- Search -->
        <div>
          <label for="search" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input id="search" v-model="filters.search" type="text" placeholder="Search tasks..."
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
      </div>
    </div>

    <!-- Loading and Empty States -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-gray-600">Loading tasks...</p>
    </div>

    <div v-else-if="!tasks.length" class="bg-white rounded-lg shadow-md p-8 text-center">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">No tasks found</h2>
      <p class="text-gray-500 mb-4">
        {{
          filters.status || filters.categoryId || filters.search
            ? 'Try changing your filters or search term'
            : 'Create your first task to get started'
        }}
      </p>
      <NuxtLink to="/tasks/create" class="inline-block bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
        Create Your First Task
      </NuxtLink>
    </div>

    <!-- Task List -->
    <div v-else class="bg-white rounded-lg shadow-md overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Task
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Schedule
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="task in tasks" :key="task.id">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">{{ task.name }}</div>
              <div v-if="task.description" class="text-sm text-gray-500 truncate max-w-xs">
                {{ task.description }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                {{ getCategoryName(task.categoryId) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatSchedule(task.scheduleConfig) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                :class="getStatusClass(task.metaStatus)">
                {{ task.metaStatus.charAt(0).toUpperCase() + task.metaStatus.slice(1) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
              <NuxtLink :to="`/tasks/${task.id}`" class="text-blue-600 hover:text-blue-900">
                View
              </NuxtLink>

              <NuxtLink :to="`/tasks/${task.id}/edit`" class="text-green-600 hover:text-green-900">
                Edit
              </NuxtLink>

              <button v-if="task.metaStatus === 'active'" @click="pauseTask(task.id)"
                class="text-yellow-600 hover:text-yellow-900">
                Pause
              </button>

              <button v-if="task.metaStatus === 'paused'" @click="unpauseTask(task.id)"
                class="text-blue-600 hover:text-blue-900">
                Unpause
              </button>

              <button v-if="task.metaStatus !== 'soft-deleted'" @click="deleteTask(task.id)"
                class="text-red-600 hover:text-red-900">
                Delete
              </button>

              <NuxtLink :to="`/tasks/${task.id}/occurrences`" class="text-purple-600 hover:text-purple-900">
                Occurrences
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useApi } from '@/utils/api';
import { useTaskStore } from '@/stores/tasks';
import { useAuthStore } from '@/stores/auth'; // Import auth store
import type { TaskDefinition, Category } from '@/types';

const api = useApi(); // Keep for categories for now
const taskStore = useTaskStore();
const authStore = useAuthStore(); // Get auth store instance

// State
// Use computed properties to get state from the store
const loading = computed(() => taskStore.isLoading);
const tasks = computed(() => taskStore.tasks);
const error = computed(() => taskStore.error);

// Keep local state for categories filter
const categories = ref<Category[]>([]);

// Filters
const filters = reactive({
  status: '',
  categoryId: '',
  search: ''
});

// Load initial data
onMounted(async () => {
  // Fetch categories locally for the filter dropdown
  try {
    const categoriesData = await api.get<Category[]>('/api/categories');
    categories.value = categoriesData;
  } catch (err) {
    console.error('Error loading categories:', err);
    // Handle category loading error if needed
  }

  // Fetch initial tasks only after auth is ready
  watch(() => authStore.isReady, (ready) => {
    if (ready) {
      console.log('[Tasks Page] Auth ready, fetching tasks.');
      taskStore.fetchTasks(filters);
    }
  }, { immediate: true }); // immediate: true runs the watcher once on setup

  // Also handle the case where auth is already ready when component mounts
  if (authStore.isReady) {
    console.log('[Tasks Page] Auth already ready on mount, fetching tasks.');
    await taskStore.fetchTasks(filters);
  }
});

// Remove local fetchTasks function, store handles it

// Watch filters changes to refresh tasks via store action
// Watch filters changes, but only fetch if auth is ready
watch(filters, async (newFilters) => {
  if (authStore.isReady) {
    await taskStore.fetchTasks(newFilters);
  }
}, { deep: true });

// Helper functions
const getCategoryName = (categoryId: string): string => {
  const category = categories.value.find(c => c.id === categoryId);
  return category ? category.name : 'Unknown';
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

// Task actions
const pauseTask = async (taskId: string) => {
  // TODO: Implement pauseTask action in store and call it here
  try {
    // Placeholder: Direct API call for now, ideally move to store action
    await api.post(`/api/tasks/${taskId}/pause`, {}); // Pass empty object for data
    await taskStore.fetchTasks(filters); // Refetch tasks via store
  } catch (err) {
    console.error('Error pausing task:', err);
    // error.value = 'Failed to pause task. Please try again.'; // Store handles errors
  }
};

const unpauseTask = async (taskId: string) => {
  // TODO: Implement unpauseTask action in store and call it here
  try {
    // Placeholder: Direct API call for now, ideally move to store action
    await api.post(`/api/tasks/${taskId}/unpause`, {}); // Pass empty object for data
    await taskStore.fetchTasks(filters); // Refetch tasks via store
  } catch (err) {
    console.error('Error unpausing task:', err);
    // error.value = 'Failed to unpause task. Please try again.'; // Store handles errors
  }
};

const deleteTask = async (taskId: string) => {
  try {
    if (!confirm('Are you sure you want to delete this task? This will remove all future occurrences.')) {
      return;
    }

    // TODO: Implement deleteTask action in store and call it here
    // Placeholder: Direct API call for now, ideally move to store action
    await api.delete(`/api/tasks/${taskId}`);
    await taskStore.fetchTasks(filters); // Refetch tasks via store
  } catch (err) {
    console.error('Error deleting task:', err);
    // error.value = 'Failed to delete task. Please try again.'; // Store handles errors
  }
};

// Page metadata
definePageMeta({
});
</script>
