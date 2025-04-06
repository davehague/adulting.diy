import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "./auth"; // Import auth store
import type { TaskDefinition, TaskOccurrence } from "~/types"; // Assuming types are defined

// Use Nuxt 3's built-in $fetch for API calls

export const useTaskStore = defineStore(
  "tasks",
  () => {
    // State
    const taskList = ref<TaskDefinition[]>([]);
    const currentTask = ref<TaskDefinition | null>(null);
    const currentTaskOccurrences = ref<TaskOccurrence[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Getters (Computed Properties)
    const tasks = computed(() => taskList.value);
    const selectedTask = computed(() => currentTask.value);
    const occurrencesForSelectedTask = computed(
      () => currentTaskOccurrences.value
    );

    // Actions

    // Fetch all tasks for the household (Blueprint Step 3.3)
    async function fetchTasks(
      filters: { status?: string; categoryId?: string; search?: string } = {}
    ) {
      isLoading.value = true;
      error.value = null;
      try {
        // Prepare query parameters
        const params: Record<string, string> = {};
        if (filters.status) params.status = filters.status;
        if (filters.categoryId) params.categoryId = filters.categoryId;
        if (filters.search) params.search = filters.search;

        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }

        // Use $fetch for the actual API call
        const data = await $fetch<TaskDefinition[]>("/api/tasks", {
          params,
          headers,
        });
        taskList.value = data;
      } catch (err: any) {
        error.value = err.message || "Failed to fetch tasks";
        taskList.value = []; // Clear list on error
      } finally {
        isLoading.value = false;
      }
    }

    // Fetch a single task definition (Blueprint Step 3.8)
    async function fetchTaskById(taskId: string) {
      console.log(`[TaskStore] Fetching task by ID: ${taskId}`); // Log start
      isLoading.value = true;
      error.value = null;
      currentTask.value = null; // Clear previous task
      try {
        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        const data = await $fetch<TaskDefinition>(`/api/tasks/${taskId}`, {
          headers,
        });
        console.log(`[TaskStore] Successfully fetched task: ${taskId}`); // Log success
        currentTask.value = data;
      } catch (err: any) {
        console.error(`[TaskStore] Error fetching task ${taskId}:`, err); // Log the full error object
        // Try to extract a meaningful message from $fetch errors
        const message =
          err.data?.message ||
          err.statusMessage ||
          err.message ||
          `Failed to fetch task ${taskId}`;
        console.log(`[TaskStore] Setting error state to: "${message}"`);
        error.value = message;
      } finally {
        isLoading.value = false;
      }
    }

    // Create a new task definition (Blueprint Step 3.2 / 3.7)
    async function createTask(
      taskData: Omit<
        TaskDefinition,
        | "id"
        | "householdId"
        | "createdAt"
        | "updatedAt"
        | "metaStatus"
        | "occurrences"
      >
    ) {
      isLoading.value = true;
      error.value = null;
      try {
        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        const newTask = await $fetch<TaskDefinition>("/api/tasks", {
          method: "POST",
          body: taskData,
          headers,
        });
        // Optionally add to list or refetch
        await fetchTasks(); // Refetch list after creation
        return newTask;
      } catch (err: any) {
        error.value = err.message || "Failed to create task";
        throw err; // Re-throw to handle in component
      } finally {
        isLoading.value = false;
      }
    }

    // Update an existing task definition (Blueprint Step 3.10 / 3.11)
    async function updateTask(
      taskId: string,
      taskData: Partial<TaskDefinition>
    ) {
      isLoading.value = true;
      error.value = null;
      try {
        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        const updatedTask = await $fetch<TaskDefinition>(
          `/api/tasks/${taskId}`,
          {
            method: "PUT",
            body: taskData,
            headers,
          }
        );
        // Update in list or refetch
        await fetchTasks(); // Refetch list after update
        if (currentTask.value?.id === taskId) {
          currentTask.value = updatedTask; // Update current task if viewing
        }
        return updatedTask;
      } catch (err: any) {
        error.value = err.message || `Failed to update task ${taskId}`;
        throw err; // Re-throw to handle in component
      } finally {
        isLoading.value = false;
      }
    }

    // Fetch occurrences for a specific task (Blueprint Step 3.12)
    async function fetchOccurrencesForTask(taskId: string) {
      isLoading.value = true;
      error.value = null;
      currentTaskOccurrences.value = []; // Clear previous occurrences
      try {
        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        const data = await $fetch<TaskOccurrence[]>(
          `/api/tasks/${taskId}/occurrences`,
          { headers }
        );
        currentTaskOccurrences.value = data;
      } catch (err: any) {
        error.value =
          err.message || `Failed to fetch occurrences for task ${taskId}`;
      } finally {
        isLoading.value = false;
      }
    }

    // --- Actions for Occurrence Interaction (Phase 4) ---

    // Execute an occurrence (Blueprint Step 4.4 / 4.6)
    async function executeOccurrence(occurrenceId: string) {
      isLoading.value = true; // Consider a more granular loading state if needed
      error.value = null;
      try {
        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        const updatedOccurrence = await $fetch<TaskOccurrence>(
          `/api/occurrences/${occurrenceId}/execute`,
          {
            method: "POST",
            body: {}, // Empty body as per original
            headers,
          }
        );
        // Optionally update the specific occurrence in the local state if needed,
        // or refetch the list for the current task if viewing that page.
        // For simplicity now, we might rely on the page to refetch after action.
        return updatedOccurrence;
      } catch (err: any) {
        error.value =
          err.message || `Failed to execute occurrence ${occurrenceId}`;
        throw err; // Re-throw to handle in component
      } finally {
        isLoading.value = false;
      }
    }

    // Skip an occurrence (Blueprint Step 4.5 / 4.6)
    async function skipOccurrence(occurrenceId: string, reason: string) {
      isLoading.value = true;
      error.value = null;
      try {
        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        const updatedOccurrence = await $fetch<TaskOccurrence>(
          `/api/occurrences/${occurrenceId}/skip`,
          {
            method: "POST",
            body: { reason },
            headers,
          }
        );
        // Optionally update the specific occurrence in the local state
        return updatedOccurrence;
      } catch (err: any) {
        error.value =
          err.message || `Failed to skip occurrence ${occurrenceId}`;
        throw err; // Re-throw to handle in component
      } finally {
        isLoading.value = false;
      }
    }

    // Add a comment to an occurrence (Blueprint Step 4.7 / 4.11)
    async function commentOnOccurrence(occurrenceId: string, comment: string) {
      // Note: This action doesn't modify core task/occurrence state directly,
      // so isLoading might not be strictly necessary unless we want global loading.
      // error.value = null; // Clear previous errors if desired
      try {
        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        // Assuming the API returns the created history log entry type
        const historyLog = await $fetch(
          `/api/occurrences/${occurrenceId}/comments`,
          {
            method: "POST",
            body: { comment },
            headers,
          }
        );
        // The timeline component fetches its own data, so no state update needed here.
        // We might want to trigger a refetch on the timeline component if it's visible.
        return historyLog; // Return the new log entry
      } catch (err: any) {
        // Handle error specifically for commenting if needed
        console.error(
          `Failed to add comment to occurrence ${occurrenceId}:`,
          err
        );
        // error.value = err.message || `Failed to add comment`; // Set global error if desired
        throw err; // Re-throw to handle in component
      }
    }

    // Update an occurrence (Blueprint Step 4.12 / 4.13)
    async function updateOccurrence(
      occurrenceId: string,
      occurrenceData: Partial<Pick<TaskOccurrence, "dueDate" | "assigneeIds">>
    ) {
      isLoading.value = true; // Consider more granular loading
      error.value = null;
      try {
        // Prepare data for API (ensure date is handled correctly if needed)
        const payload: any = {};
        if (occurrenceData.dueDate) payload.dueDate = occurrenceData.dueDate; // Match API expected field name
        if (occurrenceData.assigneeIds)
          payload.assigneeIds = occurrenceData.assigneeIds; // Match API expected field name

        const authStore = useAuthStore();
        const headers: Record<string, string> = {};
        if (authStore.accessToken) {
          headers["Authorization"] = `Bearer ${authStore.accessToken}`;
        }
        // Use $fetch for the actual API call
        const updatedOccurrence = await $fetch<TaskOccurrence>(
          `/api/occurrences/${occurrenceId}`,
          {
            method: "PUT",
            body: payload,
            headers,
          }
        );
        // Optionally update the specific occurrence in the local state if needed,
        // or rely on the page to refetch.
        return updatedOccurrence;
      } catch (err: any) {
        error.value =
          err.message || `Failed to update occurrence ${occurrenceId}`;
        throw err; // Re-throw to handle in component
      } finally {
        isLoading.value = false;
      }
    }

    // async function fetchOccurrenceHistory(occurrenceId: string) { ... }

    // --- Placeholder actions for Advanced Task Logic (Phase 5) ---
    // async function pauseTask(taskId: string) { ... }
    // async function unpauseTask(taskId: string) { ... }
    // async function deleteTask(taskId: string) { ... }

    return {
      // State
      isLoading,
      error,
      // Getters
      tasks,
      selectedTask,
      occurrencesForSelectedTask,
      // Actions
      fetchTasks,
      fetchTaskById,
      createTask,
      updateTask,
      fetchOccurrencesForTask,
      executeOccurrence, // Add new action
      skipOccurrence,
      commentOnOccurrence,
      updateOccurrence, // Add new action
      // Add other actions as needed...
    };
  },
  {
    // Persist configuration if needed for tasks (likely not needed for task list itself)
    // persist: true,
  }
);
