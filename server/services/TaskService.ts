// server/services/TaskService.ts

import {
  type Task,
  type RecurrencePattern,
  type TaskOccurrence,
  type TaskOccurrenceNotification,
} from "@/types/tasks";
import { serverSupabase } from "@/server/utils/supabaseServerClient";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";

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

  createTaskWithOccurrence = async (
    taskData: Partial<Task>,
    occurrenceData: Partial<TaskOccurrence>
  ) => {
    const { data: task, error: taskError } = await serverSupabase
      .from("tasks")
      .insert(taskData)
      .select()
      .single();

    if (taskError) throw taskError;

    // Create initial occurrence
    const { data: occurrence, error: occurrenceError } = await serverSupabase
      .from("task_occurrences")
      .insert({
        task_id: task.id,
        due_date: occurrenceData.due_date,
        status: "pending",
        assigned_to: occurrenceData.assigned_to || [],
      })
      .select()
      .single();

    if (occurrenceError) throw occurrenceError;

    // If task is recurring, calculate and create future occurrences
    if (task.recurring && task.recurrence_pattern_id) {
      await this.createFutureOccurrences(task, occurrence.due_date);
    }

    return { task, occurrence };
  };

  async findOccurrencesByTaskId(taskId: string): Promise<TaskOccurrence[]> {
    try {
      const { data, error } = await serverSupabase
        .from("task_occurrences")
        .select(
          `
          *,
          task:tasks(*)
        `
        )
        .eq("task_id", taskId)
        .order("due_date", { ascending: true });

      if (error) {
        console.error(
          "[TaskService] Error finding occurrences for task:",
          error
        );
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in findOccurrencesByTaskId:",
        error
      );
      throw error;
    }
  }

  createFutureOccurrences = async (
    task: Task,
    initialDueDate: string
  ): Promise<void> => {
    if (!task.recurrence_pattern_id) return;

    // Fetch the recurrence pattern
    const { data: pattern, error: patternError } = await serverSupabase
      .from("recurrence_patterns")
      .select()
      .eq("id", task.recurrence_pattern_id)
      .single();

    if (patternError) throw patternError;

    const occurrences: Partial<TaskOccurrence>[] = [];
    let currentDate = new Date(initialDueDate);
    const endDate = pattern.end_date ? new Date(pattern.end_date) : null;
    let occurrenceCount = 0;

    while (
      (!endDate || currentDate <= endDate) &&
      (!pattern.end_after_occurrences ||
        occurrenceCount < pattern.end_after_occurrences)
    ) {
      // Calculate next occurrence based on pattern type
      switch (pattern.type) {
        case "daily":
          currentDate = addDays(currentDate, pattern.interval);
          break;
        case "weekly":
          currentDate = addWeeks(currentDate, pattern.interval);
          break;
        case "monthly":
        case "monthly_by_weekday":
          currentDate = addMonths(currentDate, pattern.interval);
          break;
        case "yearly":
          currentDate = addYears(currentDate, pattern.interval);
          break;
      }

      occurrences.push({
        task_id: task.id,
        due_date: currentDate.toISOString(),
        status: "pending",
        assigned_to: [], // You might want to copy from initial occurrence
      });

      occurrenceCount++;
    }

    if (occurrences.length > 0) {
      const { error: insertError } = await serverSupabase
        .from("task_occurrences")
        .insert(occurrences);

      if (insertError) throw insertError;
    }
  };

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

  async updateTaskOccurrence(
    id: string,
    occurrenceData: Partial<TaskOccurrence>
  ): Promise<TaskOccurrence> {
    try {
      const { data, error } = await serverSupabase
        .from("task_occurrences")
        .update(occurrenceData)
        .eq("id", id)
        .select(
          `
        *,
        task:tasks(*)
      `
        )
        .single();

      if (error) {
        console.error("[TaskService] Error updating task occurrence:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        "[TaskService] Unexpected error in updateTaskOccurrence:",
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
