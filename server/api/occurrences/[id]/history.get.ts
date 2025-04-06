import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { OccurrenceService } from "@/server/services/OccurrenceService";
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

      // Get occurrence service
      const occurrenceService = new OccurrenceService();

      // Verify occurrence exists and belongs to user's household
      const existingOccurrence = await occurrenceService.findById(occurrenceId);

      if (!existingOccurrence) {
        throw createError({
          statusCode: 404,
          message: "Occurrence not found",
        });
      }

      // Check household membership via the parent task
      // We included the task in findById, so we can access its household_id
      // Removed logging

      if (
        existingOccurrence.task &&
        existingOccurrence.task.householdId !== householdId // Use camelCase
      ) {
        // Removed logging
        throw createError({
          statusCode: 403,
          message:
            "You do not have permission to view history for this occurrence",
        });
      }
      // Removed logging

      // Get the history logs using the service
      const historyLogs = await occurrenceService.getHistory(occurrenceId);

      return historyLogs;
    } catch (error) {
      console.error("[API] Error fetching occurrence history:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching occurrence history",
        cause: error,
      });
    }
  }
);
