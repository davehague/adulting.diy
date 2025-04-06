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
      if (
        existingOccurrence.task &&
        existingOccurrence.task.household_id !== householdId
      ) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to execute this occurrence",
        });
      }

      // Check if the occurrence is already completed or skipped
      if (
        existingOccurrence.status === "completed" ||
        existingOccurrence.status === "skipped"
      ) {
        throw createError({
          statusCode: 400,
          message: `Occurrence is already ${existingOccurrence.status}`,
        });
      }

      // Execute the occurrence using the service
      const updatedOccurrence = await occurrenceService.execute(
        occurrenceId,
        authUser.userId
      );

      return updatedOccurrence;
    } catch (error) {
      console.error("[API] Error executing occurrence:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error executing occurrence",
        cause: error,
      });
    }
  }
);
