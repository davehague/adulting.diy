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

      // Get task using the service
      const taskService = new TaskService();
      const task = await taskService.findById(taskId);

      // Check if task exists
      if (!task) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }

      // Ensure task belongs to user's household
      if (task.householdId !== householdId) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to access this task",
        });
      }

      return task;
    } catch (error) {
      console.error("[API] Error fetching task:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching task",
        cause: error,
      });
    }
  }
);
