<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-stone-900 font-heading">All Occurrences</h1>
        <p class="text-stone-600 mt-1">Manage all task occurrences across your household</p>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Status filter -->
        <div>
          <label for="statusFilter" class="block text-sm font-medium text-stone-700 mb-1">Status</label>
          <select id="statusFilter" v-model="filters.status"
            class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
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
          <label for="categoryFilter" class="block text-sm font-medium text-stone-700 mb-1">Category</label>
          <select id="categoryFilter" v-model="filters.categoryId"
            class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>

        <!-- Assignee filter -->
        <div>
          <label for="assigneeFilter" class="block text-sm font-medium text-stone-700 mb-1">Assignee</label>
          <select id="assigneeFilter" v-model="filters.assigneeId"
            class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option value="">All Assignees</option>
            <option v-for="user in householdUsers" :key="user.id" :value="user.id">
              {{ user.name }}
            </option>
          </select>
        </div>

        <!-- Sort By -->
        <div>
          <label for="sortBy" class="block text-sm font-medium text-stone-700 mb-1">Sort By</label>
          <select id="sortBy" v-model="sortBy"
            class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option value="dueDate">Due Date</option>
            <option value="taskName">Task Name</option>
            <option value="category">Category</option>
            <option value="status">Status</option>
          </select>
        </div>

        <!-- Search -->
        <div>
          <label for="search" class="block text-sm font-medium text-stone-700 mb-1">Search</label>
          <input id="search" v-model="filters.search" type="text" placeholder="Search tasks..."
            class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
        </div>
      </div>

      <!-- Date Range Filters -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label for="dueDateFrom" class="block text-sm font-medium text-stone-700 mb-1">Due Date From</label>
          <input id="dueDateFrom" v-model="filters.dueDateFrom" type="date"
            class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
        </div>
        <div>
          <label for="dueDateTo" class="block text-sm font-medium text-stone-700 mb-1">Due Date To</label>
          <input id="dueDateTo" v-model="filters.dueDateTo" type="date"
            class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
        </div>
      </div>
    </div>

    <!-- Loading and Empty States -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-stone-600">Loading occurrences...</p>
    </div>

    <div v-else-if="!occurrences.length" class="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
      <h2 class="text-xl font-semibold text-stone-700 mb-2 font-heading">No occurrences found</h2>
      <p class="text-stone-500 mb-4">
        {{
          hasActiveFilters
            ? 'Try changing your filters or search term'
            : 'No task occurrences exist yet. Create some tasks to see occurrences here.'
        }}
      </p>
      <NuxtLink to="/tasks" class="inline-block bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700">
        Go to Tasks
      </NuxtLink>
    </div>

    <!-- Occurrence List -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-stone-200">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-stone-200">
          <thead class="bg-stone-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                Task
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                Category
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                Due Date
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                Assignee(s)
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-stone-200">
            <tr v-for="occurrence in occurrences" :key="occurrence.id"
                @click="navigateToOccurrence(occurrence.id)"
                class="cursor-pointer hover:bg-stone-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-stone-900">{{ occurrence.task?.name || 'Unknown Task' }}</div>
                <div v-if="occurrence.task?.description" class="text-sm text-stone-500 truncate max-w-xs">
                  {{ occurrence.task.description }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                  {{ getCategoryName(occurrence.task?.category) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-stone-900" :class="{ 'text-red-600 font-semibold': isOverdue(occurrence.dueDate) }">
                  {{ formatDate(occurrence.dueDate) }}
                </div>
                <div v-if="isOverdue(occurrence.dueDate) && ['created', 'assigned'].includes(occurrence.status)" 
                     class="text-xs text-red-500 font-medium">
                  Overdue
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div v-if="occurrence.assigneeIds && occurrence.assigneeIds.length > 0" class="text-sm text-stone-900">
                  {{ getAssigneeNames(occurrence.assigneeIds).join(', ') }}
                </div>
                <div v-else class="text-sm text-stone-500 italic">
                  Unassigned
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="getStatusClass(occurrence.status)">
                  {{ occurrence.status.charAt(0).toUpperCase() + occurrence.status.slice(1) }}
                </span>
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
                      <button
                        v-if="['created', 'assigned'].includes(occurrence.status)"
                        @click="editOccurrence(occurrence)"
                        class="group flex items-center w-full px-4 py-2 text-sm text-amber-700 hover:bg-stone-100"
                      >
                        <svg class="mr-3 h-4 w-4 text-amber-500 group-hover:text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>

                      <button
                        v-if="['created', 'assigned'].includes(occurrence.status)"
                        @click="executeOccurrence(occurrence.id)"
                        class="group flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-stone-100"
                      >
                        <svg class="mr-3 h-4 w-4 text-green-400 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Complete
                      </button>

                      <button
                        v-if="['created', 'assigned'].includes(occurrence.status)"
                        @click="skipOccurrence(occurrence.id, occurrence)"
                        class="group flex items-center w-full px-4 py-2 text-sm text-yellow-600 hover:bg-stone-100"
                      >
                        <svg class="mr-3 h-4 w-4 text-yellow-400 group-hover:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Skip
                      </button>

                      <div v-if="!['created', 'assigned'].includes(occurrence.status)" class="px-4 py-2 text-sm text-stone-500">
                        No actions available
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Skip Modal -->
    <SkipModal
      :show="showSkipModal"
      :is-variable-interval="skipTargetIsVariableInterval"
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import SkipModal from '@/components/occurrences/SkipModal.vue';
import OccurrenceEditForm from '@/components/occurrences/OccurrenceEditForm.vue';
import type { TaskOccurrence, Category, User } from '@/types';

const api = useApi();
const authStore = useAuthStore();
const router = useRouter();

// State
const loading = ref(false);
const rawOccurrences = ref<TaskOccurrence[]>([]);
const categories = ref<Category[]>([]);
const householdUsers = ref<User[]>([]);
const sortBy = ref('dueDate');

// Dropdown state
const openDropdownId = ref<string | null>(null);

// Skip modal state
const showSkipModal = ref(false);
const skipTargetId = ref<string | null>(null);
const skipTargetIsVariableInterval = ref(false);
const isSubmittingSkip = ref(false);

// Edit modal state
const showEditModal = ref(false);
const editTargetOccurrence = ref<TaskOccurrence | null>(null);
const isSubmittingEdit = ref(false);
const editError = ref<string | null>(null);

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

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.relative')) {
      openDropdownId.value = null;
    }
  });

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

// Navigation
const navigateToOccurrence = (occurrenceId: string) => {
  router.push(`/occurrences/${occurrenceId}`);
};

// Dropdown management
const toggleDropdown = (occurrenceId: string) => {
  openDropdownId.value = openDropdownId.value === occurrenceId ? null : occurrenceId;
};

const closeDropdown = () => {
  openDropdownId.value = null;
};

// Occurrence actions
const executeOccurrence = async (occurrenceId: string) => {
  closeDropdown();
  try {
    await api.post(`/api/occurrences/${occurrenceId}/execute`, {});
    await fetchOccurrences(); // Refresh the list
  } catch (err) {
    console.error('Error executing occurrence:', err);
    alert('Failed to complete occurrence. Please try again.');
  }
};

const skipOccurrence = (occurrenceId: string, occurrence: TaskOccurrence) => {
  closeDropdown();
  skipTargetId.value = occurrenceId;
  skipTargetIsVariableInterval.value = (occurrence.task?.scheduleConfig as any)?.type === 'variable_interval';
  showSkipModal.value = true;
};

const handleSkipConfirm = async (reason: string) => {
  if (!skipTargetId.value) return;
  isSubmittingSkip.value = true;
  try {
    await api.post(`/api/occurrences/${skipTargetId.value}/skip`, { reason });
    showSkipModal.value = false;
    skipTargetId.value = null;
    await fetchOccurrences();
  } catch (err) {
    console.error('Error skipping occurrence:', err);
    alert('Failed to skip occurrence. Please try again.');
  } finally {
    isSubmittingSkip.value = false;
  }
};

const handleSkipCancel = () => {
  showSkipModal.value = false;
  skipTargetId.value = null;
};

const editOccurrence = (occurrence: TaskOccurrence) => {
  closeDropdown();
  editTargetOccurrence.value = occurrence;
  showEditModal.value = true;
};

const handleEditSubmit = async (formData: { dueDate: string; assigneeIds: string[] }) => {
  if (!editTargetOccurrence.value) return;
  isSubmittingEdit.value = true;
  editError.value = null;
  try {
    await api.put(`/api/occurrences/${editTargetOccurrence.value.id}`, {
      dueDate: formData.dueDate,
      assigneeIds: formData.assigneeIds,
    });
    showEditModal.value = false;
    editTargetOccurrence.value = null;
    await fetchOccurrences();
  } catch (err: any) {
    console.error("Edit failed:", err);
    editError.value = 'Failed to save changes. Please try again.';
  } finally {
    isSubmittingEdit.value = false;
  }
};

const handleEditCancel = () => {
  showEditModal.value = false;
  editTargetOccurrence.value = null;
  editError.value = null;
};

// Page metadata
definePageMeta({
  title: 'All Occurrences'
});
</script>
