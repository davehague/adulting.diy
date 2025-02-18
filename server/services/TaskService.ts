// server/services/TaskService.ts

import {
  type Task,
  type RecurrencePattern,
  type TaskOccurrence,
  type TaskOccurrenceNotification,
} from "@/types/tasks";
import { serverSupabase } from "@/server/utils/supabaseServerClient";

export class TaskService {
  // Core Task Methods
  async createTask(
    taskData: Omit<Task, "id" | "created_at" | "updated_at">
  ): Promise<Task> {
    console.log("[TaskService] Creating new task:", taskData.title);
    try {
      const { data, error } = await serverSupabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error("[TaskService] Error creating task:", error);
        throw error;
      }

      console.log("[TaskService] Successfully created task:", data.id);
      return data;
    } catch (error) {
      console.error("[TaskService] Unexpected error in createTask:", error);
      throw error;
    }
  }

  async updateTask(id: string, taskData: Partial<Task>): Promise<Task> {
    console.log("[TaskService] Updating task:", id);
    try {
      const { data, error } = await serverSupabase
        .from("tasks")
        .update(taskData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[TaskService] Error updating task:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("[TaskService] Unexpected error in updateTask:", error);
      throw error;
    }
  }

  async findTaskById(id: string): Promise<Task | null> {
    try {
      const { data, error } = await serverSupabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[TaskService] Error finding task:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("[TaskService] Unexpected error in findTaskById:", error);
      throw error;
    }
  }

  async findTasksByOrganization(organizationId: string): Promise<Task[]> {
    try {
      const { data, error } = await serverSupabase
        .from("tasks")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[TaskService] Error finding organization tasks:", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in findTasksByOrganization:",
        error
      );
      throw error;
    }
  }

  // Recurrence Pattern Methods
  async createRecurrencePattern(
    patternData: Omit<RecurrencePattern, "id" | "created_at" | "updated_at">
  ): Promise<RecurrencePattern> {
    try {
      const { data, error } = await serverSupabase
        .from("recurrence_patterns")
        .insert(patternData)
        .select()
        .single();

      if (error) {
        console.error(
          "[TaskService] Error creating recurrence pattern:",
          error
        );
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in createRecurrencePattern:",
        error
      );
      throw error;
    }
  }

  // Task Occurrence Methods
  async createTaskOccurrence(
    occurrenceData: Omit<TaskOccurrence, "id" | "created_at" | "updated_at">
  ): Promise<TaskOccurrence> {
    try {
      const { data, error } = await serverSupabase
        .from("task_occurrences")
        .insert(occurrenceData)
        .select()
        .single();

      if (error) {
        console.error("[TaskService] Error creating task occurrence:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in createTaskOccurrence:",
        error
      );
      throw error;
    }
  }

  async updateTaskOccurrenceStatus(
    id: string,
    status: TaskOccurrence["status"],
    executedBy?: string,
    executionNotes?: string
  ): Promise<TaskOccurrence> {
    try {
      const updateData: Partial<TaskOccurrence> = {
        status,
        executed_by: executedBy,
        execution_notes: executionNotes,
        executed_datetime: executedBy ? new Date().toISOString() : undefined,
      };

      const { data, error } = await serverSupabase
        .from("task_occurrences")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error(
          "[TaskService] Error updating task occurrence status:",
          error
        );
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in updateTaskOccurrenceStatus:",
        error
      );
      throw error;
    }
  }

  async findPendingOccurrencesByOrganization(
    organizationId: string
  ): Promise<(TaskOccurrence & { task: Task })[]> {
    try {
      const { data, error } = await serverSupabase
        .from("task_occurrences")
        .select(
          `
          *,
          task:tasks(*)
        `
        )
        .eq("task.organization_id", organizationId)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true });

      if (error) {
        console.error(
          "[TaskService] Error finding pending occurrences:",
          error
        );
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in findPendingOccurrencesByOrganization:",
        error
      );
      throw error;
    }
  }

  // Notification Methods
  async createNotification(
    notificationData: Omit<
      TaskOccurrenceNotification,
      "id" | "created_at" | "updated_at"
    >
  ): Promise<TaskOccurrenceNotification> {
    try {
      const { data, error } = await serverSupabase
        .from("task_occurrence_notifications")
        .insert(notificationData)
        .select()
        .single();

      if (error) {
        console.error("[TaskService] Error creating notification:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in createNotification:",
        error
      );
      throw error;
    }
  }

  async markNotificationSent(id: string): Promise<TaskOccurrenceNotification> {
    try {
      const { data, error } = await serverSupabase
        .from("task_occurrence_notifications")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error(
          "[TaskService] Error marking notification as sent:",
          error
        );
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in markNotificationSent:",
        error
      );
      throw error;
    }
  }
}
