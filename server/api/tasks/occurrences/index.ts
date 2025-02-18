// server/api/tasks/occurrences/index.ts
import { type TaskOccurrence } from "@/types/tasks";
import { TaskService } from "@/server/services/TaskService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";

const taskService = new TaskService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (event.method === "GET") {
    const { organization_id, task_id } = getQuery(event);

    // If task_id is provided, fetch occurrences for that specific task
    if (task_id) {
      try {
        // First verify the task exists and user has access
        const task = await taskService.findTaskById(task_id as string);
        if (!task) {
          throw createError({
            statusCode: 404,
            message: "Task not found",
          });
        }
        if (task.organization_id !== authenticatedUser.organizationId) {
          throw createError({
            statusCode: 403,
            message: "Unauthorized access to task",
          });
        }

        const occurrences = await taskService.findOccurrencesByTaskId(
          task_id as string
        );
        return occurrences;
      } catch (error) {
        throw createError({
          statusCode: 500,
          message: "Failed to fetch task occurrences",
        });
      }
    }

    // Existing organization-wide fetch logic
    if (!organization_id) {
      throw createError({
        statusCode: 400,
        message: "organization_id parameter is required",
      });
    }

    try {
      const occurrences =
        await taskService.findPendingOccurrencesByOrganization(
          organization_id as string
        );
      return occurrences;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: "Failed to fetch task occurrences",
      });
    }
  }

  if (event.method === "POST") {
    try {
      const body = await readBody(event);
      const occurrenceData: Omit<
        TaskOccurrence,
        "id" | "created_at" | "updated_at"
      > = body;

      const occurrence = await taskService.createTaskOccurrence(occurrenceData);
      return occurrence;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: "Failed to create task occurrence",
      });
    }
  }

  throw createError({
    statusCode: 405,
    message: "Method not allowed",
  });
});
