import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { createError, readBody } from "h3";
import prisma from "@/server/utils/prisma/client";
import type { NotificationPreferences } from "@/types";

// Validation schema for notification preferences
const validPreferenceValues = ["any", "mine", "none"] as const;
const requiredFields = [
  "taskCreated",
  "taskPaused", 
  "taskCompleted",
  "taskDeleted",
  "occurrenceAssigned",
  "occurrenceExecuted",
  "occurrenceSkipped", 
  "occurrenceCommented",
] as const;

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      // Read the request body
      const body = await readBody(event);
      
      // Validate the notification preferences
      const preferences = body as NotificationPreferences;
      
      // Check that all required fields are present
      for (const field of requiredFields) {
        if (!preferences[field]) {
          throw createError({
            statusCode: 400,
            message: `Missing required field: ${field}`,
          });
        }
        
        if (!validPreferenceValues.includes(preferences[field])) {
          throw createError({
            statusCode: 400,
            message: `Invalid value for ${field}. Must be one of: ${validPreferenceValues.join(", ")}`,
          });
        }
      }

      // Update the user's notification preferences
      const updatedUser = await prisma.user.update({
        where: { id: authUser.userId },
        data: {
          notificationPreferences: preferences,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          notificationPreferences: true,
        },
      });

      console.log(`[API] Updated notification preferences for user ${authUser.userId}`);
      
      return {
        success: true,
        preferences: updatedUser.notificationPreferences,
      };
    } catch (error) {
      console.error("[API] Error updating notification preferences:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error updating notification preferences",
        cause: error,
      });
    }
  }
);