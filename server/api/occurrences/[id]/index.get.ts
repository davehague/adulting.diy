import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { TaskService } from "@/server/services/TaskService";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      // Get occurrence ID from route params
      const occurrenceId = event.context.params?.id;

      if (!occurrenceId) {
        throw createError({
          statusCode: 400,
          message: "Occurrence ID is required",
        });
      }

      // Get occurrence using the service
      const occurrenceService = new OccurrenceService();
      const occurrence = await occurrenceService.findById(occurrenceId);

      // Check if occurrence exists
      if (!occurrence) {
        throw createError({
          statusCode: 404,
          message: "Occurrence not found",
        });
      }

      // Get the task to verify household
      const taskService = new TaskService();
      const task = await taskService.findById(occurrence.taskId); // Use camelCase taskId

      // Ensure task belongs to user's household
      if (!task || task.householdId !== householdId) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to access this occurrence",
        });
      }

      return occurrence;
    } catch (error) {
      console.error("[API] Error fetching occurrence:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching occurrence",
        cause: error,
      });
    }
  }
);
