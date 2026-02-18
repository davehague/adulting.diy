import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { createError, readBody } from "h3";
import prisma from "@/server/utils/prisma/client";
import type { NotificationPreferences } from "@/types";

// Validation schema for notification preferences
const validPreferenceValues = ["any", "mine", "none"] as const;
const requiredFields = [
  "task_created",
  "task_paused",
  "task_deleted",
  "occurrence_assigned",
  "occurrence_executed",
  "occurrence_skipped",
  "occurrence_commented",
  "reminder_initial",
  "reminder_followup",
  "reminder_overdue",
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

      // Validate channel toggles (optional — absent means email-only)
      if (preferences.channels !== undefined) {
        if (typeof preferences.channels !== 'object' ||
            typeof preferences.channels.email !== 'boolean' ||
            typeof preferences.channels.slack !== 'boolean') {
          throw createError({
            statusCode: 400,
            message: 'Invalid channels configuration. Expected { email: boolean, slack: boolean }',
          });
        }
      }

      // Validate channelConfig (optional)
      if (preferences.channelConfig !== undefined) {
        if (typeof preferences.channelConfig !== 'object') {
          throw createError({
            statusCode: 400,
            message: 'Invalid channelConfig. Expected an object.',
          });
        }

        // Validate Slack webhook URL format when provided
        if (preferences.channelConfig.slackWebhookUrl !== undefined) {
          const webhookUrl = preferences.channelConfig.slackWebhookUrl;
          if (typeof webhookUrl !== 'string' ||
              !webhookUrl.startsWith('https://hooks.slack.com/services/')) {
            throw createError({
              statusCode: 400,
              message: 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/services/',
            });
          }
        }

        // Require webhook URL when Slack channel is enabled
        if (preferences.channels?.slack === true &&
            !preferences.channelConfig?.slackWebhookUrl) {
          throw createError({
            statusCode: 400,
            message: 'Slack webhook URL is required when Slack notifications are enabled.',
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