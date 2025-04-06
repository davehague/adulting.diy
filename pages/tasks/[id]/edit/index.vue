<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Edit Task</h1>
      <p class="text-gray-600 mt-1">Update task details and schedule</p>
    </div>

    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-gray-600">Loading task details...</p>
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      <p>{{ error }}</p>
      <div class="mt-2">
        <NuxtLink to="/tasks" class="text-blue-600 hover:text-blue-800">
          Return to task list
        </NuxtLink>
      </div>
    </div>

    <!-- Edit Form -->
    <div v-else class="bg-white rounded-lg shadow-md p-6">
      <TaskEditForm :task="task" submit-button-text="Update Task" :cancel-url="`/tasks/${taskId}`"
        @submit="handleSubmit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'; // Added computed
import { useRoute, useRouter } from 'vue-router';
// import { useApi } from '@/utils/api'; // No longer needed for task fetch/update
import { useTaskStore } from '@/stores/tasks'; // Import task store
import type { TaskDefinition } from '@/types';
import TaskEditForm from '@/components/tasks/TaskEditForm.vue';

const route = useRoute();
const router = useRouter();
// const api = useApi(); // No longer needed for task fetch/update
const taskStore = useTaskStore(); // Get task store instance

// Task ID from route params
const taskId = route.params.id as string;

// State
// Use computed properties for task data, loading, and error from store
const task = computed(() => taskStore.selectedTask || {} as TaskDefinition);
const loading = computed(() => taskStore.isLoading);
const error = computed(() => taskStore.error);

// Keep local state for submission status
const submitting = ref(false);
// const localError = ref(''); // Use store error primarily

// Load task data
onMounted(async () => {
  // Fetch task details via store action
  await taskStore.fetchTaskById(taskId);
  // Store handles loading/error state
});

// Handle form submission
const handleSubmit = async (formData: any) => {
  try {
    submitting.value = true;

    // Use the store action to update the task
    await taskStore.updateTask(taskId, formData);

    // If successful (no error thrown by store action), redirect
    if (!taskStore.error) {
      router.push(`/tasks/${taskId}`);
    }
  } catch (err) {
    console.error('Error updating task:', err); // Log the error
    // Error display is handled by the computed 'error' property linked to the store
  } finally {
    submitting.value = false;
  }
};
</script>
