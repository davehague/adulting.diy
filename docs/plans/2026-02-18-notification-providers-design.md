# Notification Provider Extensibility Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

The notification system is tightly coupled to email. `sendNotification()` iterates users and directly calls `sendEmailNotification()` with no channel abstraction. Adding a second provider (Slack, SMS, etc.) requires a meaningful refactor.

## Design Decisions

- **Global channel toggle** - Users enable/disable channels (email, Slack). Existing per-event preferences (any/mine/none) apply to all enabled channels identically. No per-channel event preferences.
- **User-level config** - Each user picks which channels they want. Provider API keys live in env vars (deployment-wide), channel toggles and config live on the user record.
- **Slack via incoming webhook** - Users create a Slack incoming webhook, paste the URL in their profile. No OAuth, no Slack app, no bot tokens.

## Provider Interface

```typescript
// server/services/notifications/NotificationProvider.ts
interface NotificationProvider {
  readonly channel: 'email' | 'slack';

  send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void>;
}

interface NotificationRecipient {
  userId: string;
  name: string;
  email: string;
  channelConfig: Record<string, string>;
}
```

**EmailProvider** wraps the existing Mailjet logic. `sendEmailNotification()`, `generateEmailContent()`, and `renderEmailTemplate()` move here unchanged.

**SlackProvider** POSTs Block Kit JSON to the user's webhook URL via `fetch()`. No SDK needed.

Each provider owns its own message formatting. No shared template abstraction - email uses HTML strings, Slack uses Block Kit JSON.

## Preferences Model

Two new fields added to the existing `NotificationPreferences` type:

```typescript
interface NotificationPreferences {
  // Existing per-event preferences (unchanged)
  task_created: 'any' | 'none';
  task_paused: 'any' | 'none';
  task_completed: 'any' | 'none';
  task_deleted: 'any' | 'none';
  occurrence_assigned: 'any' | 'mine' | 'none';
  occurrence_executed: 'any' | 'mine' | 'none';
  occurrence_skipped: 'any' | 'mine' | 'none';
  occurrence_commented: 'any' | 'mine' | 'none';
  reminder_initial: 'any' | 'none';
  reminder_followup: 'any' | 'none';
  reminder_overdue: 'any' | 'none';

  // NEW: channel toggles
  channels: {
    email: boolean;    // default: true
    slack: boolean;    // default: false
  };

  // NEW: channel-specific config
  channelConfig: {
    slackWebhookUrl?: string;
  };
}
```

Stored in the existing `notificationPreferences` JSON field on the User model. No Prisma migration needed. Existing users with no `channels` key are treated as `{ email: true, slack: false }` via fallback in `getDefaultPreferences()`.

Validation: when Slack is enabled, `slackWebhookUrl` must be present and match `https://hooks.slack.com/services/`.

## NotificationService Refactor

The service stays as the orchestrator but delegates delivery to providers:

```
sendNotification(householdId, eventType, context)
  -> fetch household users from DB
  -> for each user:
      -> shouldSendNotification(eventType, preferences, context, userId)  // unchanged
      -> if yes: getEnabledProviders(user.preferences)
        -> for each provider: provider.send(recipient, eventType, context)
```

**Moves out of NotificationService:**
- `sendEmailNotification()` -> `EmailProvider.send()`
- `generateEmailContent()` -> `EmailProvider` (private)
- `renderEmailTemplate()` -> `EmailProvider` (private)

**Stays in NotificationService:**
- `sendNotification()` - orchestration
- `sendTaskReminders()` - reminder scheduling
- `shouldSendNotification()` - preference evaluation
- `isUserRelatedToOccurrence()` - context helper
- `checkAndSendTaskReminders()` - reminder checking
- Date helpers (`isDateToday`, `getDaysUntilDue`)
- `getDefaultPreferences()`

**New method:**
```typescript
private getEnabledProviders(preferences: NotificationPreferences): NotificationProvider[] {
  const providers: NotificationProvider[] = [];
  const channels = preferences.channels ?? { email: true, slack: false };
  if (channels.email) providers.push(new EmailProvider());
  if (channels.slack && preferences.channelConfig?.slackWebhookUrl) {
    providers.push(new SlackProvider());
  }
  return providers;
}
```

Error handling: each provider call is wrapped individually. If Slack fails, email still sends (and vice versa). Notifications remain non-throwing - they never break main functionality.

## Slack Message Formatting

Messages use Block Kit via webhook POST. Example payload:

```json
{
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "Task Reminder" } },
    { "type": "section", "text": { "type": "mrkdwn",
        "text": "*Clean the gutters*\nDue: February 20, 2026" } },
    { "type": "actions", "elements": [
      { "type": "button", "text": { "type": "plain_text", "text": "View Task" },
        "url": "https://adulting.diy/occurrences/abc123" }
    ]}
  ]
}
```

A `generateSlackContent()` method mirrors `generateEmailContent()` - same switch on event type, same context, but outputs Block Kit blocks instead of HTML.

## UI Changes

`NotificationPreferences.vue` gets a new "Notification Channels" section at the top:

- Toggle row for Email (on by default, always available)
- Toggle row for Slack (off by default)
- When Slack is toggled on: text input for webhook URL + help link to Slack's webhook setup docs
- Optional "Test" button to verify the webhook works
- Note above existing event preferences: "These preferences apply to all enabled channels above."

No other pages change. The existing `PUT /api/user/notifications` endpoint handles the updated preferences shape with updated Zod validation.

## File Changes

**New files:**
```
server/services/notifications/
  NotificationProvider.ts      # Interface + NotificationRecipient type
  EmailProvider.ts             # Existing email logic extracted here
  SlackProvider.ts             # New Slack implementation
```

**Modified files:**
```
server/services/NotificationService.ts  # Slimmed down, delegates to providers
types/notification.ts                   # Add channels + channelConfig
components/NotificationPreferences.vue  # Channel toggles + webhook input
server/api/user/notifications.put.ts    # Updated Zod validation
```

## Testing

- Unit tests for `SlackProvider` - mock `fetch`, verify Block Kit payload for each event type
- Unit tests for `EmailProvider` - existing email tests migrate here
- Unit tests for `getEnabledProviders()` - provider selection based on preferences
- Update existing `notifications.test.ts` and `notification-service.test.ts` for refactored structure
- Integration test: mock both providers, verify fan-out and independent error handling

## Out of Scope

- No Prisma migration (JSON field handles new shape)
- No new API endpoints (existing PUT handles it)
- No shared cross-channel template abstraction
- No per-channel event preferences
- No Slack OAuth / bot DMs (just webhooks)
