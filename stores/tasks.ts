import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { TaskDefinition, TaskOccurrence } from "~/types"; // Assuming types are defined

// Placeholder for API utility - replace with actual implementation later
const $api = {
  get: async (
    url: string,
    options?: { params?: Record<string, string> }
  ): Promise<any> => {
    const queryString = options?.params
      ? `?${new URLSearchParams(options.params).toString()}`
      : "";
    console.log(`API GET: ${url}${queryString}`);
    // Simulate filtering based on params for placeholder
    if (url === "/api/tasks" && options?.params) {
      console.log(
        "Placeholder: Simulating filtering with params:",
        options.params
      );
      // Return a subset or specific data based on params if needed for testing
    }
    return []; // Still return empty array for placeholder
  },
  post: async (url: string, body: any): Promise<any> => {
    console.log(`API POST: ${url}`, body);
    return {};
  },
  put: async (url: string, body: any): Promise<any> => {
    console.log(`API PUT: ${url}`, body);
    return {};
  },
};

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

        // Replace with actual API call structure - using placeholder $api for now
        // In a real app, this would use the composable like useApi()
        const data = await $api.get("/api/tasks", { params });
        taskList.value = data as TaskDefinition[]; // Add type assertion/validation
      } catch (err: any) {
        error.value = err.message || "Failed to fetch tasks";
        taskList.value = []; // Clear list on error
      } finally {
        isLoading.value = false;
      }
    }

    // Fetch a single task definition (Blueprint Step 3.8)
    async function fetchTaskById(taskId: string) {
      isLoading.value = true;
      error.value = null;
      currentTask.value = null; // Clear previous task
      try {
        // Replace with actual API call structure
        const data = await $api.get(`/api/tasks/${taskId}`);
        currentTask.value = data as TaskDefinition; // Add type assertion/validation
      } catch (err: any) {
        error.value = err.message || `Failed to fetch task ${taskId}`;
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
        // Replace with actual API call structure
        const newTask = await $api.post("/api/tasks", taskData);
        // Optionally add to list or refetch
        await fetchTasks(); // Refetch list after creation
        return newTask as TaskDefinition;
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
        // Replace with actual API call structure
        const updatedTask = await $api.put(`/api/tasks/${taskId}`, taskData);
        // Update in list or refetch
        await fetchTasks(); // Refetch list after update
        if (currentTask.value?.id === taskId) {
          currentTask.value = updatedTask as TaskDefinition; // Update current task if viewing
        }
        return updatedTask as TaskDefinition;
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
        // Replace with actual API call structure
        const data = await $api.get(`/api/tasks/${taskId}/occurrences`);
        currentTaskOccurrences.value = data as TaskOccurrence[]; // Add type assertion/validation
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
        // Replace with actual API call structure
        const updatedOccurrence = await $api.post(
          `/api/occurrences/${occurrenceId}/execute`,
          {}
        );
        // Optionally update the specific occurrence in the local state if needed,
        // or refetch the list for the current task if viewing that page.
        // For simplicity now, we might rely on the page to refetch after action.
        return updatedOccurrence as TaskOccurrence;
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
        // Replace with actual API call structure
        const updatedOccurrence = await $api.post(
          `/api/occurrences/${occurrenceId}/skip`,
          { reason }
        );
        // Optionally update the specific occurrence in the local state
        return updatedOccurrence as TaskOccurrence;
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
        // Replace with actual API call structure
        const historyLog = await $api.post(
          `/api/occurrences/${occurrenceId}/comments`,
          { comment }
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

        // Replace with actual API call structure
        const updatedOccurrence = await $api.put(
          `/api/occurrences/${occurrenceId}`,
          payload
        );
        // Optionally update the specific occurrence in the local state if needed,
        // or rely on the page to refetch.
        return updatedOccurrence as TaskOccurrence;
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
