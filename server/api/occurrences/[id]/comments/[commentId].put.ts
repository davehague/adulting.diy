import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { createError, readBody } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const occurrenceId = event.context.params?.id;
      const commentId = event.context.params?.commentId;

      if (!occurrenceId || !commentId) {
        throw createError({
          statusCode: 400,
          message: "Occurrence ID and Comment ID are required",
        });
      }

      const body = await readBody(event);
      const comment = body.comment as string;

      if (!comment || typeof comment !== "string" || comment.trim() === "") {
        throw createError({
          statusCode: 400,
          message: "A non-empty comment is required",
        });
      }

      const occurrenceService = new OccurrenceService();

      // Verify occurrence exists and belongs to user's household
      const existingOccurrence = await occurrenceService.findById(occurrenceId);

      if (!existingOccurrence) {
        throw createError({
          statusCode: 404,
          message: "Occurrence not found",
        });
      }

      if (
        existingOccurrence.task &&
        existingOccurrence.task.householdId !== householdId
      ) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to edit comments on this occurrence",
        });
      }

      // Update the comment (service verifies ownership)
      const updatedLog = await occurrenceService.updateComment(
        commentId,
        authUser.userId,
        comment.trim()
      );

      return updatedLog;
    } catch (error) {
      console.error("[API] Error updating comment:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error updating comment",
        cause: error,
      });
    }
  }
);
