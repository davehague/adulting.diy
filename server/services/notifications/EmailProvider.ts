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
        headers: { authorization: `Bearer ${process.env.CRON_SECRET || ''}` },
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

      case "task_reminder": {
        const reminderEntry = context.reminderEntry;
        const timing = reminderEntry?.timing || 'before';
        const isOverdue = timing === 'after';

        // Determine heading, colors, and summary based on timing
        let heading: string;
        let headingColor: string;
        let bgColor: string;
        let buttonColor: string;
        let dueSummary: string;
        let subjectLine: string;

        if (isOverdue) {
          const daysOverdue = reminderEntry?.days || Math.abs(this.getDaysUntilDue(occurrence?.dueDate));
          heading = "Task Overdue";
          headingColor = "#dc2626";
          bgColor = "#fef2f2";
          buttonColor = "#dc2626";
          dueSummary = `Your task is ${daysOverdue} days overdue:`;
          subjectLine = `Overdue: ${task?.name} (${daysOverdue} days overdue)`;
        } else if (timing === 'on') {
          heading = "Due Today";
          headingColor = "#d97706";
          bgColor = "#fffbeb";
          buttonColor = "#d97706";
          dueSummary = "Your task is due today:";
          subjectLine = `Due Today: ${task?.name}`;
        } else {
          // before
          const daysBefore = reminderEntry?.days || this.getDaysUntilDue(occurrence?.dueDate);
          heading = "Task Reminder";
          headingColor = "#d97706";
          bgColor = "#fffbeb";
          buttonColor = "#d97706";
          if (daysBefore === 1) {
            dueSummary = "Your task is due tomorrow:";
            subjectLine = `Reminder: ${task?.name} due tomorrow`;
          } else if (daysBefore === 0) {
            dueSummary = "Your task is due today:";
            subjectLine = `Reminder: ${task?.name} due today`;
          } else {
            dueSummary = `Your task is due in ${daysBefore} days:`;
            subjectLine = `Reminder: ${task?.name} due in ${daysBefore} days`;
          }
        }

        return {
          subject: subjectLine,
          body: this.renderEmailTemplate("task_reminder", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate
              ? format(new Date(occurrence.dueDate), "PPP")
              : "",
            heading,
            headingColor,
            bgColor,
            buttonColor,
            dueSummary,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };
      }

      case "task_paused":
        return {
          subject: `Task Paused: ${task?.name}`,
          body: this.renderEmailTemplate("task_paused", {
            userName: user.name,
            taskName: task?.name,
            pausedByName: actionUser?.name,
            taskUrl: `${baseUrl}/tasks/${task?.id}`,
          }),
        };

      case "task_deleted":
        return {
          subject: `Task Deleted: ${task?.name}`,
          body: this.renderEmailTemplate("task_deleted", {
            userName: user.name,
            taskName: task?.name,
            deletedByName: actionUser?.name,
          }),
        };

      case "occurrence_executed":
        return {
          subject: `Task Completed: ${task?.name}`,
          body: this.renderEmailTemplate("occurrence_executed", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate ? format(new Date(occurrence.dueDate), "PPP") : "",
            completedByName: actionUser?.name,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };

      case "occurrence_skipped":
        return {
          subject: `Task Skipped: ${task?.name}`,
          body: this.renderEmailTemplate("occurrence_skipped", {
            userName: user.name,
            taskName: task?.name,
            dueDate: occurrence?.dueDate ? format(new Date(occurrence.dueDate), "PPP") : "",
            skippedByName: actionUser?.name,
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };

      case "occurrence_commented":
        return {
          subject: `New Comment: ${task?.name}`,
          body: this.renderEmailTemplate("occurrence_commented", {
            userName: user.name,
            taskName: task?.name,
            commentedByName: actionUser?.name,
            comment: context.comment || "",
            occurrenceUrl: `${baseUrl}/occurrences/${occurrence?.id}`,
          }),
        };

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

      task_reminder: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: {{headingColor}};">{{heading}}</h2>
          <p>Hi {{userName}},</p>
          <p>{{dueSummary}}</p>
          <div style="background: {{bgColor}}; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: {{buttonColor}}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Complete Task</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,

      task_paused: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Task Paused</h2>
          <p>Hi {{userName}},</p>
          <p>A task in your household has been paused:</p>
          <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Paused by:</strong> {{pausedByName}}</p>
          </div>
          <p>No new occurrences will be generated until the task is unpaused.</p>
          <p><a href="{{taskUrl}}" style="background: #d97706; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Task</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,

      task_deleted: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Task Deleted</h2>
          <p>Hi {{userName}},</p>
          <p>A task in your household has been deleted:</p>
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Deleted by:</strong> {{deletedByName}}</p>
          </div>
          <p>All future occurrences have been cancelled.</p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,

      occurrence_executed: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Task Completed</h2>
          <p>Hi {{userName}},</p>
          <p>A task has been completed in your household:</p>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
            <p><strong>Completed by:</strong> {{completedByName}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Details</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,

      occurrence_skipped: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Task Skipped</h2>
          <p>Hi {{userName}},</p>
          <p>A task has been skipped in your household:</p>
          <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
            <p><strong>Skipped by:</strong> {{skippedByName}}</p>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: #d97706; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Details</a></p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `,

      occurrence_commented: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Comment</h2>
          <p>Hi {{userName}},</p>
          <p>A new comment was added to a task in your household:</p>
          <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">{{taskName}}</h3>
            <p><strong>Comment by:</strong> {{commentedByName}}</p>
            <blockquote style="border-left: 3px solid #2563eb; margin: 8px 0; padding: 8px 12px; color: #4b5563;">{{comment}}</blockquote>
          </div>
          <p><a href="{{occurrenceUrl}}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Task</a></p>
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
