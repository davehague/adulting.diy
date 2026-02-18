<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-stone-900 font-heading">All Occurrences</h1>
        <p class="text-stone-600 mt-1">Manage all task occurrences across your household</p>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="flex flex-col gap-2 mb-6">
      <!-- Compact toolbar row -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Search input with icon -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            v-model="filters.search"
            type="text"
            placeholder="Search tasks..."
            class="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
          />
        </div>

        <!-- Status select -->
        <select
          v-model="filters.status"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[140px]"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="created">Created</option>
          <option value="assigned">Assigned</option>
          <option value="completed">Completed</option>
          <option value="skipped">Skipped</option>
        </select>

        <!-- Category select -->
        <select
          v-model="filters.categoryId"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[150px]"
        >
          <option value="">All Categories</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>

        <!-- Assignee select -->
        <select
          v-model="filters.assigneeId"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[140px]"
        >
          <option value="">All Assignees</option>
          <option v-for="user in householdUsers" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>

        <!-- Date filter toggle button -->
        <button
          @click="showDateFilters = !showDateFilters"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors"
          :class="showDateFilters || filters.dueDateFrom || filters.dueDateTo
            ? 'bg-amber-50 border-amber-300 text-amber-700'
            : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'"
        >
          <SlidersHorizontal :size="16" />
          <span class="hidden sm:inline">Dates</span>
        </button>
      </div>

      <!-- Date range row (collapsible) -->
      <div v-if="showDateFilters" class="flex flex-wrap items-center gap-2">
        <div class="relative">
          <input
            v-model="filters.dueDateFrom"
            type="date"
            class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
          />
        </div>
        <span class="text-stone-400 text-sm">to</span>
        <div class="relative">
          <input
            v-model="filters.dueDateTo"
            type="date"
            class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
          />
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="activeFilterCount > 0" class="flex items-center gap-2 flex-wrap">
        <span
          v-if="filters.status && filters.status !== 'pending'"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Status: {{ filters.status.charAt(0).toUpperCase() + filters.status.slice(1) }}
          <button @click="clearFilter('status')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.categoryId"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {{ categories.find(c => c.id === filters.categoryId)?.name || 'Category' }}
          <button @click="clearFilter('categoryId')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.assigneeId"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {{ householdUsers.find(u => u.id === filters.assigneeId)?.name || 'Assignee' }}
          <button @click="clearFilter('assigneeId')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.search"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Search: "{{ filters.search }}"
          <button @click="clearFilter('search')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.dueDateFrom"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          From: {{ filters.dueDateFrom }}
          <button @click="clearFilter('dueDateFrom')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.dueDateTo"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          To: {{ filters.dueDateTo }}
          <button @click="clearFilter('dueDateTo')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <button
          @click="clearFilters"
          class="text-xs text-stone-500 hover:text-stone-700 transition-colors"
        >
          Clear all
        </button>
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
      <NuxtLink to="/tasks" class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
        <Plus :size="16" />
        Go to Tasks
      </NuxtLink>
    </div>

    <!-- Occurrence List -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-stone-200">
      <!-- Mobile card list -->
      <div class="md:hidden divide-y divide-stone-100">
        <div v-for="occurrence in occurrences" :key="'m-' + occurrence.id"
             @click="navigateToOccurrence(occurrence.id)"
             class="p-4 cursor-pointer hover:bg-stone-50 transition-colors">
          <div class="flex items-start justify-between mb-2">
            <div class="text-sm font-medium text-stone-900 flex-1 min-w-0 mr-2">{{ occurrence.task?.name || 'Unknown Task' }}</div>
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full flex-shrink-0"
              :class="getStatusClass(occurrence.status)">
              {{ occurrence.status.charAt(0).toUpperCase() + occurrence.status.slice(1) }}
            </span>
          </div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
              {{ getCategoryName(occurrence.task?.category) }}
            </span>
          </div>
          <div class="flex items-center justify-between mb-1">
            <div class="text-sm">
              <span :class="{ 'text-red-600 font-semibold': isOverdue(occurrence.dueDate), 'text-stone-600': !isOverdue(occurrence.dueDate) }">
                {{ formatDate(occurrence.dueDate) }}
              </span>
              <span v-if="isOverdue(occurrence.dueDate) && ['created', 'assigned'].includes(occurrence.status)" class="text-xs text-red-500 ml-1">Overdue</span>
            </div>
            <div class="relative" @click.stop>
              <button @click="toggleDropdown(occurrence.id)" class="text-stone-400 hover:text-stone-600 p-1" title="Actions">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              <div v-if="openDropdownId === occurrence.id"
                class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                <div class="py-1">
                  <button v-if="['created', 'assigned'].includes(occurrence.status)" @click="editOccurrence(occurrence)" class="block w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-stone-100">Edit</button>
                  <button v-if="['created', 'assigned'].includes(occurrence.status)" @click="executeOccurrence(occurrence.id)" class="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-stone-100">Complete</button>
                  <button v-if="['created', 'assigned'].includes(occurrence.status)" @click="skipOccurrence(occurrence.id, occurrence)" class="block w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-stone-100">Skip</button>
                  <div v-if="!['created', 'assigned'].includes(occurrence.status)" class="px-4 py-2 text-sm text-stone-500">No actions available</div>
                </div>
              </div>
            </div>
          </div>
          <div class="text-xs text-stone-500">
            <template v-if="occurrence.assigneeIds && occurrence.assigneeIds.length > 0">
              {{ getAssigneeNames(occurrence.assigneeIds).join(', ') }}
            </template>
            <span v-else class="italic">Unassigned</span>
          </div>
        </div>
      </div>
      <!-- Desktop table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="min-w-full divide-y divide-stone-200">
          <thead class="bg-stone-50">
            <tr>
              <th scope="col" @click="toggleSort('taskName')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Task
                  <ChevronUp v-if="sortColumn === 'taskName' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'taskName' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" @click="toggleSort('category')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Category
                  <ChevronUp v-if="sortColumn === 'category' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'category' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" @click="toggleSort('dueDate')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Due Date
                  <ChevronUp v-if="sortColumn === 'dueDate' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'dueDate' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Assignee(s)
              </th>
              <th scope="col" @click="toggleSort('status')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Status
                  <ChevronUp v-if="sortColumn === 'status' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'status' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">
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
import { Plus, Search, X, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-vue-next';
import type { TaskOccurrence, Category, User } from '@/types';

const api = useApi();
const authStore = useAuthStore();
const router = useRouter();

// State
const loading = ref(false);
const rawOccurrences = ref<TaskOccurrence[]>([]);
const categories = ref<Category[]>([]);
const householdUsers = ref<User[]>([]);
// Sort state (replaces sortBy dropdown)
const sortColumn = ref<string>('dueDate');
const sortDirection = ref<'asc' | 'desc'>('asc');

const toggleSort = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
};

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

// Date filter panel toggle
const showDateFilters = ref(false);

const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.status && filters.status !== 'pending') count++; // pending is default, don't count it
  if (filters.categoryId) count++;
  if (filters.assigneeId) count++;
  if (filters.search) count++;
  if (filters.dueDateFrom) count++;
  if (filters.dueDateTo) count++;
  return count;
});

const clearFilters = () => {
  filters.status = 'pending';
  filters.categoryId = '';
  filters.assigneeId = '';
  filters.search = '';
  filters.dueDateFrom = '';
  filters.dueDateTo = '';
  showDateFilters.value = false;
};

const clearFilter = (key: keyof typeof filters) => {
  if (key === 'status') {
    filters.status = 'pending'; // Reset to default, not empty
  } else {
    filters[key] = '';
  }
};

// Computed properties
const hasActiveFilters = computed(() => {
  return Object.values(filters).some(value => value !== '');
});

const occurrences = computed(() => {
  const sorted = [...rawOccurrences.value];

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn.value) {
      case 'dueDate':
        cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        break;
      case 'taskName':
        cmp = (a.task?.name || '').localeCompare(b.task?.name || '');
        break;
      case 'category':
        cmp = getCategoryName(a.task?.category).localeCompare(getCategoryName(b.task?.category));
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      default:
        break;
    }
    return sortDirection.value === 'desc' ? -cmp : cmp;
  });

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
