import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";
import prisma from "@/server/utils/prisma/client";
import type { NotificationPreferences } from "@/types";
import { defaultNotificationPreferences } from "@/types/notification";

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

      // Return the notification preferences, merging with defaults so missing fields are filled
      const stored = user.notificationPreferences as NotificationPreferences;
      const preferences = stored ? { ...defaultNotificationPreferences, ...stored } : { ...defaultNotificationPreferences };

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