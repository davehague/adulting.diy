import type { User, TaskDefinition, TaskOccurrence, NotificationPreferences } from "@/types";
import { defaultNotificationPreferences } from "@/types/notification";
import prisma from "@/server/utils/prisma/client";
import { addDays } from "date-fns";
import { EmailProvider } from "./notifications/EmailProvider";
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
}

export type NotificationEventType =
  | "task_created"
  | "task_paused"
  | "task_completed"
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
  ): Promise<void> {
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
            channelConfig: (userPreferences as any).channelConfig ?? {},
          };

          for (const provider of providers) {
            try {
              await provider.send(recipient, eventType, context);
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

      case "task_completed":
        return preferences.task_completed === "any";

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

      case "task_reminder_initial":
        return (preferences.reminder_initial || 'any') === 'any';
      case "task_reminder_followup":
        return (preferences.reminder_followup || 'any') === 'any';
      case "task_reminder_overdue":
        return (preferences.reminder_overdue || 'any') === 'any';

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

    // TODO: Check if user has commented on the occurrence
    // This would require checking the occurrence history logs
    // For now, just return false for comments
    return false;
  }

  /**
   * Get enabled notification providers based on user preferences
   */
  private getEnabledProviders(preferences: NotificationPreferences): NotificationProvider[] {
    const providers: NotificationProvider[] = [];
    const channels = (preferences as any).channels ?? { email: true, slack: false };
    if (channels.email) providers.push(new EmailProvider());
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
      const context: NotificationContext = {
        user: {} as User, // Will be populated for each recipient
        task,
        occurrence: occurrence as unknown as TaskOccurrence,
        household: { id: task.householdId, name: "" },
      };

      // Check for initial reminder
      if (task.reminderConfig.initialReminder) {
        const reminderDate = addDays(new Date(occurrence.dueDate), -task.reminderConfig.initialReminder);
        if (this.isDateToday(reminderDate)) {
          await this.sendNotification(task.householdId, "task_reminder_initial", context);
          remindersSent++;
        }
      }

      // Check for follow-up reminder
      if (task.reminderConfig.followUpReminder) {
        const reminderDate = addDays(new Date(occurrence.dueDate), -task.reminderConfig.followUpReminder);
        if (this.isDateToday(reminderDate)) {
          await this.sendNotification(task.householdId, "task_reminder_followup", context);
          remindersSent++;
        }
      }

      // Check for overdue reminder
      if (task.reminderConfig.overdueReminder) {
        const overdueDate = addDays(new Date(occurrence.dueDate), task.reminderConfig.overdueReminder);
        if (this.isDateToday(overdueDate)) {
          await this.sendNotification(task.householdId, "task_reminder_overdue", context);
          remindersSent++;
        }
      }
    }

    return remindersSent;
  }

  /**
   * Helper to check if a date is today
   */
  public isDateToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Get default notification preferences
   */
  public getDefaultPreferences(): NotificationPreferences {
    return { ...defaultNotificationPreferences };
  }
}
