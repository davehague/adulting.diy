<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">All Occurrences</h1>
        <p class="text-gray-600 mt-1">Manage all task occurrences across your household</p>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white rounded-lg shadow-md p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Status filter -->
        <div>
          <label for="statusFilter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select id="statusFilter" v-model="filters.status"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="">All Statuses</option>
            <option value="pending">Pending (Created/Assigned)</option>
            <option value="created">Created</option>
            <option value="assigned">Assigned</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
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

        <!-- Assignee filter -->
        <div>
          <label for="assigneeFilter" class="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
          <select id="assigneeFilter" v-model="filters.assigneeId"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="">All Assignees</option>
            <option v-for="user in householdUsers" :key="user.id" :value="user.id">
              {{ user.name }}
            </option>
          </select>
        </div>

        <!-- Sort By -->
        <div>
          <label for="sortBy" class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
          <select id="sortBy" v-model="sortBy"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="dueDate">Due Date</option>
            <option value="taskName">Task Name</option>
            <option value="category">Category</option>
            <option value="status">Status</option>
          </select>
        </div>

        <!-- Search -->
        <div>
          <label for="search" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input id="search" v-model="filters.search" type="text" placeholder="Search tasks..."
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
      </div>

      <!-- Date Range Filters -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label for="dueDateFrom" class="block text-sm font-medium text-gray-700 mb-1">Due Date From</label>
          <input id="dueDateFrom" v-model="filters.dueDateFrom" type="date"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label for="dueDateTo" class="block text-sm font-medium text-gray-700 mb-1">Due Date To</label>
          <input id="dueDateTo" v-model="filters.dueDateTo" type="date"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
      </div>
    </div>

    <!-- Loading and Empty States -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-gray-600">Loading occurrences...</p>
    </div>

    <div v-else-if="!occurrences.length" class="bg-white rounded-lg shadow-md p-8 text-center">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">No occurrences found</h2>
      <p class="text-gray-500 mb-4">
        {{
          hasActiveFilters
            ? 'Try changing your filters or search term'
            : 'No task occurrences exist yet. Create some tasks to see occurrences here.'
        }}
      </p>
      <NuxtLink to="/tasks" class="inline-block bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
        Go to Tasks
      </NuxtLink>
    </div>

    <!-- Occurrence List -->
    <div v-else class="bg-white rounded-lg shadow-md overflow-hidden">
      <div class="overflow-x-auto">
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
                Due Date
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assignee(s)
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
            <tr v-for="occurrence in occurrences" :key="occurrence.id">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ occurrence.task?.name || 'Unknown Task' }}</div>
                <div v-if="occurrence.task?.description" class="text-sm text-gray-500 truncate max-w-xs">
                  {{ occurrence.task.description }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {{ getCategoryName(occurrence.task?.category) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900" :class="{ 'text-red-600 font-semibold': isOverdue(occurrence.dueDate) }">
                  {{ formatDate(occurrence.dueDate) }}
                </div>
                <div v-if="isOverdue(occurrence.dueDate) && ['created', 'assigned'].includes(occurrence.status)" 
                     class="text-xs text-red-500 font-medium">
                  Overdue
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div v-if="occurrence.assigneeIds && occurrence.assigneeIds.length > 0" class="text-sm text-gray-900">
                  {{ getAssigneeNames(occurrence.assigneeIds).join(', ') }}
                </div>
                <div v-else class="text-sm text-gray-500 italic">
                  Unassigned
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="getStatusClass(occurrence.status)">
                  {{ occurrence.status.charAt(0).toUpperCase() + occurrence.status.slice(1) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <NuxtLink :to="`/occurrences/${occurrence.id}`" class="text-blue-600 hover:text-blue-900">
                  View
                </NuxtLink>

                <button v-if="['created', 'assigned'].includes(occurrence.status)" 
                        @click="executeOccurrence(occurrence.id)"
                        class="text-green-600 hover:text-green-900">
                  Complete
                </button>

                <button v-if="['created', 'assigned'].includes(occurrence.status)" 
                        @click="skipOccurrence(occurrence.id)"
                        class="text-yellow-600 hover:text-yellow-900">
                  Skip
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useApi } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import type { TaskOccurrence, Category, User } from '@/types';

const api = useApi();
const authStore = useAuthStore();

// State
const loading = ref(false);
const rawOccurrences = ref<TaskOccurrence[]>([]);
const categories = ref<Category[]>([]);
const householdUsers = ref<User[]>([]);
const sortBy = ref('dueDate');

// Filters - Default to showing only pending occurrences (created/assigned)
const filters = reactive({
  status: 'pending', // Default to pending (will be converted to created,assigned in API)
  categoryId: '',
  assigneeId: '',
  search: '',
  dueDateFrom: '',
  dueDateTo: ''
});

// Computed properties
const hasActiveFilters = computed(() => {
  return Object.values(filters).some(value => value !== '');
});

const occurrences = computed(() => {
  let sorted = [...rawOccurrences.value];
  
  switch (sortBy.value) {
    case 'dueDate':
      sorted.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      break;
    case 'taskName':
      sorted.sort((a, b) => (a.task?.name || '').localeCompare(b.task?.name || ''));
      break;
    case 'category':
      sorted.sort((a, b) => (a.task?.category?.name || '').localeCompare(b.task?.category?.name || ''));
      break;
    case 'status':
      sorted.sort((a, b) => a.status.localeCompare(b.status));
      break;
    default:
      break;
  }
  
  return sorted;
});

// Load initial data
onMounted(async () => {
  // Fetch categories for the filter dropdown
  try {
    const categoriesData = await api.get<Category[]>('/api/categories');
    categories.value = categoriesData;
  } catch (err) {
    console.error('Error loading categories:', err);
  }

  // Fetch household users for the assignee filter
  try {
    const usersData = await api.get<User[]>('/api/household/users');
    householdUsers.value = usersData;
  } catch (err) {
    console.error('Error loading household users:', err);
  }

  // Fetch initial occurrences only after auth is ready
  watch(() => authStore.isReady, (ready) => {
    if (ready) {
      console.log('[Occurrences Page] Auth ready, fetching occurrences.');
      fetchOccurrences();
    }
  }, { immediate: true });

  // Also handle the case where auth is already ready when component mounts
  if (authStore.isReady) {
    console.log('[Occurrences Page] Auth already ready on mount, fetching occurrences.');
    await fetchOccurrences();
  }
});

// Watch filters changes to refresh occurrences
watch(filters, async () => {
  if (authStore.isReady) {
    await fetchOccurrences();
  }
}, { deep: true });

// Fetch occurrences from API
const fetchOccurrences = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    
    // Handle special "pending" status filter
    if (filters.status === 'pending') {
      params.append('statusIn', 'created,assigned');
    } else if (filters.status) {
      params.append('status', filters.status);
    }
    
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
    if (filters.search) params.append('search', filters.search);
    if (filters.dueDateFrom) params.append('dueDateFrom', filters.dueDateFrom);
    if (filters.dueDateTo) params.append('dueDateTo', filters.dueDateTo);

    const queryString = params.toString();
    const url = `/api/occurrences${queryString ? '?' + queryString : ''}`;
    
    const data = await api.get<TaskOccurrence[]>(url);
    rawOccurrences.value = data;
  } catch (err) {
    console.error('Error loading occurrences:', err);
    rawOccurrences.value = [];
  } finally {
    loading.value = false;
  }
};

// Helper functions
const getCategoryName = (category: any): string => {
  if (category && category.name) {
    return category.name;
  }
  return 'Unknown';
};

const getAssigneeNames = (assigneeIds: string[]): string[] => {
  return assigneeIds.map(id => {
    const user = householdUsers.value.find(u => u.id === id);
    return user ? user.name : 'Unknown User';
  });
};

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const isOverdue = (dueDate: Date | string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

const getStatusClass = (status: string): string => {
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

// Occurrence actions
const executeOccurrence = async (occurrenceId: string) => {
  try {
    await api.post(`/api/occurrences/${occurrenceId}/execute`, {});
    await fetchOccurrences(); // Refresh the list
  } catch (err) {
    console.error('Error executing occurrence:', err);
    alert('Failed to complete occurrence. Please try again.');
  }
};

const skipOccurrence = async (occurrenceId: string) => {
  const reason = prompt('Please provide a reason for skipping this task:');
  if (!reason || reason.trim() === '') {
    return; // User cancelled or didn't provide a reason
  }

  try {
    await api.post(`/api/occurrences/${occurrenceId}/skip`, { reason: reason.trim() });
    await fetchOccurrences(); // Refresh the list
  } catch (err) {
    console.error('Error skipping occurrence:', err);
    alert('Failed to skip occurrence. Please try again.');
  }
};

// Page metadata
definePageMeta({
  title: 'All Occurrences'
});
</script>
