import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import { createError, readBody } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const taskId = event.context.params?.id;

      if (!taskId) {
        throw createError({
          statusCode: 400,
          message: "Task ID is required",
        });
      }

      const taskService = new TaskService();

      // Verify task exists and belongs to user's household
      const existingTask = await taskService.findById(taskId);

      if (!existingTask) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }

      if (existingTask.householdId !== householdId) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to catch up this task",
        });
      }

      // Read optional comment from body
      const body = await readBody(event).catch(() => ({}));
      const comment = body?.comment as string | undefined;

      // Perform catch-up
      const result = await taskService.catchUp(taskId, authUser.userId, comment);

      return result;
    } catch (error) {
      console.error("[API] Error catching up task:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      // Map known service errors to HTTP errors
      if ((error as Error).message === "No overdue occurrences to catch up") {
        throw createError({
          statusCode: 400,
          message: "No overdue occurrences to catch up",
        });
      }

      throw createError({
        statusCode: 500,
        message: "Server error catching up task",
        cause: error,
      });
    }
  }
);
