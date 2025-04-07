import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { createError, readBody } from "h3";
import type { TaskOccurrence } from "@/types"; // Import type

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

      // Read request body for update data
      const body = await readBody(event);

      // Validate input data (basic check)
      // Use camelCase consistent with Prisma schema expected by the service
      const updateData: Partial<
        Pick<TaskOccurrence, "dueDate" | "assigneeIds">
      > = {};
      if (body.dueDate) {
        // Validate date format if needed, or rely on Prisma/service validation
        try {
          updateData.dueDate = new Date(body.dueDate); // Use camelCase
        } catch (e) {
          throw createError({
            statusCode: 400,
            message: "Invalid due date format",
          });
        }
      }
      if (body.assigneeIds && Array.isArray(body.assigneeIds)) {
        // Ensure all IDs are strings (basic validation)
        if (body.assigneeIds.every((id: any) => typeof id === "string")) {
          updateData.assigneeIds = body.assigneeIds; // Use camelCase
        } else {
          throw createError({
            statusCode: 400,
            message: "Invalid assignee IDs format",
          });
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw createError({
          statusCode: 400,
          message: "No valid fields provided for update (dueDate, assigneeIds)",
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
          message: "You do not have permission to update this occurrence",
        });
      }

      // Update the occurrence using the service
      const updatedOccurrence = await occurrenceService.update(
        occurrenceId,
        authUser.userId,
        updateData
      );

      return updatedOccurrence;
    } catch (error) {
      console.error("[API] Error updating occurrence:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error updating occurrence",
        cause: error,
      });
    }
  }
);
