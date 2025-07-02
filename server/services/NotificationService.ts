import type { User, TaskDefinition, TaskOccurrence, NotificationPreferences } from "@/types";
import prisma from "@/server/utils/prisma/client";
import { format, isAfter, isBefore, addDays } from "date-fns";

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
          await this.sendEmailNotification(
            { ...user, notificationPreferences: userPreferences } as User,
            eventType,
            context
          );
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
  private shouldSendNotification(
    eventType: NotificationEventType,
    preferences: NotificationPreferences,
    context: NotificationContext,
    userId: string
  ): boolean {
    const isMine = this.isUserRelatedToOccurrence(userId, context);

    switch (eventType) {
      case "task_created":
        return preferences.taskCreated === "any" || 
               (preferences.taskCreated === "mine" && context.actionUser?.id !== userId);
      
      case "task_paused":
        return preferences.taskPaused === "any";
      
      case "task_completed":
        return preferences.taskCompleted === "any";
      
      case "task_deleted":
        return preferences.taskDeleted === "any";
      
      case "occurrence_assigned":
        return preferences.occurrenceAssigned === "any" ||
               (preferences.occurrenceAssigned === "mine" && isMine);
      
      case "occurrence_executed":
        return preferences.occurrenceExecuted === "any" ||
               (preferences.occurrenceExecuted === "mine" && isMine);
      
      case "occurrence_skipped":
        return preferences.occurrenceSkipped === "any" ||
               (preferences.occurrenceSkipped === "mine" && isMine);
      
      case "occurrence_commented":
        return preferences.occurrenceCommented === "any" ||
               (preferences.occurrenceCommented === "mine" && isMine);
      
      // Reminder notifications are always sent if configured
      case "task_reminder_initial":
      case "task_reminder_followup":
      case "task_reminder_overdue":
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Check if user is related to an occurrence (assignee or has commented)
   */
  private isUserRelatedToOccurrence(userId: string, context: NotificationContext): boolean {
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
   * Send actual email notification
   */
  private async sendEmailNotification(
    user: User,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void> {
    try {
      const { subject, body } = this.generateEmailContent(eventType, context, user);
      
      // Use the existing sendEmail API
      const response = await $fetch("/api/sendEmail", {
        method: "POST",
        body: {
          to: user.email,
          subject: subject,
          html: body,
        },
      });

      console.log(`[NotificationService] Sent ${eventType} notification to ${user.email}`);
    } catch (error) {
      console.error(`[NotificationService] Failed to send email to ${user.email}:`, error);
      throw error;
    }
  }

  /**
   * Generate email content for different notification types
   */
  private generateEmailContent(
    eventType: NotificationEventType,
    context: NotificationContext,
    user: User
  ): { subject: string; body: string } {
    const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const { task, occurrence, actionUser, household } = context;

    switch (eventType) {
      case "task_created":
        return {
          subject: `New Task: ${task?.name}`,
          body: this.renderEmailTemplate("task_created", {
            userName: user.name,
            taskName: task?.name,
            taskDescription: task?.description,
            categoryName: task?.category?.name,
            createdByName: actionUser?.name,
            householdName: household?.name,
            taskUrl: `${baseUrl}/tasks/${task?.id}`,
          }),
        };

      case "occurrence_assigned":
        return {
          subject: `Task Assigned: ${task?.name}`,
          body: this.renderEmailTemplate("occurrence_assigned", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate ? format(new Date(occurrence.dueDate), "PPP") : "",
            assignedByName: actionUser?.name,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };

      case "task_reminder_initial":
        const daysBefore = this.getDaysUntilDue(occurrence?.dueDate);
        return {
          subject: `Reminder: ${task?.name} due ${daysBefore > 0 ? `in ${daysBefore} days` : "today"}`,
          body: this.renderEmailTemplate("task_reminder", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate ? format(new Date(occurrence.dueDate), "PPP") : "",
            reminderType: "initial",
            daysUntilDue: daysBefore,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };

      case "task_reminder_overdue":
        const daysOverdue = Math.abs(this.getDaysUntilDue(occurrence?.dueDate));
        return {
          subject: `Overdue: ${task?.name} (${daysOverdue} days overdue)`,
          body: this.renderEmailTemplate("task_reminder", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate ? format(new Date(occurrence.dueDate), "PPP") : "",
            reminderType: "overdue",
            daysOverdue: daysOverdue,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };

      // Add other notification types...
      default:
        return {
          subject: `Adulting.DIY Notification`,
          body: this.renderEmailTemplate("generic", {
            userName: user.name,
            eventType: eventType,
            taskName: task?.name || "Unknown",
          }),
        };
    }
  }

  /**
   * Simple template rendering (can be enhanced with a proper template engine)
   */
  private renderEmailTemplate(templateName: string, variables: Record<string, any>): string {
    const templates = {
      task_created: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Task Created</h2>
          <p>Hi {{userName}},</p>
          <p>A new task has been created in your household:</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Category:</strong> {{categoryName}}</p>
            {{#if taskDescription}}<p><strong>Description:</strong> {{taskDescription}}</p>{{/if}}
            <p><strong>Created by:</strong> {{createdByName}}</p>
          </div>
          <p><a href="{{taskUrl}}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Task</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,
      
      occurrence_assigned: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Task Assigned to You</h2>
          <p>Hi {{userName}},</p>
          <p>You've been assigned a task:</p>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
            <p><strong>Assigned by:</strong> {{assignedByName}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Task</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,
      
      task_reminder: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: {{#if reminderType === 'overdue'}}#dc2626{{else}}#d97706{{/if}};">
            {{#if reminderType === 'overdue'}}Task Overdue{{else}}Task Reminder{{/if}}
          </h2>
          <p>Hi {{userName}},</p>
          <p>
            {{#if reminderType === 'overdue'}}
              Your task is {{daysOverdue}} days overdue:
            {{else}}
              {{#if daysUntilDue > 0}}
                Your task is due in {{daysUntilDue}} days:
              {{else}}
                Your task is due today:
              {{/if}}
            {{/if}}
          </p>
          <div style="background: {{#if reminderType === 'overdue'}}#fef2f2{{else}}#fffbeb{{/if}}; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: {{#if reminderType === 'overdue'}}#dc2626{{else}}#d97706{{/if}}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Complete Task</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,
      
      generic: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Adulting.DIY Notification</h2>
          <p>Hi {{userName}},</p>
          <p>You have a new notification regarding: {{taskName}}</p>
          <p>Event type: {{eventType}}</p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,
    };

    let template = templates[templateName as keyof typeof templates] || templates.generic;
    
    // Simple variable replacement (basic Handlebars-like syntax)
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, String(value || ''));
    });

    // Remove unused conditionals and variables (basic cleanup)
    template = template.replace(/{{#if[^}]*}}.*?{{\/if}}/gs, '');
    template = template.replace(/{{[^}]*}}/g, '');

    return template;
  }

  /**
   * Check and send reminders for a specific task
   */
  private async checkAndSendTaskReminders(task: TaskDefinition): Promise<number> {
    let remindersSent = 0;

    if (!task.reminderConfig) return 0;

    // Get upcoming occurrences for this task
    const upcomingOccurrences = await prisma.taskOccurrence.findMany({
      where: {
        taskId: task.id,
        status: { in: ["created", "assigned"] },
        dueDate: { gte: new Date() }, // Only future or today's occurrences
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
  private isDateToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Get days until due date (negative if overdue)
   */
  private getDaysUntilDue(dueDate?: Date): number {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      taskCreated: "mine",
      taskPaused: "any",
      taskCompleted: "any", 
      taskDeleted: "any",
      occurrenceAssigned: "mine",
      occurrenceExecuted: "mine",
      occurrenceSkipped: "mine",
      occurrenceCommented: "mine",
    };
  }
}