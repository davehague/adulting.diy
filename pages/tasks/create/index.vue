<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Create New Task</h1>
      <p class="text-gray-600 mt-1">Define a new task for your household.</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      <p>{{ error }}</p>
    </div>

    <!-- Create Form -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <TaskCreateForm ref="taskFormRef" submit-button-text="Create Task" cancel-url="/tasks" @submit="handleSubmit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
// import { useApi } from '@/utils/api'; // No longer needed for task creation
import { useTaskStore } from '@/stores/tasks'; // Import task store
import type { TaskDefinition } from '@/types';
import TaskCreateForm from '@/components/tasks/TaskCreateForm.vue';

const router = useRouter();
// const api = useApi(); // No longer needed for task creation
const taskStore = useTaskStore(); // Get task store instance

// State
const submitting = ref(false);
const error = ref('');
const taskFormRef = ref<InstanceType<typeof TaskCreateForm> | null>(null);

// Handle form submission
const handleSubmit = async (formData: any) => {
  try {
    submitting.value = true;
    error.value = ''; // Clear previous errors

    // Access the isSubmitting state from the child component if needed
    if (taskFormRef.value) {
      taskFormRef.value.isSubmitting = true;
    }

    // Use the store action to create the task
    const newTask = await taskStore.createTask(formData);

    // If successful, redirect to the new task's view page
    if (newTask && newTask.id) {
      router.push(`/tasks/${newTask.id}`);
    } else {
      // Handle case where API might not return the full task or ID
      router.push('/tasks'); // Fallback to task list
    }
  } catch (err: any) {
    console.error('Error creating task:', err);
    // Error handling is now managed within the store action, but we can display the store's error
    error.value = taskStore.error || 'Failed to create task. Please check the details and try again.';
  } finally {
    submitting.value = false;
    // Access the isSubmitting state from the child component if needed
    if (taskFormRef.value) {
      taskFormRef.value.isSubmitting = false;
    }
  }
};

// Page metadata
definePageMeta({
  // Middleware 'auth' is global and runs automatically
});
</script>
