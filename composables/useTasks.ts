// composables/useTasks.ts
import { storeToRefs } from "pinia";
import { useTaskStore } from "@/stores/tasks";
import {
  type Task,
  type RecurrencePattern,
  type TaskOccurrence,
} from "@/types/tasks";

export const useTasks = () => {
  const store = useTaskStore();
  const {
    tasks,
    pendingOccurrences,
    loading,
    error,
    sortedTasks,
    sortedPendingOccurrences,
  } = storeToRefs(store);

  return {
    // State refs
    tasks,
    pendingOccurrences,
    loading,
    error,

    // Computed
    sortedTasks,
    sortedPendingOccurrences,
  };
};

export const useTaskActions = () => {
  const store = useTaskStore();

  const saveRecurrencePattern = async (
    pattern: Omit<RecurrencePattern, "id" | "created_at" | "updated_at">
  ): Promise<string> => {
    return await store.createRecurrencePattern(pattern);
  };

  const saveTask = async (
    task: Partial<Task>,
    occurrence: Partial<TaskOccurrence>
  ): Promise<{ task: Task; occurrence: TaskOccurrence }> => {
    return await store.createTask(task, occurrence);
  };

  const updateTask = async (id: string, task: Partial<Task>): Promise<Task> => {
    return await store.updateTask(id, task);
  };

  const loadTasks = async (organizationId: string): Promise<void> => {
    await store.fetchTasks(organizationId);
  };

  const loadPendingOccurrences = async (
    organizationId: string
  ): Promise<void> => {
    await store.fetchPendingOccurrences(organizationId);
  };

  const updateOccurrence = async (
    id: string,
    occurrenceData: Partial<TaskOccurrence>
  ): Promise<TaskOccurrence> => {
    return await store.updateOccurrence(id, occurrenceData);
  };

  const fetchTaskOccurrences = async (
    taskId: string
  ): Promise<TaskOccurrence[]> => {
    return await store.fetchTaskOccurrences(taskId);
  };

  return {
    saveRecurrencePattern,
    saveTask,
    updateTask,
    loadTasks,
    loadPendingOccurrences,
    updateOccurrence,
    fetchTaskOccurrences,
  };
};
