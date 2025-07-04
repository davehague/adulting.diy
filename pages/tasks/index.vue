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
          <tr v-for="task in tasks" :key="task.id" 
              @click="navigateToTask(task.id)"
              class="cursor-pointer hover:bg-gray-50 transition-colors">
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
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" 
                @click.stop>
              <div class="relative inline-block text-left">
                <button 
                  @click="toggleDropdown(task.id)"
                  class="text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="Actions"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                
                <div 
                  v-if="openDropdownId === task.id"
                  class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                >
                  <div class="py-1">
                    <NuxtLink
                      :to="`/tasks/${task.id}/edit`"
                      class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </NuxtLink>
                    
                    <NuxtLink
                      :to="`/tasks/${task.id}/occurrences`"
                      class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      View Occurrences
                    </NuxtLink>
                    
                    <button
                      v-if="task.metaStatus === 'active'"
                      @click="pauseTask(task.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pause Task
                    </button>
                    
                    <button
                      v-if="task.metaStatus === 'paused'"
                      @click="unpauseTask(task.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Unpause Task
                    </button>
                    
                    <div class="border-t border-gray-100"></div>
                    
                    <button
                      v-if="task.metaStatus !== 'soft-deleted'"
                      @click="deleteTask(task.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-red-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Task
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/utils/api';
import { useTaskStore } from '@/stores/tasks';
import { useAuthStore } from '@/stores/auth'; // Import auth store
import type { TaskDefinition, Category } from '@/types';

const api = useApi(); // Keep for categories for now
const taskStore = useTaskStore();
const authStore = useAuthStore(); // Get auth store instance
const router = useRouter();

// State
// Use computed properties to get state from the store
const loading = computed(() => taskStore.isLoading);
const tasks = computed(() => taskStore.tasks);
const error = computed(() => taskStore.error);

// Keep local state for categories filter
const categories = ref<Category[]>([]);

// Dropdown state
const openDropdownId = ref<string | null>(null);

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

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.relative')) {
      openDropdownId.value = null;
    }
  });

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

// Navigation
const navigateToTask = (taskId: string) => {
  router.push(`/tasks/${taskId}`);
};

// Dropdown management
const toggleDropdown = (taskId: string) => {
  openDropdownId.value = openDropdownId.value === taskId ? null : taskId;
};

// Close dropdown when clicking outside (will be added to existing onMounted)

// Close dropdown after action
const closeDropdown = () => {
  openDropdownId.value = null;
};

// Task actions
const pauseTask = async (taskId: string) => {
  closeDropdown();
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
  closeDropdown();
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
  closeDropdown();
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
