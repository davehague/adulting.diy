<template>
  <div class="min-h-screen bg-gray-100">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading and Error States -->
      <div v-if="loading" class="text-center py-12">
        <p class="text-gray-600">Loading your tasks...</p>
      </div>

      <div v-else-if="error" class="max-w-2xl mx-auto bg-red-50 text-red-600 p-4 rounded-md">
        {{ error }}
      </div>

      <!-- No Organization State -->
      <div v-else-if="!organizationStore.currentOrganization" class="text-center py-12">
        <p class="text-gray-600">Redirecting to setup...</p>
      </div>

      <!-- Task Dashboard -->
      <div v-else class="space-y-6">
        <!-- Task Actions -->
        <div class="flex justify-between items-center">
          <h1 class="text-2xl font-semibold text-gray-900">My Tasks</h1>
          <button @click="showNewTaskForm = true"
            class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            New Task
          </button>
        </div>

        <!-- Task Filters -->
        <div class="bg-white rounded-lg shadow-sm p-4">
          <div class="flex space-x-4">
            <button v-for="filter in filters" :key="filter.value" @click="currentFilter = filter.value" :class="[
              currentFilter === filter.value
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700',
              'pb-2 border-b-2 font-medium'
            ]">
              {{ filter.label }}
            </button>
          </div>
        </div>

        <!-- Task List -->
        <div class="bg-white rounded-lg shadow-sm">
          <TaskList :tasks="filteredTasks" @edit="handleEditTask" @delete="handleDeleteTask" />
        </div>
      </div>
    </main>

    <!-- Task Form Modal -->
    <div v-if="showNewTaskForm" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <TaskForm :task="editingTask" @save="handleSaveTask" @cancel="closeTaskForm" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'
import { useTasks, useTaskActions } from '@/composables/useTasks'
import { type Task, type TaskOccurrence } from '@/types/tasks'
import TaskList from '@/components/task/TaskList.vue'
import TaskForm from '@/components/task/TaskForm.vue'

const router = useRouter()
const authStore = useAuthStore()
const organizationStore = useOrganizationStore()
const { tasks, loading, error } = useTasks()
const { loadTasks, saveTask, updateTask, updateOccurrence, fetchTaskOccurrences } = useTaskActions()

const showNewTaskForm = ref(false)
const currentFilter = ref('all')

const editingTask = ref<Task | null>(null)
const editingOccurrence = ref<TaskOccurrence | null>(null)


const filters = [
  { label: 'All Tasks', value: 'all' },
  { label: 'My Tasks', value: 'my' },
  { label: 'Due Soon', value: 'due' },
  { label: 'Completed', value: 'completed' }
]

const filteredTasks = computed(() => {
  // Basic filtering - expand based on your needs
  if (currentFilter.value === 'my') {
    return tasks.value.filter(task => task.created_by === authStore.user?.id)
  }
  return tasks.value
})

const closeTaskForm = () => {
  showNewTaskForm.value = false
  editingTask.value = null
}

const handleEditTask = async (task: Task) => {
  editingTask.value = task
  const occurrences = await fetchTaskOccurrences(task.id)
  editingOccurrence.value = occurrences[0] // Get first occurrence
  showNewTaskForm.value = true
}

const handleSaveTask = async (taskData: Partial<Task>, occurrenceData: Partial<TaskOccurrence>) => {
  try {
    if (editingTask.value) {
      await updateTask(editingTask.value.id, taskData)
      if (editingOccurrence.value) {
        await updateOccurrence(editingOccurrence.value.id, occurrenceData)
      }
    } else {
      await saveTask(taskData, occurrenceData)
    }
    closeTaskForm()
    await loadTasks(organizationStore.currentOrganization!.id)
  } catch (error) {
    console.error('Error saving task:', error)
  }
}

const handleDeleteTask = async (id: string) => {
  if (confirm('Are you sure you want to delete this task?')) {
    // Add delete functionality to store/composable if needed
  }
}

onMounted(async () => {
  try {
    if (!authStore.isAuthenticated) {
      router.push('/login')
      return
    }

    await organizationStore.fetchUserOrganization()

    if (!organizationStore.currentOrganization) {
      router.push('/organization/create')
      return
    }

    await loadTasks(organizationStore.currentOrganization.id)
  } catch (err) {
    error.value = 'Failed to load your tasks. Please try again.'
  }
})
</script>