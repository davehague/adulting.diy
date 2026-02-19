// server/services/notifications/SlackProvider.ts
import type { NotificationEventType, NotificationContext } from "../NotificationService";
import type { NotificationProvider, NotificationRecipient } from "./NotificationProvider";
import { format } from "date-fns";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    url?: string;
  }>;
}

export class SlackProvider implements NotificationProvider {
  readonly channel = "slack" as const;

  async send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void> {
    const webhookUrl = recipient.channelConfig.slackWebhookUrl;
    if (!webhookUrl) {
      throw new Error("Slack webhook URL not configured");
    }

    const blocks = this.generateSlackBlocks(eventType, context);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      throw new Error(
        `Slack webhook failed: ${response.status} ${response.statusText}`
      );
    }

    console.log(
      `[SlackProvider] Sent ${eventType} notification to ${recipient.name}`
    );
  }

  /**
   * Generate Slack Block Kit blocks for different notification event types
   */
  private generateSlackBlocks(
    eventType: NotificationEventType,
    context: NotificationContext
  ): SlackBlock[] {
    const { task, occurrence, actionUser } = context;
    const baseUrl = useRuntimeConfig().appUrl;
    const taskName = task?.name || "Unknown Task";
    const categoryName = task?.category?.name;
    const dueDate = occurrence?.dueDate
      ? format(new Date(occurrence.dueDate), "PPP")
      : undefined;

    switch (eventType) {
      case "task_created":
        return this.buildBlocks(
          "New Task Created",
          `*${taskName}*${categoryName ? ` | ${categoryName}` : ""}\nCreated by ${actionUser?.name || "someone"}`,
          task?.id ? `${baseUrl}/tasks/${task.id}` : undefined,
          "View Task"
        );

      case "task_paused":
        return this.buildBlocks("Task Paused", `*${taskName}*`);

      case "task_deleted":
        return this.buildBlocks("Task Deleted", `*${taskName}*`);

      case "occurrence_assigned":
        return this.buildBlocks(
          "Task Assigned",
          `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ""}\nAssigned by ${actionUser?.name || "someone"}`,
          occurrence?.id
            ? `${baseUrl}/occurrences/${occurrence.id}`
            : undefined,
          "View Task"
        );

      case "occurrence_executed":
        return this.buildBlocks(
          "Task Completed",
          `*${taskName}*\nCompleted by ${actionUser?.name || "someone"}`,
          occurrence?.id
            ? `${baseUrl}/occurrences/${occurrence.id}`
            : undefined,
          "View Task"
        );

      case "occurrence_skipped":
        return this.buildBlocks(
          "Task Skipped",
          `*${taskName}*\nSkipped by ${actionUser?.name || "someone"}`,
          occurrence?.id
            ? `${baseUrl}/occurrences/${occurrence.id}`
            : undefined,
          "View Task"
        );

      case "occurrence_commented":
        return this.buildBlocks(
          "New Comment",
          `*${taskName}*\nComment by ${actionUser?.name || "someone"}`,
          occurrence?.id
            ? `${baseUrl}/occurrences/${occurrence.id}`
            : undefined,
          "View Task"
        );

      case "task_reminder": {
        const reminderEntry = context.reminderEntry;
        const timing = reminderEntry?.timing || 'before';
        let header: string;
        let sectionBody: string;

        if (timing === 'after') {
          const daysOverdue = reminderEntry?.days || this.getDaysOverdue(occurrence?.dueDate);
          header = "Task Overdue";
          sectionBody = `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ""}\nOverdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`;
        } else if (timing === 'on') {
          header = "Due Today";
          sectionBody = `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ""}`;
        } else {
          header = "Task Reminder";
          sectionBody = `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ""}`;
        }

        return this.buildBlocks(
          header,
          sectionBody,
          occurrence?.id
            ? `${baseUrl}/occurrences/${occurrence.id}`
            : undefined,
          "View Task"
        );
      }

      default:
        return this.buildBlocks("Notification", `*${taskName}*`);
    }
  }

  /**
   * Build the standard 3-block structure: header + section + optional actions
   */
  private buildBlocks(
    headerText: string,
    sectionText: string,
    actionUrl?: string,
    actionLabel?: string
  ): SlackBlock[] {
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: { type: "plain_text", text: headerText, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: sectionText },
      },
    ];

    if (actionUrl && actionLabel) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: actionLabel, emoji: true },
            url: actionUrl,
          },
        ],
      });
    }

    return blocks;
  }

  /**
   * Get days overdue (always returns a positive number)
   */
  private getDaysOverdue(dueDate?: Date): number {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }
}
