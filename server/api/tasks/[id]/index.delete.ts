import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      // Get task ID from route params
      const taskId = event.context.params?.id;

      if (!taskId) {
        throw createError({
          statusCode: 400,
          message: "Task ID is required",
        });
      }

      // Get task service
      const taskService = new TaskService();

      // Verify task exists and belongs to user's household
      const existingTask = await taskService.findById(taskId);

      if (!existingTask) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }

      if (existingTask.household_id !== householdId) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to delete this task",
        });
      }

      // Check if task is already deleted
      if (existingTask.meta_status === "soft-deleted") {
        throw createError({
          statusCode: 400,
          message: "Task is already deleted",
        });
      }

      // Soft delete task using the service
      const task = await taskService.softDelete(taskId);

      return {
        success: true,
        task,
      };
    } catch (error) {
      console.error("[API] Error deleting task:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error deleting task",
        cause: error,
      });
    }
  }
);
