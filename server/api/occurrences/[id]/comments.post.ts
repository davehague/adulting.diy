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

      // Read request body for the comment
      const body = await readBody(event);
      const comment = body.comment as string;

      if (!comment || typeof comment !== "string" || comment.trim() === "") {
        throw createError({
          statusCode: 400,
          message: "A non-empty comment is required",
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
          message: "You do not have permission to comment on this occurrence",
        });
      }

      // Add the comment using the service
      const historyLog = await occurrenceService.addComment(
        occurrenceId,
        authUser.userId,
        comment.trim()
      );

      return historyLog;
    } catch (error) {
      console.error("[API] Error adding comment to occurrence:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error adding comment",
        cause: error,
      });
    }
  }
);
