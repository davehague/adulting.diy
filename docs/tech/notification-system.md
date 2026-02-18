# Notification System - Technical Reference

## Architecture

The notification system uses a **provider pattern** to support multiple delivery channels through a unified interface.

### Key Files

| File | Purpose |
|------|---------|
| `server/services/NotificationService.ts` | Core orchestration: preference evaluation, reminder scheduling, provider dispatch |
| `server/services/notifications/NotificationProvider.ts` | Provider interface definition |
| `server/services/notifications/EmailProvider.ts` | Email delivery via Mailjet |
| `server/services/notifications/SlackProvider.ts` | Slack delivery via incoming webhooks |
| `server/api/scheduler/reminders.ts` | Cron endpoint that triggers daily reminder processing |
| `server/api/user/notifications.get.ts` | Read user notification preferences |
| `server/api/user/notifications.put.ts` | Update user notification preferences (with Zod validation) |
| `types/notification.ts` | Type definitions and default preferences |
| `types/task.ts` | `ReminderConfig` and `ReminderEntry` types |

## Event Types

| Event | Category | Triggered By |
|-------|----------|-------------|
| `task_created` | Task | Creating a new task definition |
| `task_paused` | Task | Pausing a task |
| `task_deleted` | Task | Soft-deleting a task |
| `occurrence_assigned` | Occurrence | Assigning/reassigning an occurrence |
| `occurrence_executed` | Occurrence | Completing an occurrence |
| `occurrence_skipped` | Occurrence | Skipping an occurrence |
| `occurrence_commented` | Occurrence | Adding a comment |
| `task_reminder` | Reminder | Scheduler cron job (daily) |

## Provider Interface

```typescript
interface NotificationProvider {
  readonly channel: 'email' | 'slack';
  send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void>;
}
```

All providers implement this interface. The service iterates enabled providers and catches errors per-provider so one failure doesn't block others.

### Email Provider

- Sends via internal `/api/sendEmail` endpoint (Mailjet)
- Generates HTML email templates with event-specific content and color coding
- Reminder emails use timing-aware subjects and colors:
  - Amber for upcoming/due-today
  - Red for overdue
  - Green for completed
  - Blue for new/comments

### Slack Provider

- Posts to user-configured Slack incoming webhook URL
- Generates Slack Block Kit messages (header + section + optional action button)
- Webhook URL validated on preference save (`https://hooks.slack.com/services/...`)

## Reminder Processing Flow

```
Vercel Cron (daily at 13:00 UTC)
  └→ POST /api/scheduler/reminders
      └→ NotificationService.sendTaskReminders()
          ├→ Fetch all active tasks with reminderConfig
          └→ For each task:
              └→ checkAndSendTaskReminders(task)
                  ├→ Get active/assigned occurrences
                  └→ For each reminder entry in task.reminderConfig:
                      ├→ Calculate target date based on timing
                      │   before: dueDate - days
                      │   on: dueDate
                      │   after: dueDate + days
                      ├→ Check if today === target date (timezone-aware)
                      ├→ Check dedup: wasReminderSentToday()
                      ├→ Send notification (all enabled providers)
                      └→ Log reminder sent for dedup
```

### Deduplication

Reminders are deduplicated using `OccurrenceHistoryLog` entries:
- `logType`: `reminder_sent`
- `newValue`: dedup key in format `task_reminder:{timing}:{days}`
- Checked per-occurrence per-day, respecting household timezone

### Timezone Handling

- `isDateToday(date, timezone)` converts both current time and target date to household timezone before comparing
- Daily boundaries for dedup use household timezone, not UTC
- Uses `date-fns-tz` for timezone conversions

## Preference Evaluation Logic

```
shouldSendNotification(eventType, preferences, context, userId):
  1. Get preference value for eventType (any/mine/none)
  2. If 'none' → don't send
  3. If 'any' → send (unless actor exclusion applies)
  4. If 'mine' → check isUserRelatedToOccurrence()
     - User is in occurrence's assigneeIds, OR
     - User has commented on the occurrence
```

### Actor Exclusion

The user who triggers an action is excluded from receiving the notification for that action. Passed via `excludeUserId` parameter to `sendNotification()`.

## Adding a New Channel

1. Create a new provider class implementing `NotificationProvider` in `server/services/notifications/`
2. Add the channel to the `channels` type in `types/notification.ts`
3. Update `getEnabledProviders()` in `NotificationService.ts` to instantiate the new provider
4. Add any channel-specific config fields to `channelConfig` in the preferences type
5. Update the preferences validation in `server/api/user/notifications.put.ts`
6. Add UI controls in `components/NotificationPreferences.vue`
