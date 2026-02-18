<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="font-heading text-2xl font-bold text-stone-900">Task List</h1>
      <NuxtLink to="/tasks/create" class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
        <Plus :size="16" /> Create Task
      </NuxtLink>
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
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="paused">Paused</option>
          <option value="soft-deleted">Deleted</option>
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
      </div>

      <!-- Active filter chips -->
      <div v-if="activeFilterCount > 0" class="flex items-center gap-2 flex-wrap">
        <span
          v-if="filters.status && filters.status !== 'active'"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Status: {{ filters.status.charAt(0).toUpperCase() + filters.status.slice(1) }}
          <button @click="clearFilter('status')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.categoryId"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {{ getCategoryName(filters.categoryId) }}
          <button @click="clearFilter('categoryId')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.search"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Search: "{{ filters.search }}"
          <button @click="clearFilter('search')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <button
          @click="clearFilters"
          class="text-xs text-stone-500 hover:text-stone-700 transition-colors"
        >
          Clear all
        </button>
      </div>
    </div>

    <!-- Skeleton Loader -->
    <div v-if="showSkeleton" class="bg-white rounded-xl shadow-sm border border-stone-200">
      <!-- Mobile skeleton -->
      <div class="md:hidden divide-y divide-stone-100">
        <div v-for="i in 5" :key="i" class="p-4 animate-pulse">
          <div class="flex items-start justify-between mb-2">
            <div class="h-4 bg-stone-200 rounded w-40"></div>
            <div class="h-4 bg-stone-200 rounded w-16"></div>
          </div>
          <div class="flex items-center gap-2 mb-2">
            <div class="h-5 bg-stone-200 rounded-full w-20"></div>
            <div class="h-4 bg-stone-200 rounded w-24"></div>
          </div>
          <div class="h-4 bg-stone-200 rounded w-28"></div>
        </div>
      </div>
      <!-- Desktop skeleton -->
      <div class="hidden md:block">
        <table class="min-w-full divide-y divide-stone-200">
          <thead class="bg-stone-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Task</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Category</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Schedule</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Next Due</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Assignee(s)</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-stone-200">
            <tr v-for="i in 6" :key="i" class="animate-pulse">
              <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-36"></div><div class="h-3 bg-stone-100 rounded w-48 mt-1"></div></td>
              <td class="px-6 py-4"><div class="h-5 bg-stone-200 rounded-full w-20"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-28"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-24"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-20"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-16"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-stone-200 rounded w-5 ml-auto"></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="!tasks.length" class="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
      <h2 class="font-heading text-xl font-semibold text-stone-700 mb-2">No tasks found</h2>
      <p class="text-stone-500 mb-4">
        {{
          activeFilterCount > 0
            ? 'Try changing your filters or search term'
            : 'Create your first task to get started'
        }}
      </p>
      <NuxtLink to="/tasks/create" class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
        <Plus :size="16" /> Create Your First Task
      </NuxtLink>
    </div>

    <!-- Task List -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-stone-200">
      <!-- Mobile card list -->
      <div class="md:hidden divide-y divide-stone-100">
        <div v-for="task in tasks" :key="'m-' + task.id"
             @click="navigateToTask(task.id)"
             class="p-4 cursor-pointer hover:bg-stone-50 transition-colors">
          <div class="flex items-start justify-between mb-2">
            <div class="text-sm font-medium text-stone-900 flex-1 min-w-0 mr-2">{{ task.name }}</div>
            <span class="inline-flex items-center gap-1 text-xs text-stone-600 flex-shrink-0">
              <CirclePlay v-if="task.metaStatus === 'active'" :size="14" />
              <Pause v-else-if="task.metaStatus === 'paused'" :size="14" />
              <Trash2 v-else-if="task.metaStatus === 'soft-deleted'" :size="14" />
              {{ formatMetaStatus(task.metaStatus) }}
            </span>
          </div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
              {{ getCategoryName(task.categoryId) }}
            </span>
            <span class="text-xs text-stone-500">{{ formatSchedule(task.scheduleConfig) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-sm">
              <template v-if="task.nextOccurrence">
                <span :class="{ 'text-red-600 font-semibold': isOverdue(task.nextOccurrence.dueDate), 'text-stone-600': !isOverdue(task.nextOccurrence.dueDate) }">
                  {{ formatDate(task.nextOccurrence.dueDate) }}
                </span>
                <span v-if="isOverdue(task.nextOccurrence.dueDate)" class="text-xs text-red-500 ml-1">Overdue</span>
              </template>
              <span v-else class="text-stone-400 italic">No due date</span>
            </div>
            <div class="relative" @click.stop>
              <button @click="toggleDropdown(task.id)" class="text-stone-400 hover:text-stone-600 p-1" title="Actions">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              <div v-if="openDropdownId === task.id"
                class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                <div class="py-1">
                  <NuxtLink :to="`/tasks/${task.id}/edit`" class="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Edit</NuxtLink>
                  <NuxtLink :to="`/tasks/${task.id}`" class="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">View Occurrences</NuxtLink>
                  <button v-if="task.metaStatus === 'active' && isTaskOverdue(task)" @click="openCatchUp(task)" class="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Catch Up</button>
                  <button v-if="task.metaStatus === 'active'" @click="pauseTask(task.id)" class="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Pause Task</button>
                  <button v-if="task.metaStatus === 'paused'" @click="unpauseTask(task.id)" class="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Unpause Task</button>
                  <div class="border-t border-stone-100"></div>
                  <button v-if="task.metaStatus !== 'soft-deleted'" @click="deleteTask(task.id)" class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-stone-100">Delete Task</button>
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
            <th scope="col" @click="toggleSort('name')"
              class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
              <span class="inline-flex items-center gap-1">
                Task
                <ChevronUp v-if="sortColumn === 'name' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                <ChevronDown v-else-if="sortColumn === 'name' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
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
            <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Schedule
            </th>
            <th scope="col" @click="toggleSort('nextDue')"
              class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
              <span class="inline-flex items-center gap-1">
                Next Due
                <ChevronUp v-if="sortColumn === 'nextDue' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                <ChevronDown v-else-if="sortColumn === 'nextDue' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
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
          <tr v-for="task in tasks" :key="task.id" 
              @click="navigateToTask(task.id)"
              class="cursor-pointer hover:bg-stone-50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-stone-900">{{ task.name }}</div>
              <div v-if="task.description" class="text-sm text-stone-500 truncate max-w-xs">
                {{ task.description }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                {{ getCategoryName(task.categoryId) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
              {{ formatSchedule(task.scheduleConfig) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <template v-if="task.nextOccurrence">
                <div class="text-sm text-stone-900" :class="{ 'text-red-600 font-semibold': isOverdue(task.nextOccurrence.dueDate) }">
                  {{ formatDate(task.nextOccurrence.dueDate) }}
                </div>
                <div v-if="isOverdue(task.nextOccurrence.dueDate)" class="text-xs text-red-500 font-medium">
                  Overdue
                </div>
              </template>
              <span v-else class="text-sm text-stone-400 italic">None</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <template v-if="task.nextOccurrence && task.nextOccurrence.assigneeIds.length > 0">
                <div class="text-sm text-stone-900">
                  {{ getAssigneeNames(task.nextOccurrence.assigneeIds).join(', ') }}
                </div>
              </template>
              <span v-else class="text-sm text-stone-400 italic">Unassigned</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center gap-1.5 text-sm text-stone-600">
                <CirclePlay v-if="task.metaStatus === 'active'" :size="16" />
                <Pause v-else-if="task.metaStatus === 'paused'" :size="16" />
                <Trash2 v-else-if="task.metaStatus === 'soft-deleted'" :size="16" />
                {{ formatMetaStatus(task.metaStatus) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" 
                @click.stop>
              <div class="relative inline-block text-left">
                <button 
                  @click="toggleDropdown(task.id)"
                  class="text-stone-400 hover:text-stone-600 focus:outline-none"
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
                      class="group flex items-center px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </NuxtLink>
                    
                    <NuxtLink
                      :to="`/tasks/${task.id}`"
                      class="group flex items-center px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      View Occurrences
                    </NuxtLink>

                    <button
                      v-if="task.metaStatus === 'active' && isTaskOverdue(task)"
                      @click="openCatchUp(task)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Catch Up
                    </button>

                    <button
                      v-if="task.metaStatus === 'active'"
                      @click="pauseTask(task.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pause Task
                    </button>
                    
                    <button
                      v-if="task.metaStatus === 'paused'"
                      @click="unpauseTask(task.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Unpause Task
                    </button>
                    
                    <div class="border-t border-stone-100"></div>
                    
                    <button
                      v-if="task.metaStatus !== 'soft-deleted'"
                      @click="deleteTask(task.id)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-stone-100"
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

    <!-- Catch Up Modal -->
    <CatchUpModal
      ref="catchUpModalRef"
      :visible="showCatchUpModal"
      :task-name="catchUpTask?.name || ''"
      :overdue-count="catchUpOverdueCount"
      :calculated-next-due-date="catchUpCalculatedDate"
      @confirm="handleCatchUp"
      @cancel="closeCatchUpModal"
    />

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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/utils/api';
import { useTaskStore } from '@/stores/tasks';
import { useAuthStore } from '@/stores/auth'; // Import auth store
import type { TaskDefinition, Category, User } from '@/types';
import CatchUpModal from '@/components/tasks/CatchUpModal.vue';
import PauseModal from '@/components/tasks/PauseModal.vue';
import DeleteModal from '@/components/tasks/DeleteModal.vue';
import { useToast } from '@/composables/useToast';
import { Plus, Search, X, ChevronUp, ChevronDown, CirclePlay, Pause, Trash2 } from 'lucide-vue-next';

const api = useApi(); // Keep for categories for now
const taskStore = useTaskStore();
const authStore = useAuthStore(); // Get auth store instance
const router = useRouter();
const toast = useToast();

// State
const loading = computed(() => taskStore.isLoading);
const error = computed(() => taskStore.error);
const initialLoadComplete = ref(false);
const showSkeleton = computed(() => !initialLoadComplete.value);

const tasks = computed(() => {
  let list = taskStore.tasks;

  // Client-side overdue filter
  if (filters.status === 'overdue') {
    list = list.filter(task => task.nextOccurrence && isOverdue(task.nextOccurrence.dueDate));
  }

  // Client-side sorting
  const sorted = [...list];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn.value) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'category':
        cmp = getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
        break;
      case 'nextDue': {
        const aDate = a.nextOccurrence ? new Date(a.nextOccurrence.dueDate).getTime() : Infinity;
        const bDate = b.nextOccurrence ? new Date(b.nextOccurrence.dueDate).getTime() : Infinity;
        cmp = aDate - bDate;
        break;
      }
      case 'status':
        cmp = a.metaStatus.localeCompare(b.metaStatus);
        break;
      default:
        cmp = 0;
    }
    return sortDirection.value === 'desc' ? -cmp : cmp;
  });

  return sorted;
});

// Keep local state for categories filter and household users
const categories = ref<Category[]>([]);
const householdUsers = ref<User[]>([]);

// Dropdown state
const openDropdownId = ref<string | null>(null);

// Pause modal state
const showPauseModal = ref(false);
const pauseTargetId = ref<string | null>(null);
const isSubmittingPause = ref(false);

// Delete modal state
const showDeleteModal = ref(false);
const deleteTargetId = ref<string | null>(null);
const isSubmittingDelete = ref(false);

// Filters - initialized with defaults for SSR consistency; restored from localStorage in onMounted
const filters = reactive({
  status: 'active',
  categoryId: '',
  search: ''
});

// Sort state - initialized with defaults for SSR consistency; restored in onMounted
const sortColumn = ref<string>('name');
const sortDirection = ref<'asc' | 'desc'>('asc');

const toggleSort = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
};

const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.status && filters.status !== 'active') count++;
  if (filters.categoryId) count++;
  if (filters.search) count++;
  return count;
});

const clearFilters = () => {
  filters.status = 'active';
  filters.categoryId = '';
  filters.search = '';
};

const clearFilter = (key: 'status' | 'categoryId' | 'search') => {
  if (key === 'status') {
    filters.status = 'active';
  } else {
    filters[key] = '';
  }
};

// Map UI filters to API filters (overdue → active for the API, filtered client-side)
const apiFilters = (f: typeof filters) => ({
  ...f,
  status: f.status === 'overdue' ? 'active' : f.status,
});

// Load initial data
onMounted(async () => {
  // Restore persisted filters and sort from localStorage before fetching
  const savedFilters = JSON.parse(localStorage.getItem('adulting-tasks-filters') || 'null');
  const savedSort = JSON.parse(localStorage.getItem('adulting-tasks-sort') || 'null');
  if (savedFilters) {
    if (savedFilters.status) filters.status = savedFilters.status;
    if (savedFilters.categoryId) filters.categoryId = savedFilters.categoryId;
    if (savedFilters.search) filters.search = savedFilters.search;
  }
  if (savedSort) {
    if (savedSort.column) sortColumn.value = savedSort.column;
    if (savedSort.direction) sortDirection.value = savedSort.direction;
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.relative')) {
      openDropdownId.value = null;
    }
  });

  // Fetch categories, household users, and tasks in parallel
  const fetchCategories = api.get<Category[]>('/api/categories')
    .then(data => { categories.value = data; })
    .catch(err => { console.error('Error loading categories:', err); });

  const fetchUsers = api.get<User[]>('/api/household/users')
    .then(data => { householdUsers.value = data; })
    .catch(err => { console.error('Error loading household users:', err); });

  // Fetch tasks once auth is ready
  if (authStore.isReady) {
    await Promise.all([
      fetchCategories,
      fetchUsers,
      taskStore.fetchTasks(apiFilters(filters)),
    ]);
    initialLoadComplete.value = true;
  } else {
    // Auth not ready yet — fetch categories/users now, tasks when auth resolves
    await Promise.all([fetchCategories, fetchUsers]);
    watch(() => authStore.isReady, async (ready) => {
      if (ready) {
        await taskStore.fetchTasks(apiFilters(filters));
        initialLoadComplete.value = true;
      }
    });
  }
});

// Watch filters changes, but only fetch if auth is ready
watch(filters, async () => {
  if (authStore.isReady) {
    await taskStore.fetchTasks(apiFilters(filters));
  }
}, { deep: true });

// Persist filters and sort state to localStorage
watch(filters, () => {
  if (import.meta.client) {
    localStorage.setItem('adulting-tasks-filters', JSON.stringify({ ...filters }));
  }
}, { deep: true });

watch([sortColumn, sortDirection], () => {
  if (import.meta.client) {
    localStorage.setItem('adulting-tasks-sort', JSON.stringify({
      column: sortColumn.value,
      direction: sortDirection.value,
    }));
  }
});

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
    case 'annual_fixed': {
      const monthNames = ['January','February','March','April','May','June',
        'July','August','September','October','November','December'];
      return `Annually on ${monthNames[(scheduleConfig.month || 1) - 1]} ${scheduleConfig.dayOfMonth}`;
    }
    case 'annual_variable': {
      const monthNames = ['January','February','March','April','May','June',
        'July','August','September','October','November','December'];
      return `~Annually around ${monthNames[(scheduleConfig.month || 1) - 1]} ${scheduleConfig.dayOfMonth}`;
    }
    default:
      return 'Custom schedule';
  }
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

const getAssigneeNames = (assigneeIds: string[]): string[] => {
  return assigneeIds.map(id => {
    const user = householdUsers.value.find(u => u.id === id);
    return user ? user.name : 'Unknown User';
  });
};

const formatMetaStatus = (status: string): string => {
  if (status === 'soft-deleted') return 'Deleted';
  return status.charAt(0).toUpperCase() + status.slice(1);
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
const pauseTask = (taskId: string) => {
  closeDropdown();
  pauseTargetId.value = taskId;
  showPauseModal.value = true;
};

const handlePauseConfirm = async () => {
  if (!pauseTargetId.value) return;
  isSubmittingPause.value = true;
  try {
    await api.post(`/api/tasks/${pauseTargetId.value}/pause`, {});
    showPauseModal.value = false;
    pauseTargetId.value = null;
    await taskStore.fetchTasks(apiFilters(filters));
  } catch (err) {
    console.error('Error pausing task:', err);
  } finally {
    isSubmittingPause.value = false;
  }
};

const handlePauseCancel = () => {
  showPauseModal.value = false;
  pauseTargetId.value = null;
};

const unpauseTask = async (taskId: string) => {
  closeDropdown();
  // TODO: Implement unpauseTask action in store and call it here
  try {
    // Placeholder: Direct API call for now, ideally move to store action
    await api.post(`/api/tasks/${taskId}/unpause`, {}); // Pass empty object for data
    await taskStore.fetchTasks(apiFilters(filters)); // Refetch tasks via store
  } catch (err) {
    console.error('Error unpausing task:', err);
    // error.value = 'Failed to unpause task. Please try again.'; // Store handles errors
  }
};

const deleteTask = (taskId: string) => {
  closeDropdown();
  deleteTargetId.value = taskId;
  showDeleteModal.value = true;
};

const handleDeleteConfirm = async () => {
  if (!deleteTargetId.value) return;
  isSubmittingDelete.value = true;
  try {
    await api.delete(`/api/tasks/${deleteTargetId.value}`);
    showDeleteModal.value = false;
    deleteTargetId.value = null;
    await taskStore.fetchTasks(apiFilters(filters));
  } catch (err) {
    console.error('Error deleting task:', err);
  } finally {
    isSubmittingDelete.value = false;
  }
};

const handleDeleteCancel = () => {
  showDeleteModal.value = false;
  deleteTargetId.value = null;
};

// Catch-up state
const showCatchUpModal = ref(false);
const catchUpTask = ref<TaskDefinition | null>(null);
const catchUpModalRef = ref<any>(null);
const catchUpOverdueCount = ref(0);
const catchUpCalculatedDate = ref<string | null>(null);

const isTaskOverdue = (task: TaskDefinition): boolean => {
  if (!task.nextOccurrence) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.nextOccurrence.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

const openCatchUp = async (task: TaskDefinition) => {
  closeDropdown();
  catchUpTask.value = task;
  try {
    const [occurrences, preview] = await Promise.all([
      api.get<any[]>(`/api/tasks/${task.id}/occurrences`),
      api.get<{ calculatedNextDueDate: string | null }>(`/api/tasks/${task.id}/catch-up-preview`),
    ]);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    catchUpOverdueCount.value = occurrences.filter((occ: any) => {
      const dueDate = new Date(occ.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return (occ.status === 'created' || occ.status === 'assigned') && dueDate < now;
    }).length;
    catchUpCalculatedDate.value = preview.calculatedNextDueDate;
  } catch {
    catchUpOverdueCount.value = 0;
    catchUpCalculatedDate.value = null;
  }
  showCatchUpModal.value = true;
};

const closeCatchUpModal = () => {
  showCatchUpModal.value = false;
  catchUpTask.value = null;
  catchUpCalculatedDate.value = null;
  catchUpModalRef.value?.reset();
};

const handleCatchUp = async (payload: { comment: string; overrideNextDueDate?: string }) => {
  if (!catchUpTask.value) return;
  try {
    const result = await api.post<{ occurrencesSkipped: number; newDueDate: string | null }>(
      `/api/tasks/${catchUpTask.value.id}/catch-up`,
      {
        comment: payload.comment || undefined,
        overrideNextDueDate: payload.overrideNextDueDate || undefined,
      }
    );

    closeCatchUpModal();
    await taskStore.fetchTasks(apiFilters(filters));

    toast.success(`Caught up — ${result.occurrencesSkipped} occurrence${result.occurrencesSkipped !== 1 ? 's' : ''} skipped.${result.newDueDate ? ' Next due: ' + new Date(result.newDueDate).toLocaleDateString() : ''}`);
  } catch (err: any) {
    console.error('Error catching up task:', err);
    toast.error(err.data?.message || 'Failed to catch up task');
    catchUpModalRef.value?.reset();
  }
};

// Page metadata
definePageMeta({
});
</script>
