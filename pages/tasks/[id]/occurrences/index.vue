<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Loading and Error States -->
    <div v-if="loadingTask" class="text-center py-8">
      <p class="text-gray-600">Loading task details...</p>
    </div>
    <div v-else-if="errorTask" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      <p>{{ errorTask }}</p>
      <div class="mt-2">
        <NuxtLink to="/tasks" class="text-blue-600 hover:text-blue-800">
          Return to task list
        </NuxtLink>
      </div>
    </div>

    <!-- Page Header -->
    <div v-if="task" class="mb-6">
      <NuxtLink :to="`/tasks/${taskId}`" class="text-blue-600 hover:text-blue-800 mb-2 block">
        &larr; Back to Task: {{ task.name }}
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">Occurrences for: {{ task.name }}</h1>
      <p v-if="task.category" class="text-gray-600 mt-1">Category: {{ task.category.name }}</p>
    </div>

    <!-- Occurrences Loading and Error -->
    <div v-if="loadingOccurrences" class="text-center py-8">
      <p class="text-gray-600">Loading occurrences...</p>
    </div>
    <div v-else-if="errorOccurrences"
      class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
      <p>{{ errorOccurrences }}</p>
    </div>

    <!-- Empty State for Occurrences -->
    <div v-else-if="!occurrences.length" class="bg-white rounded-lg shadow-md p-8 text-center">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">No Occurrences Found</h2>
      <p class="text-gray-500">
        There are currently no occurrences listed for this task.
      </p>
    </div>

    <!-- Occurrences List Table -->
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
          <tr v-for="occurrence in occurrences" :key="occurrence.id"
              @click="navigateToOccurrence(occurrence.id)"
              class="cursor-pointer hover:bg-gray-50 transition-colors">
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
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                @click.stop>
              <div class="relative inline-block text-left">
                <button 
                  @click="toggleDropdown(occurrence.id)"
                  class="text-gray-400 hover:text-gray-600 focus:outline-none"
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
                      v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                      @click="handleExecute(occurrence.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-green-400 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Complete
                    </button>
                    
                    <button
                      v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                      @click="handleSkip(occurrence.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-yellow-600 hover:bg-gray-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-yellow-400 group-hover:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Skip
                    </button>
                    
                    <div v-if="!(occurrence.status === 'assigned' || occurrence.status === 'created')" class="px-4 py-2 text-sm text-gray-500">
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
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // Import useRouter
import { useApi } from '@/utils/api';
import { useTaskStore } from '@/stores/tasks';
import type { TaskDefinition, TaskOccurrence, User } from '@/types'; // Add User type

const route = useRoute();
const router = useRouter(); // Get router instance
const api = useApi();
const taskStore = useTaskStore();

// Task ID from route params
const taskId = route.params.id as string;

// State
const occurrences = ref<TaskOccurrence[]>([]);
const loadingTask = ref(true); // Separate loading for parent task
const loadingOccurrences = ref(true);
const errorTask = ref('');
const householdUsers = ref<User[]>([]); // State for household users
const loadingUsers = ref(false);
const errorUsers = ref('');
const errorOccurrences = ref('');

// Dropdown state
const openDropdownId = ref<string | null>(null);

// Fetch parent task details (for name/category display)
const task = computed(() => taskStore.selectedTask);

onMounted(async () => {
  // Fetch parent task first
  loadingTask.value = true;
  errorTask.value = '';
  try {
    // Use store if task might already be loaded, otherwise fetch directly
    // Clear any previous store error before fetching
    taskStore.error = '';
    if (taskStore.selectedTask?.id !== taskId) {
      await taskStore.fetchTaskById(taskId);
    }
    // Check for an error *after* the fetch attempt
    if (taskStore.error) {
      throw new Error(taskStore.error); // Throw if the fetch itself failed
    }

    // If task fetch succeeded, immediately try fetching users and occurrences
    // Removed log
    await Promise.all([
      fetchHouseholdUsers(),
      fetchOccurrences()
    ]);
  } catch (err: any) {
    console.error('Error loading parent task:', err);
    errorTask.value = err.message || 'Failed to load parent task details.';
  } finally {
    loadingTask.value = false;
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.relative')) {
      openDropdownId.value = null;
    }
  });

  // Removed the separate if block, fetch is now attempted within the try block above
});

// Fetch task occurrences
const fetchOccurrences = async () => {
  try {
    loadingOccurrences.value = true;
    errorOccurrences.value = '';
    const occurrencesData = await api.get<TaskOccurrence[]>(`/api/tasks/${taskId}/occurrences`);
    occurrences.value = occurrencesData;
  } catch (err: any) {
    console.error('Error loading occurrences:', err);
    errorOccurrences.value = err.data?.message || 'Failed to load occurrences for this task.';
  } finally {
    loadingOccurrences.value = false;
  }
};

// Fetch household users
const fetchHouseholdUsers = async () => {
  try {
    loadingUsers.value = true;
    errorUsers.value = '';
    const usersData = await api.get<User[]>('/api/household/users');
    householdUsers.value = usersData;
    // Removed log
  } catch (err: any) {
    console.error('Error loading household users:', err);
    errorUsers.value = err.data?.message || 'Failed to load household users.';
    // Optionally display this error somewhere
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

// Action handlers using the store
const handleExecute = async (occurrenceId: string) => {
  closeDropdown();
  try {
    await taskStore.executeOccurrence(occurrenceId);
    // Refetch occurrences after successful execution
    await fetchOccurrences();
  } catch (err) {
    // Error is handled/displayed via the store's error state
    console.error("Execute failed:", err);
    // Optionally show a notification to the user
    alert(`Error executing occurrence: ${taskStore.error || 'Unknown error'}`);
  }
};

const handleSkip = async (occurrenceId: string) => {
  closeDropdown();
  // Basic prompt for reason - replace with modal later
  const reason = prompt('Please enter a reason for skipping this occurrence:');
  if (reason && reason.trim() !== '') {
    try {
      await taskStore.skipOccurrence(occurrenceId, reason.trim());
      // Refetch occurrences after successful skip
      await fetchOccurrences();
    } catch (err) {
      // Error is handled/displayed via the store's error state
      console.error("Skip failed:", err);
      // Optionally show a notification to the user
      alert(`Error skipping occurrence: ${taskStore.error || 'Unknown error'}`);
    }
  } else if (reason !== null) { // Only show alert if prompt wasn't cancelled
    alert('A reason is required to skip an occurrence.');
  }
};

// Function for programmatic navigation
const navigateToOccurrence = (occurrenceId: string) => {
  if (!occurrenceId) {
    console.error("Cannot navigate: Occurrence ID is missing.");
    return;
  }
  console.log(`Navigating to /occurrences/${occurrenceId}`); // Add log
  router.push(`/occurrences/${occurrenceId}`);
};

// Helper to get assignee names
const getAssigneeNames = (assigneeIds: string[] | undefined): string => {
  if (!assigneeIds || assigneeIds.length === 0) {
    return 'Unassigned';
  }
  if (loadingUsers.value) {
    return 'Loading users...'; // Indicate users are still loading
  }
  // Removed log
  const names = assigneeIds
    .map(id => {
      const user = householdUsers.value.find(user => user.id === id);
      // Removed log
      return user?.name;
    })
    .filter(name => !!name); // Filter out undefined names if user not found

  return names.length > 0 ? names.join(', ') : 'Unknown User(s)';
};

// Helper functions (copied from Task View page, consider moving to utils)
const formatDate = (date: Date | string): string => {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    // hour: '2-digit', // Maybe remove time for list view?
    // minute: '2-digit'
  });
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

</script>
