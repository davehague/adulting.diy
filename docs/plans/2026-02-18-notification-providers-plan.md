# Notification Provider Extensibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the notification system to support multiple delivery channels (email + Slack) via a provider interface, with user-level channel toggles.

**Architecture:** Extract email delivery into an `EmailProvider` class, add a `SlackProvider` that posts Block Kit messages to incoming webhooks, and update `NotificationService` to dispatch to all enabled providers per user. Preferences get `channels` and `channelConfig` fields; the UI gets a channel toggles section.

**Tech Stack:** TypeScript, Vitest, Vue 3 (Composition API), Tailwind CSS, Slack Incoming Webhooks (Block Kit JSON via fetch)

---

### Task 1: Create the NotificationProvider Interface

**Files:**
- Create: `server/services/notifications/NotificationProvider.ts`

**Step 1: Create the interface file**

```typescript
// server/services/notifications/NotificationProvider.ts
import type { NotificationEventType, NotificationContext } from '../NotificationService';

export interface NotificationRecipient {
  userId: string;
  name: string;
  email: string;
  channelConfig: Record<string, string>;
}

export interface NotificationProvider {
  readonly channel: 'email' | 'slack';

  send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void>;
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --skipLibCheck server/services/notifications/NotificationProvider.ts 2>&1 || echo "Type check done"`

If the Nuxt path aliases cause issues with bare `tsc`, just verify the import works by checking the next task (EmailProvider) compiles.

**Step 3: Commit**

```bash
git add server/services/notifications/NotificationProvider.ts
git commit -m "feat: add NotificationProvider interface"
```

---

### Task 2: Extract EmailProvider from NotificationService

**Files:**
- Create: `server/services/notifications/EmailProvider.ts`
- Modify: `server/services/NotificationService.ts`

**Step 1: Create EmailProvider**

Move `sendEmailNotification()`, `generateEmailContent()`, and `renderEmailTemplate()` from `NotificationService` into `EmailProvider`. The methods stay virtually identical — they just live in a new class that implements `NotificationProvider`.

```typescript
// server/services/notifications/EmailProvider.ts
import type { NotificationProvider, NotificationRecipient } from './NotificationProvider';
import type { NotificationEventType, NotificationContext } from '../NotificationService';
import type { User } from '@/types';
import { format } from 'date-fns';

export class EmailProvider implements NotificationProvider {
  readonly channel = 'email' as const;

  async send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void> {
    const user = {
      ...recipient,
      notificationPreferences: {},
    } as User;

    const { subject, body } = this.generateEmailContent(eventType, context, user);

    const response = await $fetch('/api/sendEmail', {
      method: 'POST',
      headers: { 'x-scheduler-key': process.env.SCHEDULER_API_KEY || '' },
      body: {
        to: recipient.email,
        subject,
        html: body,
      },
    });

    console.log(`[EmailProvider] Sent ${eventType} notification to ${recipient.email}`);
  }

  // Copy generateEmailContent() exactly from NotificationService lines 214-308
  // Copy renderEmailTemplate() exactly from NotificationService lines 314-412
  // Copy getDaysUntilDue() exactly from NotificationService lines 485-491
  // (These are private helpers used only by email formatting)
}
```

The full method bodies are already in `NotificationService.ts` — copy them verbatim. The only change is `this.getDaysUntilDue()` is now a private method on `EmailProvider` instead of `NotificationService`.

**Step 2: Update NotificationService to use EmailProvider**

In `NotificationService.ts`:

1. Remove `sendEmailNotification()`, `generateEmailContent()`, `renderEmailTemplate()` methods
2. Add import: `import { EmailProvider } from './notifications/EmailProvider';`
3. Add import: `import type { NotificationProvider, NotificationRecipient } from './notifications/NotificationProvider';`
4. Add new method:

```typescript
private getEnabledProviders(preferences: NotificationPreferences): NotificationProvider[] {
  const providers: NotificationProvider[] = [];
  const channels = (preferences as any).channels ?? { email: true, slack: false };
  if (channels.email) providers.push(new EmailProvider());
  return providers;
}
```

5. Replace the body of the `for (const user of householdUsers)` loop in `sendNotification()`:

```typescript
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
        // Continue to next provider — don't let one failure block others
      }
    }
  }
}
```

**Step 3: Run existing tests to verify no regressions**

Run: `npx vitest run 2>&1 | tail -20`

Expected: All 210 tests pass. The tests that exercise `shouldSendNotification`, `isDateToday`, `getDaysUntilDue`, and `getDefaultPreferences` still work because those methods stay on `NotificationService`. The `renderEmailTemplate` and `generateEmailContent` tests will fail — we fix them in the next step.

**Step 4: Update test imports for extracted methods**

In `tests/unit/services/notification-service.test.ts`, the `renderEmailTemplate` and `generateEmailContent` describe blocks call `service.renderEmailTemplate(...)` and `service.generateEmailContent(...)`. These methods now live on `EmailProvider`.

Update the test file:
- Add import: `import { EmailProvider } from '@/server/services/notifications/EmailProvider';`
- In the `renderEmailTemplate` describe block, change `const service = new NotificationService()` to `const provider = new EmailProvider()` and change `service.renderEmailTemplate(...)` to `provider.renderEmailTemplate(...)`. Make `renderEmailTemplate` public on `EmailProvider` for testability.
- Same for `generateEmailContent` block — use `provider.generateEmailContent(...)`.

**Step 5: Run tests again**

Run: `npx vitest run 2>&1 | tail -20`

Expected: All 210 tests pass.

**Step 6: Commit**

```bash
git add server/services/notifications/EmailProvider.ts server/services/NotificationService.ts tests/unit/services/notification-service.test.ts
git commit -m "refactor: extract EmailProvider from NotificationService"
```

---

### Task 3: Update NotificationPreferences Type

**Files:**
- Modify: `types/notification.ts`
- Modify: `tests/fixtures/test-data.ts`
- Modify: `tests/unit/services/notification-service.test.ts`

**Step 1: Add channel fields to the type**

In `types/notification.ts`, add to the `NotificationPreferences` interface:

```typescript
// Channel toggles
channels?: {
  email: boolean;
  slack: boolean;
};

// Channel-specific configuration
channelConfig?: {
  slackWebhookUrl?: string;
};
```

Make both optional (`?`) for backward compatibility with existing stored preferences.

**Step 2: Update defaultNotificationPreferences**

In `types/notification.ts`, add to `defaultNotificationPreferences`:

```typescript
channels: {
  email: true,
  slack: false,
},
channelConfig: {},
```

**Step 3: Update test fixtures**

In `tests/fixtures/test-data.ts`, add `channels` and `channelConfig` to both `testNotificationPreferences.admin` and `testNotificationPreferences.member`:

```typescript
channels: { email: true, slack: false },
channelConfig: {},
```

**Step 4: Update test preference constants**

In `tests/unit/services/notification-service.test.ts`, add `channels` and `channelConfig` to `allAnyPrefs`, `allNonePrefs`, and `minePrefs`:

```typescript
channels: { email: true, slack: false },
channelConfig: {},
```

**Step 5: Run tests**

Run: `npx vitest run 2>&1 | tail -20`

Expected: All 210 tests pass.

**Step 6: Commit**

```bash
git add types/notification.ts tests/fixtures/test-data.ts tests/unit/services/notification-service.test.ts
git commit -m "feat: add channels and channelConfig to NotificationPreferences"
```

---

### Task 4: Create SlackProvider

**Files:**
- Create: `server/services/notifications/SlackProvider.ts`
- Create: `tests/unit/services/slack-provider.test.ts`

**Step 1: Write failing tests for SlackProvider**

```typescript
// tests/unit/services/slack-provider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackProvider } from '@/server/services/notifications/SlackProvider';
import type { NotificationRecipient } from '@/server/services/notifications/NotificationProvider';
import type { NotificationContext } from '@/server/services/NotificationService';

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

const recipient: NotificationRecipient = {
  userId: 'user-1',
  name: 'Alice',
  email: 'alice@test.com',
  channelConfig: { slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
};

const baseContext: NotificationContext = {
  user: { id: 'user-1', name: 'Alice', email: 'alice@test.com' } as any,
  task: { id: 't1', name: 'Clean Kitchen', description: 'Wipe counters', category: { name: 'Cleaning' } } as any,
  occurrence: { id: 'o1', dueDate: new Date('2026-03-01'), assigneeIds: ['user-1'] } as any,
  actionUser: { id: 'user-2', name: 'Bob' } as any,
  household: { id: 'h1', name: 'Test House' },
};

describe('SlackProvider', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('has channel "slack"', () => {
    const provider = new SlackProvider();
    expect(provider.channel).toBe('slack');
  });

  it('sends POST to the webhook URL', async () => {
    const provider = new SlackProvider();
    await provider.send(recipient, 'task_created', baseContext);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/xxx',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('includes task name in the payload', async () => {
    const provider = new SlackProvider();
    await provider.send(recipient, 'task_created', baseContext);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const text = JSON.stringify(body.blocks);
    expect(text).toContain('Clean Kitchen');
  });

  it('includes a View link for occurrence events', async () => {
    const provider = new SlackProvider();
    await provider.send(recipient, 'occurrence_assigned', baseContext);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const text = JSON.stringify(body.blocks);
    expect(text).toContain('/occurrences/o1');
  });

  it('throws when webhook URL is missing', async () => {
    const provider = new SlackProvider();
    const noWebhook = { ...recipient, channelConfig: {} };

    await expect(provider.send(noWebhook, 'task_created', baseContext))
      .rejects.toThrow('Slack webhook URL not configured');
  });

  it('throws when Slack API returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    const provider = new SlackProvider();

    await expect(provider.send(recipient, 'task_created', baseContext))
      .rejects.toThrow('Slack webhook failed');
  });

  it('formats task_reminder_overdue with overdue info', async () => {
    const provider = new SlackProvider();
    await provider.send(recipient, 'task_reminder_overdue', baseContext);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const text = JSON.stringify(body.blocks);
    expect(text).toContain('Overdue');
    expect(text).toContain('Clean Kitchen');
  });

  it('handles context with no occurrence gracefully', async () => {
    const provider = new SlackProvider();
    const noOccContext = { ...baseContext, occurrence: undefined };
    await provider.send(recipient, 'task_created', noOccContext);

    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/slack-provider.test.ts 2>&1 | tail -20`

Expected: FAIL — `SlackProvider` doesn't exist yet.

**Step 3: Implement SlackProvider**

```typescript
// server/services/notifications/SlackProvider.ts
import type { NotificationProvider, NotificationRecipient } from './NotificationProvider';
import type { NotificationEventType, NotificationContext } from '../NotificationService';
import { format } from 'date-fns';

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text?: { type: string; text: string }; url?: string }>;
}

export class SlackProvider implements NotificationProvider {
  readonly channel = 'slack' as const;

  async send(
    recipient: NotificationRecipient,
    eventType: NotificationEventType,
    context: NotificationContext
  ): Promise<void> {
    const webhookUrl = recipient.channelConfig.slackWebhookUrl;
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const blocks = this.generateSlackBlocks(eventType, context);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`[SlackProvider] Sent ${eventType} notification to ${recipient.name}`);
  }

  private generateSlackBlocks(
    eventType: NotificationEventType,
    context: NotificationContext
  ): SlackBlock[] {
    const { task, occurrence, actionUser } = context;
    const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const taskName = task?.name || 'Unknown Task';
    const dueDate = occurrence?.dueDate
      ? format(new Date(occurrence.dueDate), 'PPP')
      : '';

    switch (eventType) {
      case 'task_created':
        return this.buildBlocks(
          'New Task Created',
          `*${taskName}*${task?.category?.name ? `\nCategory: ${task.category.name}` : ''}${actionUser ? `\nCreated by: ${actionUser.name}` : ''}`,
          task?.id ? `${baseUrl}/tasks/${task.id}` : undefined
        );

      case 'task_paused':
        return this.buildBlocks('Task Paused', `*${taskName}* has been paused.`);

      case 'task_completed':
        return this.buildBlocks('Task Completed', `*${taskName}* has been completed.`);

      case 'task_deleted':
        return this.buildBlocks('Task Deleted', `*${taskName}* has been deleted.`);

      case 'occurrence_assigned':
        return this.buildBlocks(
          'Task Assigned',
          `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ''}${actionUser ? `\nAssigned by: ${actionUser.name}` : ''}`,
          occurrence?.id ? `${baseUrl}/occurrences/${occurrence.id}` : undefined
        );

      case 'occurrence_executed':
        return this.buildBlocks(
          'Task Completed',
          `*${taskName}*${actionUser ? `\nCompleted by: ${actionUser.name}` : ''}`,
          occurrence?.id ? `${baseUrl}/occurrences/${occurrence.id}` : undefined
        );

      case 'occurrence_skipped':
        return this.buildBlocks(
          'Task Skipped',
          `*${taskName}*${actionUser ? `\nSkipped by: ${actionUser.name}` : ''}`,
          occurrence?.id ? `${baseUrl}/occurrences/${occurrence.id}` : undefined
        );

      case 'occurrence_commented':
        return this.buildBlocks(
          'New Comment',
          `*${taskName}*${actionUser ? `\nComment by: ${actionUser.name}` : ''}`,
          occurrence?.id ? `${baseUrl}/occurrences/${occurrence.id}` : undefined
        );

      case 'task_reminder_initial':
        return this.buildBlocks(
          'Task Reminder',
          `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ''}`,
          occurrence?.id ? `${baseUrl}/occurrences/${occurrence.id}` : undefined
        );

      case 'task_reminder_followup':
        return this.buildBlocks(
          'Follow-up Reminder',
          `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ''}`,
          occurrence?.id ? `${baseUrl}/occurrences/${occurrence.id}` : undefined
        );

      case 'task_reminder_overdue': {
        const daysOverdue = occurrence?.dueDate
          ? Math.abs(Math.ceil((new Date(occurrence.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;
        return this.buildBlocks(
          'Task Overdue',
          `*${taskName}*${dueDate ? `\nDue: ${dueDate}` : ''}\n${daysOverdue} days overdue`,
          occurrence?.id ? `${baseUrl}/occurrences/${occurrence.id}` : undefined
        );
      }

      default:
        return this.buildBlocks('Notification', `*${taskName}*`);
    }
  }

  private buildBlocks(header: string, body: string, actionUrl?: string): SlackBlock[] {
    const blocks: SlackBlock[] = [
      { type: 'header', text: { type: 'plain_text', text: header } },
      { type: 'section', text: { type: 'mrkdwn', text: body } },
    ];

    if (actionUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Task' },
            url: actionUrl,
          },
        ],
      });
    }

    return blocks;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/services/slack-provider.test.ts 2>&1 | tail -20`

Expected: All SlackProvider tests pass.

**Step 5: Run full test suite**

Run: `npx vitest run 2>&1 | tail -20`

Expected: All tests pass (210 existing + new Slack tests).

**Step 6: Commit**

```bash
git add server/services/notifications/SlackProvider.ts tests/unit/services/slack-provider.test.ts
git commit -m "feat: add SlackProvider with Block Kit formatting"
```

---

### Task 5: Wire SlackProvider into NotificationService

**Files:**
- Modify: `server/services/NotificationService.ts`
- Create: `tests/unit/services/notification-dispatch.test.ts`

**Step 1: Write failing tests for multi-provider dispatch**

```typescript
// tests/unit/services/notification-dispatch.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '@/server/services/NotificationService';
import type { NotificationPreferences } from '@/types/notification';
import { defaultNotificationPreferences } from '@/types/notification';

describe('getEnabledProviders', () => {
  const service = new NotificationService();

  // Access private method via any cast for testing
  const getProviders = (prefs: NotificationPreferences) =>
    (service as any).getEnabledProviders(prefs);

  it('returns only EmailProvider when channels.slack is false', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: true, slack: false },
      channelConfig: {},
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('email');
  });

  it('returns both providers when slack is enabled with webhook URL', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: true, slack: true },
      channelConfig: { slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(2);
    expect(providers.map((p: any) => p.channel).sort()).toEqual(['email', 'slack']);
  });

  it('skips slack when enabled but no webhook URL', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: true, slack: true },
      channelConfig: {},
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('email');
  });

  it('returns only SlackProvider when email is disabled', () => {
    const prefs: NotificationPreferences = {
      ...defaultNotificationPreferences,
      channels: { email: false, slack: true },
      channelConfig: { slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
    };
    const providers = getProviders(prefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('slack');
  });

  it('defaults to email-only when channels field is missing (backward compat)', () => {
    const legacyPrefs = { ...defaultNotificationPreferences } as any;
    delete legacyPrefs.channels;
    delete legacyPrefs.channelConfig;
    const providers = getProviders(legacyPrefs);
    expect(providers).toHaveLength(1);
    expect(providers[0].channel).toBe('email');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/notification-dispatch.test.ts 2>&1 | tail -20`

Expected: FAIL — `getEnabledProviders` doesn't handle Slack yet.

**Step 3: Add SlackProvider to getEnabledProviders**

In `NotificationService.ts`, update `getEnabledProviders`:

```typescript
import { SlackProvider } from './notifications/SlackProvider';

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

**Step 4: Run tests**

Run: `npx vitest run 2>&1 | tail -20`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add server/services/NotificationService.ts tests/unit/services/notification-dispatch.test.ts
git commit -m "feat: wire SlackProvider into notification dispatch"
```

---

### Task 6: Update Notification Preferences Validation

**Files:**
- Modify: `server/api/user/notifications.put.ts`

**Step 1: Update the PUT endpoint validation**

The endpoint currently validates only the event preference fields. Add validation for the new `channels` and `channelConfig` fields. The new fields are optional (backward compat), but when present they must be valid.

After the existing field validation loop, add:

```typescript
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
```

**Step 2: Run full test suite**

Run: `npx vitest run 2>&1 | tail -20`

Expected: All tests pass (no integration tests hit this endpoint directly).

**Step 3: Commit**

```bash
git add server/api/user/notifications.put.ts
git commit -m "feat: validate channels and channelConfig in preferences PUT"
```

---

### Task 7: Update NotificationPreferences UI

**Files:**
- Modify: `components/NotificationPreferences.vue`

**Step 1: Add channel state to the component**

In the `<script setup>` section, update the `preferences` ref to include the new fields:

```typescript
const preferences = ref<NotificationPreferences>({
  task_created: 'any',
  task_paused: 'any',
  task_completed: 'any',
  task_deleted: 'any',
  occurrence_assigned: 'mine',
  occurrence_executed: 'mine',
  occurrence_skipped: 'mine',
  occurrence_commented: 'mine',
  reminder_initial: 'any',
  reminder_followup: 'any',
  reminder_overdue: 'any',
  channels: {
    email: true,
    slack: false,
  },
  channelConfig: {},
});
```

Add a reactive computed for webhook URL validation:

```typescript
const slackWebhookError = ref('');

const validateWebhookUrl = (url: string) => {
  if (!url) {
    slackWebhookError.value = 'Webhook URL is required when Slack is enabled';
    return false;
  }
  if (!url.startsWith('https://hooks.slack.com/services/')) {
    slackWebhookError.value = 'Must start with https://hooks.slack.com/services/';
    return false;
  }
  slackWebhookError.value = '';
  return true;
};
```

**Step 2: Add the Notification Channels section to the template**

Insert this block at the top of the `<form>`, before the "Task Notifications" section:

```html
<!-- Notification Channels -->
<div>
  <h4 class="text-sm font-medium text-stone-900 mb-3">Notification Channels</h4>
  <p class="text-xs text-stone-500 mb-3">Choose how you receive notifications. Your event preferences below apply to all enabled channels.</p>
  <div class="space-y-3">
    <!-- Email toggle -->
    <div class="flex items-center justify-between">
      <div>
        <label class="text-sm text-stone-700">Email</label>
        <p class="text-xs text-stone-500">Notifications sent to {{ preferences.channelConfig?.slackWebhookUrl ? 'your email' : 'your email address' }}</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="preferences.channels!.email" class="sr-only peer">
        <div class="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
      </label>
    </div>

    <!-- Slack toggle -->
    <div class="flex items-center justify-between">
      <div>
        <label class="text-sm text-stone-700">Slack</label>
        <p class="text-xs text-stone-500">Post notifications to a Slack channel via webhook</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="preferences.channels!.slack" class="sr-only peer">
        <div class="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
      </label>
    </div>

    <!-- Slack webhook URL (shown when Slack is enabled) -->
    <div v-if="preferences.channels?.slack" class="ml-0 pl-4 border-l-2 border-amber-200 space-y-2">
      <label class="block text-sm text-stone-700">Webhook URL</label>
      <input
        type="url"
        v-model="preferences.channelConfig!.slackWebhookUrl"
        placeholder="https://hooks.slack.com/services/..."
        class="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:ring-amber-500 focus:border-amber-500"
        @blur="validateWebhookUrl(preferences.channelConfig?.slackWebhookUrl || '')"
      />
      <p v-if="slackWebhookError" class="text-xs text-red-600">{{ slackWebhookError }}</p>
      <p class="text-xs text-stone-500">
        <a href="https://api.slack.com/messaging/webhooks" target="_blank" class="text-amber-600 hover:text-amber-700 underline">
          How to create a Slack webhook
        </a>
      </p>
    </div>
  </div>
</div>
```

**Step 3: Add save validation**

Update the `savePreferences` function to validate before saving:

```typescript
const savePreferences = async () => {
  // Validate Slack config if enabled
  if (preferences.value.channels?.slack) {
    if (!validateWebhookUrl(preferences.value.channelConfig?.slackWebhookUrl || '')) {
      return;
    }
  }

  saving.value = true;
  // ... rest of existing save logic
};
```

**Step 4: Handle missing channels on load (backward compat)**

In the `onMounted` callback, after loading preferences, ensure the new fields have defaults:

```typescript
if (response) {
  preferences.value = {
    ...response,
    channels: response.channels ?? { email: true, slack: false },
    channelConfig: response.channelConfig ?? {},
  };
}
```

**Step 5: Visual check**

Run: `npm run dev` and navigate to profile/notification preferences. Verify:
- Channel toggles appear above event preferences
- Email is on by default
- Slack is off by default
- Toggling Slack on reveals the webhook URL field
- Help link is visible

**Step 6: Commit**

```bash
git add components/NotificationPreferences.vue
git commit -m "feat: add channel toggle UI for email and Slack notifications"
```

---

### Task 8: Final Integration Verification

**Files:**
- No new files

**Step 1: Run full test suite**

Run: `npx vitest run 2>&1 | tail -20`

Expected: All tests pass (210+ existing + new Slack + dispatch tests).

**Step 2: Verify no TypeScript errors**

Run: `npx nuxi typecheck 2>&1 | tail -20`

Fix any type errors that surface.

**Step 3: Create final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type errors from notification provider refactor"
```

**Step 4: Verify clean git status**

Run: `git status`

Expected: Clean working tree, all changes committed.
