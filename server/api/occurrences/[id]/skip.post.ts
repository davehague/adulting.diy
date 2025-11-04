import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { createError, readBody } from "h3";

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

      // Read request body for the reason
      const body = await readBody(event);
      const reason = body.reason as string;

      console.log(`[API Skip] Received skip request for occurrence ${occurrenceId} with reason: "${reason}"`);

      if (!reason || typeof reason !== "string" || reason.trim() === "") {
        console.log(`[API Skip] Validation failed - reason is empty or invalid`);
        throw createError({
          statusCode: 400,
          message: "A non-empty reason is required to skip an occurrence",
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
      if (
        existingOccurrence.task &&
        existingOccurrence.task.householdId !== householdId // Use camelCase
      ) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to skip this occurrence",
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

      // Skip the occurrence using the service
      console.log(`[API Skip] Calling OccurrenceService.skip for occurrence ${occurrenceId}, user ${authUser.userId}`);
      const updatedOccurrence = await occurrenceService.skip(
        occurrenceId,
        authUser.userId,
        reason.trim()
      );

      console.log(`[API Skip] Successfully skipped occurrence ${occurrenceId}, new status: ${updatedOccurrence.status}`);
      return updatedOccurrence;
    } catch (error) {
      console.error("[API] Error skipping occurrence:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error skipping occurrence",
        cause: error,
      });
    }
  }
);
