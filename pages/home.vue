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

      <!-- No Organization State - Will redirect to organization/create -->
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
        <div class="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
          <!-- Task list component will go here -->
          <p class="p-4 text-gray-500 text-center">Task list component coming soon</p>
        </div>
      </div>
    </main>

    <!-- New Task Modal -->
    <div v-if="showNewTaskForm" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <!-- New task form component will go here -->
        <p class="text-center">New task form coming soon</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'

const router = useRouter()
const authStore = useAuthStore()
const organizationStore = useOrganizationStore()

const loading = ref(true)
const error = ref<string | null>(null)
const showNewTaskForm = ref(false)
const currentFilter = ref('all')

const filters = [
  { label: 'All Tasks', value: 'all' },
  { label: 'My Tasks', value: 'my' },
  { label: 'Due Soon', value: 'due' },
  { label: 'Completed', value: 'completed' }
]

onMounted(async () => {
  try {
    if (!authStore.isAuthenticated) {
      router.push('/login')
      return
    }

    // Check if user has an organization
    await organizationStore.fetchUserOrganization()

    if (!organizationStore.currentOrganization) {
      console.log('No organization found!')
      return
    }

    // TODO: Fetch tasks when task store is implemented

  } catch (err) {
    error.value = 'Failed to load your tasks. Please try again.'
  } finally {
    loading.value = false
  }
})
</script>