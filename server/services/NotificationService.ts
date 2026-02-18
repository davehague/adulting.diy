import type { User, TaskDefinition, TaskOccurrence, NotificationPreferences } from "@/types";
import { defaultNotificationPreferences } from "@/types/notification";
import prisma from "@/server/utils/prisma/client";
import { format, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { EmailProvider } from "./notifications/EmailProvider";
import { SlackProvider } from "./notifications/SlackProvider";
import type { NotificationProvider, NotificationRecipient } from "./notifications/NotificationProvider";

export interface NotificationContext {
  user: User;
  task?: TaskDefinition;
  occurrence?: TaskOccurrence;
  actionUser?: User; // User who performed the action
  household?: {
    id: string;
    name: string;
  };
  comment?: string;
}

export type NotificationEventType =
  | "task_created"
  | "task_paused"
  | "task_deleted"
  | "occurrence_assigned"
  | "occurrence_executed"
  | "occurrence_skipped"
  | "occurrence_commented"
  | "task_reminder_initial"
  | "task_reminder_followup"
  | "task_reminder_overdue";

export class NotificationService {
  /**
   * Send notification to users in a household based on their preferences
   */
  async sendNotification(
    householdId: string,
    eventType: NotificationEventType,
    context: NotificationContext,
    excludeUserId?: string // Don't notify the user who triggered the action
  ): Promise<boolean> {
    let anySucceeded = false;
    try {
      // Get all users in the household with their notification preferences
      const householdUsers = await prisma.user.findMany({
        where: {
          householdId: householdId,
          ...(excludeUserId && { id: { not: excludeUserId } })
        },
        select: {
          id: true,
          email: true,
          name: true,
          notificationPreferences: true,
        },
      });

      for (const user of householdUsers) {
        const userPreferences = user.notificationPreferences as NotificationPreferences || this.getDefaultPreferences();

        if (this.shouldSendNotification(eventType, userPreferences, context, user.id)) {
          const providers = this.getEnabledProviders(userPreferences);
          const recipient: NotificationRecipient = {
            userId: user.id,
            name: user.name,
            email: user.email,
            channelConfig: userPreferences.channelConfig ?? {},
          };

          for (const provider of providers) {
            try {
              await provider.send(recipient, eventType, context);
              anySucceeded = true;
            } catch (error) {
              console.error(`[NotificationService] ${provider.channel} failed for ${user.email}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`[NotificationService] Error sending ${eventType} notification:`, error);
      // Don't throw - notifications shouldn't break main functionality
    }
    return anySucceeded;
  }

  /**
   * Send reminder notifications for due tasks
   */
  async sendTaskReminders(): Promise<{ sent: number; errors: number }> {
    let sent = 0;
    let errors = 0;

    try {
      console.log("[NotificationService] Checking for task reminders...");

      // Get all active tasks with reminder configurations
      const tasksWithReminders = await prisma.taskDefinition.findMany({
        where: {
          metaStatus: "active",
          reminderConfig: { not: null },
        },
        include: {
          household: true,
          category: true,
        },
      });

      for (const task of tasksWithReminders) {
        try {
          const reminders = await this.checkAndSendTaskReminders(task as unknown as TaskDefinition);
          sent += reminders;
        } catch (error) {
          console.error(`[NotificationService] Error processing reminders for task ${task.id}:`, error);
          errors++;
        }
      }

      console.log(`[NotificationService] Task reminders complete. Sent: ${sent}, Errors: ${errors}`);
    } catch (error) {
      console.error("[NotificationService] Error in sendTaskReminders:", error);
      errors++;
    }

    return { sent, errors };
  }

  /**
   * Check if a notification should be sent based on user preferences
   */
  public shouldSendNotification(
    eventType: NotificationEventType,
    preferences: NotificationPreferences,
    context: NotificationContext,
    userId: string
  ): boolean {
    const isMine = this.isUserRelatedToOccurrence(userId, context);

    switch (eventType) {
      case "task_created":
        return preferences.task_created === "any" && context.actionUser?.id !== userId;

      case "task_paused":
        return preferences.task_paused === "any";

      case "task_deleted":
        return preferences.task_deleted === "any";

      case "occurrence_assigned":
        return preferences.occurrence_assigned === "any" ||
               (preferences.occurrence_assigned === "mine" && isMine);

      case "occurrence_executed":
        return preferences.occurrence_executed === "any" ||
               (preferences.occurrence_executed === "mine" && isMine);

      case "occurrence_skipped":
        return preferences.occurrence_skipped === "any" ||
               (preferences.occurrence_skipped === "mine" && isMine);

      case "occurrence_commented":
        return preferences.occurrence_commented === "any" ||
               (preferences.occurrence_commented === "mine" && isMine);

      case "task_reminder_initial": {
        const pref = preferences.reminder_initial || 'any';
        return pref === 'any' || (pref === 'mine' && isMine);
      }
      case "task_reminder_followup": {
        const pref = preferences.reminder_followup || 'any';
        return pref === 'any' || (pref === 'mine' && isMine);
      }
      case "task_reminder_overdue": {
        const pref = preferences.reminder_overdue || 'any';
        return pref === 'any' || (pref === 'mine' && isMine);
      }

      default:
        return false;
    }
  }

  /**
   * Check if user is related to an occurrence (assignee or has commented)
   */
  public isUserRelatedToOccurrence(userId: string, context: NotificationContext): boolean {
    if (!context.occurrence) return false;

    // Check if user is assigned to the occurrence
    if (context.occurrence.assigneeIds.includes(userId)) {
      return true;
    }

    // Check if user has commented on the occurrence
    if ((context.occurrence as any).commentUserIds?.includes(userId)) {
      return true;
    }

    return false;
  }

  /**
   * Get enabled notification providers based on user preferences
   */
  private getEnabledProviders(preferences: NotificationPreferences): NotificationProvider[] {
    const providers: NotificationProvider[] = [];
    const channels = preferences.channels ?? { email: true, slack: false };
    if (channels.email) providers.push(new EmailProvider());
    if (channels.slack && preferences.channelConfig?.slackWebhookUrl) {
      providers.push(new SlackProvider());
    }
    return providers;
  }

  /**
   * Check and send reminders for a specific task
   */
  public async checkAndSendTaskReminders(task: TaskDefinition): Promise<number> {
    let remindersSent = 0;

    if (!task.reminderConfig) return 0;

    // Include past-due occurrences so overdue reminders can fire
    const lookbackDays = task.reminderConfig.overdueReminder || 0;
    const earliestDate = addDays(new Date(), -lookbackDays);

    const upcomingOccurrences = await prisma.taskOccurrence.findMany({
      where: {
        taskId: task.id,
        status: { in: ["created", "assigned"] },
        dueDate: { gte: earliestDate },
      },
      orderBy: { dueDate: "asc" },
    });

    for (const occurrence of upcomingOccurrences) {
      const householdTimezone = (task as any).household?.timezone || 'UTC';

      const context: NotificationContext = {
        user: {} as User, // Will be populated for each recipient
        task,
        occurrence: occurrence as unknown as TaskOccurrence,
        household: { id: task.householdId, name: (task as any).household?.name || "" },
      };

      // Check for initial reminder
      if (task.reminderConfig.initialReminder) {
        const reminderDate = addDays(new Date(occurrence.dueDate), -task.reminderConfig.initialReminder);
        if (this.isDateToday(reminderDate, householdTimezone) && !(await this.wasReminderSentToday(occurrence.id, "task_reminder_initial", householdTimezone))) {
          const sent = await this.sendNotification(task.householdId, "task_reminder_initial", context);
          if (sent) {
            await this.logReminderSent(occurrence.id, "task_reminder_initial", task.createdByUserId);
            remindersSent++;
          }
        }
      }

      // Check for follow-up reminder
      if (task.reminderConfig.followUpReminder) {
        const reminderDate = addDays(new Date(occurrence.dueDate), -task.reminderConfig.followUpReminder);
        if (this.isDateToday(reminderDate, householdTimezone) && !(await this.wasReminderSentToday(occurrence.id, "task_reminder_followup", householdTimezone))) {
          const sent = await this.sendNotification(task.householdId, "task_reminder_followup", context);
          if (sent) {
            await this.logReminderSent(occurrence.id, "task_reminder_followup", task.createdByUserId);
            remindersSent++;
          }
        }
      }

      // Check for overdue reminder
      if (task.reminderConfig.overdueReminder) {
        const overdueDate = addDays(new Date(occurrence.dueDate), task.reminderConfig.overdueReminder);
        if (this.isDateToday(overdueDate, householdTimezone) && !(await this.wasReminderSentToday(occurrence.id, "task_reminder_overdue", householdTimezone))) {
          const sent = await this.sendNotification(task.householdId, "task_reminder_overdue", context);
          if (sent) {
            await this.logReminderSent(occurrence.id, "task_reminder_overdue", task.createdByUserId);
            remindersSent++;
          }
        }
      }
    }

    return remindersSent;
  }

  /**
   * Check if a reminder of a given type was already sent today for an occurrence
   */
  private async wasReminderSentToday(occurrenceId: string, reminderType: NotificationEventType, timezone: string = 'UTC'): Promise<boolean> {
    const nowInTz = toZonedTime(new Date(), timezone);
    const todayStart = new Date(nowInTz);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingLog = await prisma.occurrenceHistoryLog.findFirst({
      where: {
        occurrenceId,
        logType: "reminder_sent",
        newValue: reminderType,
        createdAt: {
          gte: todayStart,
          lt: tomorrow,
        },
      },
    });

    return !!existingLog;
  }

  /**
   * Log that a reminder was sent for deduplication
   */
  private async logReminderSent(occurrenceId: string, reminderType: NotificationEventType, userId: string): Promise<void> {
    await prisma.occurrenceHistoryLog.create({
      data: {
        occurrenceId,
        userId,
        logType: "reminder_sent",
        newValue: reminderType,
        comment: `${reminderType} reminder sent`,
      },
    });
  }

  /**
   * Helper to check if a date is today
   */
  public isDateToday(date: Date, timezone: string = 'UTC'): boolean {
    const nowInTz = toZonedTime(new Date(), timezone);
    const dateInTz = toZonedTime(date, timezone);
    return format(nowInTz, 'yyyy-MM-dd') === format(dateInTz, 'yyyy-MM-dd');
  }

  /**
   * Get default notification preferences
   */
  public getDefaultPreferences(): NotificationPreferences {
    return { ...defaultNotificationPreferences };
  }
}
