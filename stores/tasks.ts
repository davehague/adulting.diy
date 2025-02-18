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

    const updateOccurrenceStatus = async (
      id: string,
      status: TaskOccurrence["status"],
      executionNotes?: string
    ): Promise<TaskOccurrence> => {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.patch<TaskOccurrence>(
          `/api/tasks/occurrences/${id}/status`,
          {
            status,
            execution_notes: executionNotes,
          }
        );

        // Update the occurrence in the list
        const index = pendingOccurrences.value.findIndex((o) => o.id === id);
        if (index !== -1) {
          pendingOccurrences.value[index] = {
            ...pendingOccurrences.value[index],
            ...response,
          };
        }

        return response;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to update occurrence status";
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

      // Actions
      fetchTasks,
      createTask,
      updateTask,
      createRecurrencePattern,
      fetchPendingOccurrences,
      updateOccurrenceStatus,
    };
  },
  {
    persist: true,
  }
);
