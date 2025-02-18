// stores/tasks.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useApi } from "@/utils/api";
import {
  type Task,
  type RecurrencePattern,
  type TaskOccurrence,
} from "@/types/tasks";

export const useTaskStore = defineStore(
  "tasks",
  () => {
    const api = useApi();

    // State
    const tasks = ref<Task[]>([]);
    const taskOccurrences = ref<Record<string, TaskOccurrence[]>>({});

    const pendingOccurrences = ref<(TaskOccurrence & { task: Task })[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Getters
    const sortedTasks = computed(() =>
      [...tasks.value].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );

    const sortedPendingOccurrences = computed(() =>
      [...pendingOccurrences.value].sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      )
    );

    // Actions
    const fetchTasks = async (organizationId: string) => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.get<Task[]>("/api/tasks", {
          params: { organization_id: organizationId },
        });
        tasks.value = response;
        await fetchTaskOccurrencesForTasks();
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to fetch tasks";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const createTask = async (
      taskData: Partial<Task>,
      occurrenceData: Partial<TaskOccurrence>
    ): Promise<{ task: Task; occurrence: TaskOccurrence }> => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.post<{
          task: Task;
          occurrence: TaskOccurrence;
        }>("/api/tasks", { task: taskData, occurrence: occurrenceData });
        tasks.value.push(response.task);
        // Add this line:
        taskOccurrences.value[response.task.id] = [response.occurrence];
        pendingOccurrences.value.push({
          ...response.occurrence,
          task: response.task,
        });
        return response;
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to create task";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const updateTask = async (
      id: string,
      taskData: Partial<Task>
    ): Promise<Task> => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.patch<Task>(`/api/tasks/${id}`, taskData);
        const index = tasks.value.findIndex((t) => t.id === id);
        if (index !== -1) {
          tasks.value[index] = response;
        }
        return response;
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to update task";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const tasksWithCurrentOccurrence = computed(() =>
      tasks.value.map((task) => ({
        ...task,
        current_occurrence: taskOccurrences.value[task.id]?.find(
          (o) => o.status === "pending" || o.status === "in_progress"
        ),
      }))
    );

    const createRecurrencePattern = async (
      patternData: Omit<RecurrencePattern, "id" | "created_at" | "updated_at">
    ): Promise<string> => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.post<RecurrencePattern>(
          "/api/tasks/patterns",
          patternData
        );
        return response.id;
      } catch (e) {
        error.value =
          e instanceof Error
            ? e.message
            : "Failed to create recurrence pattern";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchTaskOccurrencesForTasks = async () => {
      loading.value = true;
      error.value = null;

      try {
        await Promise.all(
          tasks.value.map(async (task) => {
            const occurrences = await api.get<TaskOccurrence[]>(
              "/api/tasks/occurrences",
              {
                params: { task_id: task.id },
              }
            );
            taskOccurrences.value[task.id] = occurrences;
          })
        );
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to fetch task occurrences";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchPendingOccurrences = async (organizationId: string) => {
      if (!process.client) {
        console.warn(
          "[TaskStore] Attempting to fetch during SSR, deferring..."
        );
        return;
      }

      loading.value = true;
      error.value = null;

      try {
        const response = await api.get<(TaskOccurrence & { task: Task })[]>(
          "/api/tasks/occurrences",
          {
            params: { organization_id: organizationId },
          }
        );
        pendingOccurrences.value = response;
      } catch (e) {
        error.value =
          e instanceof Error
            ? e.message
            : "Failed to fetch pending occurrences";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const updateOccurrence = async (
      id: string,
      occurrenceData: Partial<TaskOccurrence>
    ): Promise<TaskOccurrence> => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.patch<TaskOccurrence>(
          `/api/tasks/occurrences/${id}`,
          occurrenceData
        );

        // Update in taskOccurrences
        const taskId = response.task_id;
        if (taskOccurrences.value[taskId]) {
          const occurrenceIndex = taskOccurrences.value[taskId].findIndex(
            (o) => o.id === id
          );
          if (occurrenceIndex !== -1) {
            taskOccurrences.value[taskId][occurrenceIndex] = response;
          }
        }

        // Update the occurrence in pendingOccurrences if it exists
        const index = pendingOccurrences.value.findIndex((o) => o.id === id);
        if (index !== -1) {
          // Create a new object with all properties from both the existing occurrence and the response
          pendingOccurrences.value[index] = {
            ...pendingOccurrences.value[index],
            ...response,
            // Ensure we preserve the task reference
            task: pendingOccurrences.value[index].task,
          };
        }

        return response;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to update occurrence";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchRecurrencePattern = async (
      patternId: string
    ): Promise<RecurrencePattern> => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.get<RecurrencePattern>(
          `/api/tasks/patterns/${patternId}`
        );
        return response;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to fetch recurrence pattern";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchTaskOccurrences = async (
      taskId: string
    ): Promise<TaskOccurrence[]> => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.get<TaskOccurrence[]>(
          "/api/tasks/occurrences",
          {
            params: { task_id: taskId },
          }
        );
        return response;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to fetch task occurrences";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    return {
      // State
      tasks,
      pendingOccurrences,
      loading,
      error,

      // Getters
      sortedTasks,
      sortedPendingOccurrences,
      tasksWithCurrentOccurrence,

      // Actions
      fetchTasks,
      createTask,
      updateTask,
      createRecurrencePattern,
      fetchRecurrencePattern,
      fetchPendingOccurrences,
      updateOccurrence,
      fetchTaskOccurrences,
    };
  },
  {
    persist: true,
  }
);
