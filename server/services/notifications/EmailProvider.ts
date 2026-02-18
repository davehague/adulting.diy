// server/services/notifications/EmailProvider.ts
import type { User } from "@/types";
import type { NotificationEventType, NotificationContext } from "../NotificationService";
import type { NotificationProvider, NotificationRecipient } from "./NotificationProvider";
import { format } from "date-fns";

export class EmailProvider implements NotificationProvider {
  readonly channel = "email" as const;

  async send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void> {
    const user: User = {
      id: recipient.userId,
      name: recipient.name,
      email: recipient.email,
    } as User;

    const { subject, body } = this.generateEmailContent(eventType, context, user);

    try {
      await $fetch("/api/sendEmail", {
        method: "POST",
        headers: { "x-scheduler-key": process.env.SCHEDULER_API_KEY || "" },
        body: {
          to: recipient.email,
          subject: subject,
          html: body,
        },
      });

      console.log(`[EmailProvider] Sent ${eventType} notification to ${recipient.email}`);
    } catch (error) {
      console.error(`[EmailProvider] Failed to send email to ${recipient.email}:`, error);
      throw error;
    }
  }

  /**
   * Generate email content for different notification types
   */
  public generateEmailContent(
    eventType: NotificationEventType,
    context: NotificationContext,
    user: User
  ): { subject: string; body: string } {
    const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const { task, occurrence, actionUser, household } = context;

    switch (eventType) {
      case "task_created":
        const descriptionBlock = task?.description
          ? `<p><strong>Description:</strong> ${task.description}</p>`
          : "";
        return {
          subject: `New Task: ${task?.name}`,
          body: this.renderEmailTemplate("task_created", {
            userName: user.name,
            taskName: task?.name,
            descriptionBlock,
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
            dueDate: occurrence?.dueDate
              ? format(new Date(occurrence.dueDate), "PPP")
              : "",
            assignedByName: actionUser?.name,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };

      case "task_reminder_initial": {
        const daysBefore = this.getDaysUntilDue(occurrence?.dueDate);
        const dueSummary =
          daysBefore > 0
            ? `Your task is due in ${daysBefore} days:`
            : "Your task is due today:";
        return {
          subject: `Reminder: ${task?.name} ${daysBefore > 0 ? `due in ${daysBefore} days` : "due today"}`,
          body: this.renderEmailTemplate("task_reminder_initial", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate
              ? format(new Date(occurrence.dueDate), "PPP")
              : "",
            dueSummary,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };
      }

      case "task_reminder_followup": {
        const daysBeforeFollowup = this.getDaysUntilDue(occurrence?.dueDate);
        const dueSummaryFollowup =
          daysBeforeFollowup > 0
            ? `Your task is due in ${daysBeforeFollowup} days:`
            : "Your task is due today:";
        return {
          subject: `Follow-up: ${task?.name} ${daysBeforeFollowup > 0 ? `due in ${daysBeforeFollowup} days` : "due today"}`,
          body: this.renderEmailTemplate("task_reminder_followup", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate
              ? format(new Date(occurrence.dueDate), "PPP")
              : "",
            dueSummary: dueSummaryFollowup,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };
      }

      case "task_reminder_overdue": {
        const daysOverdue = Math.abs(this.getDaysUntilDue(occurrence?.dueDate));
        return {
          subject: `Overdue: ${task?.name} (${daysOverdue} days overdue)`,
          body: this.renderEmailTemplate("task_reminder_overdue", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate
              ? format(new Date(occurrence.dueDate), "PPP")
              : "",
            daysOverdue,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };
      }
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
  public renderEmailTemplate(
    templateName: string,
    variables: Record<string, any>
  ): string {
    const templates = {
      task_created: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Task Created</h2>
          <p>Hi {{userName}},</p>
          <p>A new task has been created in your household:</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Category:</strong> {{categoryName}}</p>
            {{descriptionBlock}}
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

      task_reminder_initial: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Task Reminder</h2>
          <p>Hi {{userName}},</p>
          <p>{{dueSummary}}</p>
          <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: #d97706; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Complete Task</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,

      task_reminder_followup: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Follow-up Reminder</h2>
          <p>Hi {{userName}},</p>
          <p>{{dueSummary}}</p>
          <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: #d97706; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Complete Task</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,

      task_reminder_overdue: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Task Overdue</h2>
          <p>Hi {{userName}},</p>
          <p>Your task is {{daysOverdue}} days overdue:</p>
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: #dc2626; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Complete Task</a></p>
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

    let template =
      templates[templateName as keyof typeof templates] || templates.generic;

    // Simple variable replacement (basic Handlebars-like syntax)
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      template = template.replace(regex, String(value || ""));
    });

    // Remove any unreplaced variables (basic cleanup)
    template = template.replace(/{{[^}]*}}/g, "");

    return template;
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
}
