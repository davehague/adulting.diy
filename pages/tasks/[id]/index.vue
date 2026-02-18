<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Skeleton Loader -->
    <div v-if="loading" class="animate-pulse">
      <!-- Header skeleton -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div class="h-8 bg-stone-200 rounded w-64"></div>
        <div class="flex flex-wrap gap-2">
          <div class="h-8 bg-stone-200 rounded-lg w-20"></div>
          <div class="h-8 bg-stone-200 rounded-lg w-24"></div>
          <div class="h-8 bg-stone-200 rounded-lg w-24"></div>
        </div>
      </div>

      <!-- Task Details card skeleton -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-6 mb-6">
        <div class="flex justify-between items-start mb-4">
          <div class="h-6 bg-stone-200 rounded w-32"></div>
          <div class="flex gap-2">
            <div class="h-5 bg-stone-200 rounded w-16"></div>
            <div class="h-5 bg-stone-200 rounded-full w-20"></div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <div><div class="h-3 bg-stone-100 rounded w-16 mb-1"></div><div class="h-4 bg-stone-200 rounded w-48"></div></div>
            <div><div class="h-3 bg-stone-100 rounded w-14 mb-1"></div><div class="h-4 bg-stone-200 rounded w-20"></div></div>
            <div><div class="h-3 bg-stone-100 rounded w-20 mb-1"></div><div class="h-4 bg-stone-200 rounded w-28"></div></div>
            <div><div class="h-3 bg-stone-100 rounded w-24 mb-1"></div><div class="h-4 bg-stone-200 rounded w-64"></div></div>
            <div><div class="h-3 bg-stone-100 rounded w-28 mb-1"></div><div class="h-4 bg-stone-200 rounded w-36"></div></div>
          </div>
          <div class="space-y-4">
            <div><div class="h-3 bg-stone-100 rounded w-24 mb-1"></div><div class="h-4 bg-stone-200 rounded w-40"></div></div>
            <div><div class="h-3 bg-stone-100 rounded w-20 mb-1"></div><div class="h-4 bg-stone-200 rounded w-32"></div></div>
            <div><div class="h-3 bg-stone-100 rounded w-16 mb-1"></div><div class="h-4 bg-stone-200 rounded w-36"></div></div>
          </div>
        </div>
      </div>

      <!-- Occurrences section skeleton -->
      <div class="mb-6">
        <div class="h-6 bg-stone-200 rounded w-28 mb-4"></div>
        <div class="bg-white rounded-xl shadow-sm border border-stone-200">
          <div class="hidden md:block">
            <table class="min-w-full divide-y divide-stone-200">
              <thead class="bg-stone-50">
                <tr>
                  <th class="px-6 py-3"><div class="h-3 bg-stone-200 rounded w-16"></div></th>
                  <th class="px-6 py-3"><div class="h-3 bg-stone-200 rounded w-12"></div></th>
                  <th class="px-6 py-3"><div class="h-3 bg-stone-200 rounded w-16"></div></th>
                  <th class="px-6 py-3"><div class="h-3 bg-stone-200 rounded w-14"></div></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-200">
                <tr v-for="i in 4" :key="i">
                  <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-24"></div></td>
                  <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-16"></div></td>
                  <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-20"></div></td>
                  <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-5 ml-auto"></div></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="md:hidden divide-y divide-stone-100">
            <div v-for="i in 4" :key="i" class="p-4">
              <div class="flex justify-between mb-1"><div class="h-4 bg-stone-200 rounded w-28"></div><div class="h-4 bg-stone-200 rounded w-16"></div></div>
              <div class="h-3 bg-stone-100 rounded w-24 mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline skeleton -->
      <div>
        <div class="h-5 bg-stone-200 rounded w-20 mb-3"></div>
        <div class="space-y-3">
          <div class="flex gap-3"><div class="h-8 w-8 bg-stone-200 rounded-full flex-shrink-0"></div><div class="h-12 bg-stone-100 rounded w-full"></div></div>
          <div class="flex gap-3"><div class="h-8 w-8 bg-stone-200 rounded-full flex-shrink-0"></div><div class="h-12 bg-stone-100 rounded w-full"></div></div>
        </div>
      </div>
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
        :former-members="formerMembers"
        class="mb-6"
      />

      <!-- Occurrences Section -->
      <div class="mb-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="font-heading text-xl font-semibold text-stone-900">Occurrences</h2>
        </div>

        <!-- Occurrences Loading -->
        <div v-if="loadingOccurrences" class="text-center py-4">
          <p class="text-stone-600">Loading occurrences...</p>
        </div>

        <!-- Empty State for Occurrences -->
        <div v-else-if="!filteredOccurrences.length" class="bg-white rounded-xl shadow-sm border border-stone-200 p-6 text-center">
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
        <div v-else class="bg-white rounded-xl shadow-sm border border-stone-200">
          <!-- Mobile occurrence cards -->
          <div class="md:hidden divide-y divide-stone-100">
            <div v-for="occurrence in filteredOccurrences" :key="'m-' + occurrence.id"
                 @click="navigateToOccurrence(occurrence.id)"
                 class="p-4 cursor-pointer hover:bg-stone-50 transition-colors">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-stone-900">{{ formatDate(occurrence.dueDate) }}</span>
                <span class="inline-flex items-center gap-1 text-xs text-stone-600">
                  <CirclePlay v-if="occurrence.status === 'created' || occurrence.status === 'assigned'" :size="14" />
                  <CircleCheck v-else-if="occurrence.status === 'completed'" :size="14" />
                  <SkipForward v-else-if="occurrence.status === 'skipped'" :size="14" />
                  <Trash2 v-else-if="occurrence.status === 'deleted'" :size="14" />
                  {{ displayStatus(occurrence.status) }}
                </span>
              </div>
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-stone-500">
                  <template v-if="getAssigneeNames(occurrence.assigneeIds).length === 0">Unassigned</template>
                  <template v-for="(assignee, idx) in getAssigneeNames(occurrence.assigneeIds)" :key="idx">
                    <span :class="assignee.departed ? 'text-stone-400 italic' : ''">{{ assignee.name }}</span><span v-if="idx < getAssigneeNames(occurrence.assigneeIds).length - 1">, </span>
                  </template>
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
                      <button v-if="occurrence.status === 'assigned' || occurrence.status === 'created'" @click="handleEdit(occurrence)" class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">
                        <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button v-if="occurrence.status === 'assigned' || occurrence.status === 'created'" @click="handleExecute(occurrence.id)" class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">
                        <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Complete
                      </button>
                      <button v-if="occurrence.status === 'assigned' || occurrence.status === 'created'" @click="handleSkip(occurrence.id)" class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">
                        <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Skip
                      </button>
                      <div v-if="!['created', 'assigned'].includes(occurrence.status)" class="px-4 py-2 text-sm text-stone-500">No actions available</div>
                    </div>
                  </div>
                </div>
              </div>
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
              <tr v-for="occurrence in filteredOccurrences" :key="occurrence.id"
                  @click="navigateToOccurrence(occurrence.id)"
                  class="cursor-pointer hover:bg-stone-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-900">
                  {{ formatDate(occurrence.dueDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center gap-1.5 text-sm text-stone-600">
                    <CirclePlay v-if="occurrence.status === 'created' || occurrence.status === 'assigned'" :size="16" />
                    <CircleCheck v-else-if="occurrence.status === 'completed'" :size="16" />
                    <SkipForward v-else-if="occurrence.status === 'skipped'" :size="16" />
                    <Trash2 v-else-if="occurrence.status === 'deleted'" :size="16" />
                    {{ displayStatus(occurrence.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                  <template v-if="getAssigneeNames(occurrence.assigneeIds).length === 0">Unassigned</template>
                  <template v-for="(assignee, idx) in getAssigneeNames(occurrence.assigneeIds)" :key="idx">
                    <span :class="assignee.departed ? 'text-stone-400 italic' : ''">{{ assignee.name }}</span><span v-if="idx < getAssigneeNames(occurrence.assigneeIds).length - 1">, </span>
                  </template>
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
                          v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                          @click="handleEdit(occurrence)"
                          class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                        >
                          <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>

                        <button
                          v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                          @click="handleExecute(occurrence.id)"
                          class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                        >
                          <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Complete
                        </button>

                        <button
                          v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                          @click="handleSkip(occurrence.id)"
                          class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                        >
                          <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Skip
                        </button>
                        <div v-if="!['created', 'assigned'].includes(occurrence.status)" class="px-4 py-2 text-sm text-stone-500">No actions available</div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

        </div>
      </div>

      <!-- Task Activity Timeline -->
      <TaskTimeline ref="taskTimelineRef" :task-id="taskId" />

      <!-- Catch Up Modal -->
      <CatchUpModal
        ref="catchUpModalRef"
        :visible="showCatchUpModal"
        :task-name="task.name || ''"
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

      <!-- Pause Modal -->
      <PauseModal
        :show="showPauseModal"
        :disabled="isSubmittingPause"
        @confirm="handlePauseConfirm"
        @cancel="handlePauseCancel"
      />

      <!-- Delete Modal -->
      <DeleteModal
        :show="showDeleteModal"
        :disabled="isSubmittingDelete"
        @confirm="handleDeleteConfirm"
        @cancel="handleDeleteCancel"
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
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '@/utils/api'; // Keep for categories/occurrences for now
import { useTaskStore } from '@/stores/tasks';
import type { TaskDefinition, TaskOccurrence, Category, User } from '@/types';
import type { FormerHouseholdMember } from '@/types/user';
import CatchUpModal from '@/components/tasks/CatchUpModal.vue';
import TaskTimeline from '@/components/tasks/TaskTimeline.vue';
import { useToast } from '@/composables/useToast';
import SkipModal from '@/components/occurrences/SkipModal.vue';
import OccurrenceEditForm from '@/components/occurrences/OccurrenceEditForm.vue';
import DeleteModal from '@/components/tasks/DeleteModal.vue';
import PauseModal from '@/components/tasks/PauseModal.vue';
import { Pencil, Pause, Play, Trash2, FastForward, CirclePlay, CircleCheck, SkipForward } from 'lucide-vue-next';

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
const hideDeleted = ref(true);
const filteredOccurrences = computed(() => {
  const filtered = hideDeleted.value
    ? occurrences.value.filter(o => o.status !== 'deleted')
    : occurrences.value;
  return [...filtered].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
});
const categories = ref<Category[]>([]);
const householdUsers = ref<User[]>([]); // State for household users
const formerMembers = ref<FormerHouseholdMember[]>([]);
const loadingOccurrences = ref(true);
const loadingUsers = ref(false); // Add loading state for users
const taskTimelineRef = ref<InstanceType<typeof TaskTimeline> | null>(null);

// Dropdown state
const openDropdownId = ref<string | null>(null);

// Pause modal state
const showPauseModal = ref(false);
const isSubmittingPause = ref(false);

// Delete modal state
const showDeleteModal = ref(false);
const isSubmittingDelete = ref(false);

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
    const data = await api.get<{ members: User[], formerMembers: FormerHouseholdMember[] }>('/api/household/users');
    householdUsers.value = data.members;
    formerMembers.value = data.formerMembers;
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
const pauseTask = () => {
  showPauseModal.value = true;
};

const handlePauseConfirm = async () => {
  isSubmittingPause.value = true;
  try {
    await api.post(`/api/tasks/${taskId}/pause`, {});
    showPauseModal.value = false;
    await taskStore.fetchTaskById(taskId);
    await fetchOccurrences();
  } catch (err) {
    console.error("Error pausing task:", err);
  } finally {
    isSubmittingPause.value = false;
  }
};

const handlePauseCancel = () => {
  showPauseModal.value = false;
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

const deleteTask = () => {
  showDeleteModal.value = true;
};

const handleDeleteConfirm = async () => {
  isSubmittingDelete.value = true;
  try {
    await api.delete(`/api/tasks/${taskId}`);
    showDeleteModal.value = false;
    router.push('/tasks');
  } catch (err) {
    console.error("Error deleting task:", err);
  } finally {
    isSubmittingDelete.value = false;
  }
};

const handleDeleteCancel = () => {
  showDeleteModal.value = false;
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

const displayStatus = (status: string): string => {
  if (status === 'created' || status === 'assigned') return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
};




// Helper to get assignee names
const getAssigneeNames = (assigneeIds: string[] | undefined): { name: string; departed: boolean }[] => {
  if (!assigneeIds || assigneeIds.length === 0) return [];
  if (loadingUsers.value) return [{ name: 'Loading...', departed: false }];
  return assigneeIds.map(id => {
    const active = householdUsers.value.find(u => u.id === id);
    if (active) return { name: active.name, departed: false };
    const former = formerMembers.value.find(u => u.userId === id);
    if (former) return { name: former.name, departed: true };
    return { name: 'Unknown User', departed: false };
  });
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
