import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    const occurrenceId = event.context.params?.id;

    if (!occurrenceId) {
      throw createError({
        statusCode: 400,
        message: "Occurrence ID is required",
      });
    }

    const occurrenceService = new OccurrenceService();

    try {
      // First, verify the occurrence exists and belongs to the user's household
      const occurrence = await occurrenceService.findById(occurrenceId);

      if (!occurrence) {
        throw createError({
          statusCode: 404,
          message: "Occurrence not found",
        });
      }

      // The findById method should include task details including householdId
      // Adjust the check based on the actual structure returned by findById
      // Assuming occurrence.task.householdId exists
      if (!occurrence.task || occurrence.task.householdId !== householdId) {
        throw createError({
          statusCode: 403,
          message:
            "You do not have permission to view this occurrence's history",
        });
      }

      // If authorized, fetch the history logs
      const historyLogs = await occurrenceService.getHistory(occurrenceId);
      console.log(`[API] Fetched ${historyLogs.length} history logs for occurrence ${occurrenceId}`);
      if (historyLogs.length > 0) {
        console.log('[API] Sample log:', JSON.stringify(historyLogs[0], null, 2));
      }
      return historyLogs;
    } catch (error) {
      console.error("[API] Error fetching occurrence history:", error);

      if ((error as any).statusCode) {
        throw error; // Re-throw known H3 errors
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching occurrence history",
        cause: error,
      });
    }
  }
);
