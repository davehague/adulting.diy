import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";
import prisma from "@/server/utils/prisma/client";
import type { NotificationPreferences } from "@/types";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      // Get the user's notification preferences
      const user = await prisma.user.findUnique({
        where: { id: authUser.userId },
        select: {
          notificationPreferences: true,
        },
      });

      if (!user) {
        throw createError({
          statusCode: 404,
          message: "User not found",
        });
      }

      // Return the notification preferences or defaults
      const preferences = user.notificationPreferences as NotificationPreferences || {
        taskCreated: "mine",
        taskPaused: "any",
        taskCompleted: "any",
        taskDeleted: "any",
        occurrenceAssigned: "mine",
        occurrenceExecuted: "mine",
        occurrenceSkipped: "mine",
        occurrenceCommented: "mine",
      };

      return preferences;
    } catch (error) {
      console.error("[API] Error fetching notification preferences:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching notification preferences",
        cause: error,
      });
    }
  }
);