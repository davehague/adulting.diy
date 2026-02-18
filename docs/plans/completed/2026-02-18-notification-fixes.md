# Notification System Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 bugs/gaps in the notification system: wire up missing event triggers, add actor exclusion, prevent duplicate reminders, filter reminders by assignee, populate household names, complete comment-based "mine" filtering, add dedicated email templates for 6 event types, and fix test fixture field names.

**Architecture:** All notification logic is centralized in `NotificationService.ts`. Event-trigger call sites live in `TaskService.ts` and `OccurrenceService.ts`. Changes are surgical — each fix touches 1-3 files. No schema migrations needed (duplicate prevention uses occurrence metadata fields that already exist via the history log table).

**Tech Stack:** TypeScript, Vitest, Prisma (CockroachDB), Nuxt 3 server routes

---

### Task 1: Fix test fixture ReminderConfig field names

The test fixtures use `initialReminderDays`/`followUpReminderDays`/`overdueReminderDays` but the actual `ReminderConfig` type uses `initialReminder`/`followUpReminder`/`overdueReminder`.

**Files:**
- Modify: `tests/fixtures/test-data.ts:77-81`

**Step 1: Fix the field names**

In `tests/fixtures/test-data.ts`, change lines 77-81 from:
```typescript
    reminderConfig: {
      initialReminderDays: 1,
      followUpReminderDays: 0,
      overdueReminderDays: 1,
    },
```
to:
```typescript
    reminderConfig: {
      initialReminder: 1,
      followUpReminder: 0,
      overdueReminder: 1,
    },
```

**Step 2: Run tests to verify nothing breaks**

Run: `npm run test`
Expected: All existing tests pass (the fixture fields were not actually consumed by any existing test assertions that would catch this, but we confirm no regressions).

**Step 3: Commit**

```bash
git add tests/fixtures/test-data.ts
git commit -m "fix: correct ReminderConfig field names in test fixtures"
```

---

### Task 2: Add actor exclusion to all notification call sites

Currently only `task_created` passes `excludeUserId`. The other 6 event triggers (`task_paused`, `task_deleted`, `occurrence_executed`, `occurrence_skipped`, `occurrence_commented`) should also exclude the triggering user so they don't receive a notification about their own action.

**Files:**
- Modify: `server/services/TaskService.ts:388,490` (pause, softDelete)
- Modify: `server/services/OccurrenceService.ts:433,564,637` (execute, skip, addComment)

**Step 1: Write tests for actor exclusion**

Add to `tests/unit/services/notification-service.test.ts`:

```typescript
describe('actor exclusion for all event types', () => {
  const service = new NotificationService()

  it.each([
    'task_paused', 'task_deleted',
  ] as NotificationEventType[])('%s with preference "any" still returns true (exclusion handled at call site)', (eventType) => {
    // These event types use 'any'/'none' — the shouldSendNotification check
    // still returns true for 'any'. Actor exclusion is done via excludeUserId param.
    expect(service.shouldSendNotification(eventType, allAnyPrefs, baseContext, userId)).toBe(true)
  })
})
```

Note: The actual actor exclusion is done by passing `excludeUserId` at the call site, not inside `shouldSendNotification`. The test confirms the preference logic is unchanged; the real fix is in the service files.

**Step 2: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

**Step 3: Add excludeUserId to TaskService.pause**

In `server/services/TaskService.ts`, change the `sendNotification` call in `pause()` (around line 388) from:
```typescript
            await notificationService.sendNotification(
              pausedTask.householdId,
              "task_paused",
              {
                user: actionUser as any,
                task: pausedTask,
                actionUser: actionUser as any,
                household: { id: pausedTask.householdId, name: "" },
              }
            );
```
to:
```typescript
            await notificationService.sendNotification(
              pausedTask.householdId,
              "task_paused",
              {
                user: actionUser as any,
                task: pausedTask,
                actionUser: actionUser as any,
                household: { id: pausedTask.householdId, name: "" },
              },
              userId // Don't notify the user who paused the task
            );
```

**Step 4: Add excludeUserId to TaskService.softDelete**

In `server/services/TaskService.ts`, change the `sendNotification` call in `softDelete()` (around line 490) from:
```typescript
            await notificationService.sendNotification(
              deletedTask.householdId,
              "task_deleted",
              {
                user: actionUser as any,
                task: deletedTask,
                actionUser: actionUser as any,
                household: { id: deletedTask.householdId, name: "" },
              }
            );
```
to:
```typescript
            await notificationService.sendNotification(
              deletedTask.householdId,
              "task_deleted",
              {
                user: actionUser as any,
                task: deletedTask,
                actionUser: actionUser as any,
                household: { id: deletedTask.householdId, name: "" },
              },
              userId // Don't notify the user who deleted the task
            );
```

**Step 5: Add excludeUserId to OccurrenceService.execute**

In `server/services/OccurrenceService.ts`, change the `sendNotification` call in `execute()` (around line 433) from:
```typescript
            await notificationService.sendNotification(
              updatedOccurrence.task.householdId,
              "occurrence_executed",
              {
                user: actionUser as any,
                task: updatedOccurrence.task as unknown as TaskDefinition,
                occurrence: updatedOccurrence,
                actionUser: actionUser as any,
                household: { id: updatedOccurrence.task.householdId, name: "" },
              }
            );
```
to:
```typescript
            await notificationService.sendNotification(
              updatedOccurrence.task.householdId,
              "occurrence_executed",
              {
                user: actionUser as any,
                task: updatedOccurrence.task as unknown as TaskDefinition,
                occurrence: updatedOccurrence,
                actionUser: actionUser as any,
                household: { id: updatedOccurrence.task.householdId, name: "" },
              },
              userId // Don't notify the user who completed the task
            );
```

**Step 6: Add excludeUserId to OccurrenceService.skip**

In `server/services/OccurrenceService.ts`, change the `sendNotification` call in `skip()` (around line 564) from:
```typescript
            await notificationService.sendNotification(
              skippedOccurrence.task.householdId,
              "occurrence_skipped",
              {
                user: actionUser as any,
                task: skippedOccurrence.task as unknown as TaskDefinition,
                occurrence: skippedOccurrence,
                actionUser: actionUser as any,
                household: { id: skippedOccurrence.task.householdId, name: "" },
              }
            );
```
to:
```typescript
            await notificationService.sendNotification(
              skippedOccurrence.task.householdId,
              "occurrence_skipped",
              {
                user: actionUser as any,
                task: skippedOccurrence.task as unknown as TaskDefinition,
                occurrence: skippedOccurrence,
                actionUser: actionUser as any,
                household: { id: skippedOccurrence.task.householdId, name: "" },
              },
              userId // Don't notify the user who skipped the task
            );
```

**Step 7: Add excludeUserId to OccurrenceService.addComment**

In `server/services/OccurrenceService.ts`, change the `sendNotification` call in `addComment()` (around line 637) from:
```typescript
            await notificationService.sendNotification(
              occurrence.task.householdId,
              "occurrence_commented",
              {
                user: actionUser as any,
                task: occurrence.task as unknown as TaskDefinition,
                occurrence: occurrence as unknown as TaskOccurrence,
                actionUser: actionUser as any,
                household: { id: occurrence.task.householdId, name: "" },
              }
            );
```
to:
```typescript
            await notificationService.sendNotification(
              occurrence.task.householdId,
              "occurrence_commented",
              {
                user: actionUser as any,
                task: occurrence.task as unknown as TaskDefinition,
                occurrence: occurrence as unknown as TaskOccurrence,
                actionUser: actionUser as any,
                household: { id: occurrence.task.householdId, name: "" },
              },
              userId // Don't notify the user who commented
            );
```

**Step 8: Run tests**

Run: `npm run test`
Expected: All tests pass.

**Step 9: Commit**

```bash
git add server/services/TaskService.ts server/services/OccurrenceService.ts tests/unit/services/notification-service.test.ts
git commit -m "fix: exclude triggering user from all notification events"
```

---

### Task 3: Populate household name in notification context

All notification call sites pass `household: { id: ..., name: "" }`. Fix by fetching the household name from the DB or from the included relation where available.

**Files:**
- Modify: `server/services/TaskService.ts` (create, pause, softDelete)
- Modify: `server/services/OccurrenceService.ts` (execute, skip, addComment)

**Step 1: Fix TaskService.create — fetch household name**

In `server/services/TaskService.ts`, inside the `create()` method's notification block (around line 224), add a household fetch before the notification call. Replace:
```typescript
        const notificationService = new NotificationService();

        // Get the user who created the task for notification context
        const createdByUser = await prisma.user.findUnique({
          where: { id: taskDefinition.createdByUserId },
          select: { id: true, name: true, email: true },
        });
```
with:
```typescript
        const notificationService = new NotificationService();

        // Get the user who created the task for notification context
        const [createdByUser, household] = await Promise.all([
          prisma.user.findUnique({
            where: { id: taskDefinition.createdByUserId },
            select: { id: true, name: true, email: true },
          }),
          prisma.household.findUnique({
            where: { id: taskDefinition.householdId },
            select: { id: true, name: true },
          }),
        ]);
```

And update the notification call to use the fetched household:
```typescript
              household: { id: taskDefinition.householdId, name: household?.name || "" },
```

**Step 2: Fix TaskService.pause — fetch household name**

In `server/services/TaskService.ts`, inside the `pause()` method's notification block (around line 378), add a household fetch. Replace:
```typescript
          const notificationService = new NotificationService();

          // Get the user who paused the task
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });
```
with:
```typescript
          const notificationService = new NotificationService();

          // Get the user who paused the task and the household name
          const [actionUser, household] = await Promise.all([
            prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, name: true, email: true },
            }),
            prisma.household.findUnique({
              where: { id: pausedTask.householdId },
              select: { id: true, name: true },
            }),
          ]);
```

And update:
```typescript
                household: { id: pausedTask.householdId, name: household?.name || "" },
```

**Step 3: Fix TaskService.softDelete — same pattern as pause**

Same approach for the `softDelete()` method's notification block.

**Step 4: Fix OccurrenceService.execute — use task.household if available, else fetch**

In `server/services/OccurrenceService.ts`, the task is already included via Prisma but `household` is not selected. Update the execute method's notification block. Replace:
```typescript
          const notificationService = new NotificationService();

          // Get the user who executed the task
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });
```
with:
```typescript
          const notificationService = new NotificationService();

          // Get the user who executed the task and the household name
          const [actionUser, household] = await Promise.all([
            prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, name: true, email: true },
            }),
            prisma.household.findUnique({
              where: { id: updatedOccurrence.task.householdId },
              select: { id: true, name: true },
            }),
          ]);
```

And update:
```typescript
                household: { id: updatedOccurrence.task.householdId, name: household?.name || "" },
```

**Step 5: Apply same pattern to OccurrenceService.skip and addComment**

Same approach for `skip()` and `addComment()` notification blocks.

**Step 6: Fix NotificationService.checkAndSendTaskReminders — use task.household**

In `server/services/NotificationService.ts`, the `checkAndSendTaskReminders` method already has `task` which was fetched with `include: { household: true }` in `sendTaskReminders()`. Update line 440 from:
```typescript
        household: { id: task.householdId, name: "" },
```
to:
```typescript
        household: { id: task.householdId, name: (task as any).household?.name || "" },
```

**Step 7: Run tests**

Run: `npm run test`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add server/services/TaskService.ts server/services/OccurrenceService.ts server/services/NotificationService.ts
git commit -m "fix: populate household name in notification context"
```

---

### Task 4: Wire up missing `occurrence_assigned` notification

The `occurrence_assigned` event type has a preference, template, and shouldSendNotification logic, but nothing ever triggers it. It should fire when an occurrence's `assigneeIds` change.

**Files:**
- Modify: `server/services/OccurrenceService.ts` (inside the `update` method)

**Step 1: Write a test for occurrence_assigned shouldSendNotification**

The existing tests already cover `occurrence_assigned` in the `shouldSendNotification` tests. Verify by running:

Run: `npm run test -- --grep "occurrence_assigned"`
Expected: Existing tests pass.

**Step 2: Add occurrence_assigned notification to OccurrenceService.update**

In `server/services/OccurrenceService.ts`, inside the `update()` method, after the assignee change log block (around line 335, after the `if (data.assigneeIds)` block closes), add notification logic inside the transaction return but after the update. Actually, since the transaction returns the updated occurrence, add the notification AFTER the transaction (like the other notification calls in execute/skip).

Replace the entire `update` method's return block. After the transaction `return` (around line 338), the method currently just returns the result. We need to capture the result and send the notification. Replace:
```typescript
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in update:`, error);
      throw error;
    }
```

Actually, the cleaner approach is to add the notification after the transaction resolves. The `update` method wraps everything in a transaction and returns. We need to restructure slightly:

In `server/services/OccurrenceService.ts`, modify the `update()` method. After the existing transaction block (which ends around line 338), add notification logic for assignee changes. The full updated method should:

1. Capture the existing occurrence BEFORE the transaction (for comparison)
2. Run the transaction
3. After the transaction, check if assigneeIds changed and send notification

Replace the `update` method body from the transaction return to the catch. Insert after `return updatedOccurrence as unknown as TaskOccurrence;` (line 337) but before the transaction's closing `});` — actually, the simplest fix is:

After the `return await prisma.$transaction(...)` that returns the result, we need to restructure. Currently the method directly returns the transaction result. Change to:

```typescript
  async update(
    id: string,
    userId: string,
    data: OccurrenceUpdateData
  ): Promise<TaskOccurrence> {
    try {
      // Start a transaction to log the changes
      const result = await prisma.$transaction(async (tx) => {
        // ... existing transaction code unchanged ...

        return {
          updatedOccurrence: updatedOccurrence as unknown as TaskOccurrence,
          assigneesChanged: data.assigneeIds
            ? JSON.stringify(currentOccurrence.assigneeIds || []) !== JSON.stringify(data.assigneeIds || [])
            : false,
          oldAssigneeIds: currentOccurrence.assigneeIds || [],
        };
      });

      // Send occurrence_assigned notification if assignees changed
      if (result.assigneesChanged && result.updatedOccurrence.task) {
        try {
          const notificationService = new NotificationService();
          const task = result.updatedOccurrence.task as unknown as TaskDefinition;

          const [actionUser, household] = await Promise.all([
            prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, name: true, email: true },
            }),
            prisma.household.findUnique({
              where: { id: task.householdId },
              select: { id: true, name: true },
            }),
          ]);

          if (actionUser) {
            await notificationService.sendNotification(
              task.householdId,
              "occurrence_assigned",
              {
                user: actionUser as any,
                task,
                occurrence: result.updatedOccurrence,
                actionUser: actionUser as any,
                household: { id: task.householdId, name: household?.name || "" },
              },
              userId
            );
          }
        } catch (notificationError) {
          console.warn(
            `[OccurrenceService] Failed to send occurrence assigned notification:`,
            notificationError
          );
        }
      }

      return result.updatedOccurrence;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in update:`, error);
      throw error;
    }
  }
```

Note: The `update` method's Prisma query currently doesn't `include: { task: true }` — it does (line 301-303). Good. But it doesn't include `task.household`. We need to fetch the task to get `householdId`. The included `task` has this. Good.

**Step 3: Run tests**

Run: `npm run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add server/services/OccurrenceService.ts
git commit -m "feat: wire up occurrence_assigned notification on assignee change"
```

---

### Task 5: Wire up missing `task_completed` notification

The `task_completed` event type exists in preferences but is never triggered. A task transitions to "completed" metaStatus — but looking at the code, there's no explicit "complete a task" method. The `task_completed` preference should logically fire when ALL occurrences for a "once" task are completed, or it might map to a metaStatus change.

Looking at the data model, `TaskMetaStatus` includes "completed" but no code currently sets it. The most practical approach: remove `task_completed` as a distinct notification type since it's not a real workflow event in this system. Tasks don't "complete" — occurrences do (which already fires `occurrence_executed`).

**However**, to avoid a breaking change for users who have already configured this preference, we should keep the preference field but leave it as-is (it simply won't fire). No code change needed — this is a design decision, not a bug.

**Alternative**: If we wanted to fire it, the logical place would be `OccurrenceService.execute` when a "once" task's only occurrence is completed. But this adds complexity for marginal value. Recommend skipping for now.

**Decision: Skip this item** — `task_completed` as an event is a conceptual mismatch. Occurrences complete, not tasks. The `occurrence_executed` event covers this. Keep the preference field for forward-compatibility but don't wire it up.

---

### Task 6: Add dedicated email templates for 6 event types

Currently `task_paused`, `task_completed`, `task_deleted`, `occurrence_executed`, `occurrence_skipped`, and `occurrence_commented` all fall through to a generic template. Add proper templates.

**Files:**
- Modify: `server/services/NotificationService.ts` (generateEmailContent and renderEmailTemplate)
- Modify: `tests/unit/services/notification-service.test.ts` (add template tests)

**Step 1: Write tests for new templates**

Add to `tests/unit/services/notification-service.test.ts` in the `renderEmailTemplate` describe block:

```typescript
  it('task_paused renders with orange/warning styling', () => {
    const html = service.renderEmailTemplate('task_paused', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      pausedByName: 'Bob',
      taskUrl: 'http://localhost/tasks/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Paused')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('task_deleted renders with red styling', () => {
    const html = service.renderEmailTemplate('task_deleted', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      deletedByName: 'Bob',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Deleted')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('occurrence_executed renders with green styling', () => {
    const html = service.renderEmailTemplate('occurrence_executed', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      completedByName: 'Bob',
      dueDate: 'January 20, 2025',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Completed')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('occurrence_skipped renders with amber styling', () => {
    const html = service.renderEmailTemplate('occurrence_skipped', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      skippedByName: 'Bob',
      dueDate: 'January 20, 2025',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Skipped')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('occurrence_commented renders with blue styling', () => {
    const html = service.renderEmailTemplate('occurrence_commented', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      commentedByName: 'Bob',
      comment: 'Need to buy supplies first',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('New Comment')
    expect(html).toContain('Bob')
    expect(html).toContain('Need to buy supplies first')
    expect(html).not.toContain('{{')
  })
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/unit/services/notification-service.test.ts`
Expected: FAIL (new templates don't exist yet, will fall through to generic)

**Step 3: Add templates to renderEmailTemplate**

In `server/services/NotificationService.ts`, add these templates to the `templates` object inside `renderEmailTemplate()` (around line 315, add after the existing templates):

```typescript
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
```

**Step 4: Add generateEmailContent cases for new templates**

In `server/services/NotificationService.ts`, inside the `generateEmailContent()` method's switch statement (around line 222), add cases before the `default`:

```typescript
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
```

**Step 5: Add `comment` field to NotificationContext**

In `server/services/NotificationService.ts`, update the `NotificationContext` interface (line 6) to include an optional comment:

```typescript
export interface NotificationContext {
  user: User;
  task?: TaskDefinition;
  occurrence?: TaskOccurrence;
  actionUser?: User;
  household?: {
    id: string;
    name: string;
  };
  comment?: string;
}
```

**Step 6: Pass comment in OccurrenceService.addComment notification**

In `server/services/OccurrenceService.ts`, in the `addComment()` method, add the `comment` field to the notification context. Change the notification call to include:
```typescript
                comment: comment,
```
in the context object passed to `sendNotification`.

**Step 7: Run tests**

Run: `npm run test -- tests/unit/services/notification-service.test.ts`
Expected: All tests pass including new template tests.

**Step 8: Commit**

```bash
git add server/services/NotificationService.ts server/services/OccurrenceService.ts tests/unit/services/notification-service.test.ts
git commit -m "feat: add dedicated email templates for all notification event types"
```

---

### Task 7: Complete comment-based "mine" filtering

The `isUserRelatedToOccurrence` method only checks `assigneeIds`. For `occurrence_commented` with preference `mine`, users who have commented on an occurrence should also be considered "related".

**Files:**
- Modify: `server/services/NotificationService.ts` (isUserRelatedToOccurrence)
- Modify: `tests/unit/services/notification-service.test.ts`

**Step 1: Write failing test**

Add to `tests/unit/services/notification-service.test.ts`:

```typescript
describe('isUserRelatedToOccurrence with comment history', () => {
  const service = new NotificationService()

  it('returns true when user is an assignee', () => {
    const context: NotificationContext = {
      user: { id: 'u1' } as any,
      occurrence: { assigneeIds: ['u1'] } as any,
    }
    expect(service.isUserRelatedToOccurrence('u1', context)).toBe(true)
  })

  it('returns true when user has commented (via commentUserIds)', () => {
    const context: NotificationContext = {
      user: { id: 'u1' } as any,
      occurrence: { assigneeIds: ['u2'], commentUserIds: ['u1'] } as any,
    }
    expect(service.isUserRelatedToOccurrence('u1', context)).toBe(true)
  })

  it('returns false when user is neither assignee nor commenter', () => {
    const context: NotificationContext = {
      user: { id: 'u3' } as any,
      occurrence: { assigneeIds: ['u1'], commentUserIds: ['u2'] } as any,
    }
    expect(service.isUserRelatedToOccurrence('u3', context)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/services/notification-service.test.ts`
Expected: FAIL (commentUserIds not checked)

**Step 3: Update isUserRelatedToOccurrence**

In `server/services/NotificationService.ts`, replace the `isUserRelatedToOccurrence` method:

```typescript
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
```

**Step 4: Pass commentUserIds when sending occurrence_commented notification**

In `server/services/OccurrenceService.ts`, in the `addComment()` method, before sending the notification, fetch the distinct comment authors. Update the notification section:

After the occurrence fetch (around line 618-627), add a query for comment authors:

```typescript
        if (occurrence?.task) {
          // Get distinct user IDs who have commented on this occurrence
          const commentLogs = await prisma.occurrenceHistoryLog.findMany({
            where: {
              occurrenceId: id,
              logType: "comment",
            },
            select: { userId: true },
            distinct: ["userId"],
          });
          const commentUserIds = commentLogs.map(log => log.userId);

          // Get the user who commented
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });

          if (actionUser) {
            await notificationService.sendNotification(
              occurrence.task.householdId,
              "occurrence_commented",
              {
                user: actionUser as any,
                task: occurrence.task as unknown as TaskDefinition,
                occurrence: { ...occurrence, commentUserIds } as unknown as TaskOccurrence,
                actionUser: actionUser as any,
                household: { id: occurrence.task.householdId, name: household?.name || "" },
                comment: comment,
              },
              userId
            );
          }
        }
```

**Step 5: Run tests**

Run: `npm run test -- tests/unit/services/notification-service.test.ts`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add server/services/NotificationService.ts server/services/OccurrenceService.ts tests/unit/services/notification-service.test.ts
git commit -m "feat: complete comment-based mine filtering for occurrence notifications"
```

---

### Task 8: Add duplicate reminder prevention

The scheduler can run multiple times per day, causing duplicate reminders. Add a check using the `OccurrenceHistoryLog` to see if a reminder of a given type was already sent today for an occurrence.

**Files:**
- Modify: `server/services/NotificationService.ts` (checkAndSendTaskReminders)
- Modify: `tests/unit/services/notification-service.test.ts`

**Step 1: Write test for duplicate prevention**

Add to `tests/unit/services/notification-service.test.ts`:

```typescript
describe('duplicate reminder prevention', () => {
  it('does not send reminder if one was already sent today', async () => {
    const service = new NotificationService()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Set up: task with initialReminder of 3 days, occurrence due in 3 days
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    dueDate.setHours(0, 0, 0, 0)

    const task = {
      id: 'task-1',
      householdId: 'household-1',
      reminderConfig: { initialReminder: 3 },
    }

    const { default: prisma } = await import('@/server/utils/prisma/client')

    // Return an occurrence that's due in 3 days
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValueOnce([
      {
        id: 'occ-1',
        taskId: 'task-1',
        dueDate: dueDate,
        status: 'assigned',
        assigneeIds: ['user-1'],
        createdAt: today,
        updatedAt: today,
      },
    ] as any)

    // Return a history log showing reminder was already sent today
    vi.mocked(prisma.occurrenceHistoryLog.findMany).mockResolvedValueOnce([
      {
        id: 'log-1',
        occurrenceId: 'occ-1',
        userId: 'system',
        logType: 'reminder_sent',
        newValue: 'task_reminder_initial',
        createdAt: new Date(), // Today
      },
    ] as any)

    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue()
    const count = await service.checkAndSendTaskReminders(task as any)

    expect(count).toBe(0)
    expect(sendSpy).not.toHaveBeenCalled()

    sendSpy.mockRestore()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/services/notification-service.test.ts`
Expected: FAIL (no duplicate prevention exists yet, reminder would be sent)

**Step 3: Implement duplicate prevention**

In `server/services/NotificationService.ts`, modify `checkAndSendTaskReminders()`. After fetching `upcomingOccurrences` (around line 433), for each occurrence, check if a reminder was already sent today before sending:

Add a helper method to the class:

```typescript
  /**
   * Check if a reminder of a given type was already sent today for an occurrence
   */
  private async wasReminderSentToday(occurrenceId: string, reminderType: NotificationEventType): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingLog = await prisma.occurrenceHistoryLog.findFirst({
      where: {
        occurrenceId,
        logType: "reminder_sent",
        newValue: reminderType,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return !!existingLog;
  }

  /**
   * Log that a reminder was sent for deduplication
   */
  private async logReminderSent(occurrenceId: string, reminderType: NotificationEventType): Promise<void> {
    await prisma.occurrenceHistoryLog.create({
      data: {
        occurrenceId,
        userId: "system",
        logType: "reminder_sent",
        newValue: reminderType,
        comment: `${reminderType} reminder sent`,
      },
    });
  }
```

Then update each reminder check block in `checkAndSendTaskReminders()`. For each of the three reminder types (initial, followup, overdue), add the dedup check before sending. For example, the initial reminder block changes from:

```typescript
      if (task.reminderConfig.initialReminder) {
        const reminderDate = addDays(new Date(occurrence.dueDate), -task.reminderConfig.initialReminder);
        if (this.isDateToday(reminderDate)) {
          await this.sendNotification(task.householdId, "task_reminder_initial", context);
          remindersSent++;
        }
      }
```

to:

```typescript
      if (task.reminderConfig.initialReminder) {
        const reminderDate = addDays(new Date(occurrence.dueDate), -task.reminderConfig.initialReminder);
        if (this.isDateToday(reminderDate) && !(await this.wasReminderSentToday(occurrence.id, "task_reminder_initial"))) {
          await this.sendNotification(task.householdId, "task_reminder_initial", context);
          await this.logReminderSent(occurrence.id, "task_reminder_initial");
          remindersSent++;
        }
      }
```

Apply the same pattern to the followup and overdue blocks.

Note: The `logType: "reminder_sent"` is a new value — the existing `HistoryLogType` type in `types/task.ts` only covers `status_change | comment | assignment_change | date_change`. However, the Prisma schema defines `logType` as just `String`, not an enum, so this is safe at the DB level. We should update the TypeScript type.

**Step 4: Update HistoryLogType**

In `types/task.ts`, update the `HistoryLogType`:

```typescript
export type HistoryLogType =
  | "status_change"
  | "comment"
  | "assignment_change"
  | "date_change"
  | "reminder_sent";
```

**Step 5: Run tests**

Run: `npm run test -- tests/unit/services/notification-service.test.ts`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add server/services/NotificationService.ts types/task.ts tests/unit/services/notification-service.test.ts
git commit -m "feat: add duplicate reminder prevention via history log tracking"
```

---

### Task 9: Filter reminders to only assignees (not all household members)

Currently reminders go to ALL household members with `reminder_*: 'any'`. They should only go to the occurrence's assignees (or all household members if no assignees).

**Files:**
- Modify: `server/services/NotificationService.ts` (checkAndSendTaskReminders or sendNotification)
- Modify: `types/notification.ts` (add 'mine' option to reminder preferences)
- Modify: `tests/unit/services/notification-service.test.ts`

**Step 1: Add 'mine' to reminder preference types**

In `types/notification.ts`, change:
```typescript
  reminder_initial: 'any' | 'none';
  reminder_followup: 'any' | 'none';
  reminder_overdue: 'any' | 'none';
```
to:
```typescript
  reminder_initial: 'any' | 'mine' | 'none';
  reminder_followup: 'any' | 'mine' | 'none';
  reminder_overdue: 'any' | 'mine' | 'none';
```

And update defaults to `'mine'` (most users only want reminders for their own tasks):
```typescript
  reminder_initial: 'mine',
  reminder_followup: 'mine',
  reminder_overdue: 'mine',
```

**Step 2: Update shouldSendNotification for reminders**

In `server/services/NotificationService.ts`, update the reminder cases in `shouldSendNotification()`:

```typescript
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
```

**Step 3: Update the notification preferences validation endpoint**

In `server/api/user/notifications.put.ts`, the validation may need updating if it checks allowed values. Check and update the allowed values to include `'mine'` for reminder fields.

**Step 4: Write tests**

Add to `tests/unit/services/notification-service.test.ts`:

```typescript
describe('reminder notifications with mine preference', () => {
  const service = new NotificationService()

  it('sends reminder when preference is mine and user is assignee', () => {
    const prefs: NotificationPreferences = { ...allNonePrefs, reminder_initial: 'mine' }
    expect(service.shouldSendNotification(
      'task_reminder_initial', prefs, contextWithOccurrenceAssignedToUser, userId
    )).toBe(true)
  })

  it('does NOT send reminder when preference is mine and user is not assignee', () => {
    const prefs: NotificationPreferences = { ...allNonePrefs, reminder_initial: 'mine' }
    expect(service.shouldSendNotification(
      'task_reminder_initial', prefs, contextWithOccurrenceAssignedToOther, userId
    )).toBe(false)
  })
})
```

**Step 5: Update default preferences test**

The test in `tests/unit/logic/notifications.test.ts` that checks defaults will need updating since defaults changed from `'any'` to `'mine'` for reminders. Update accordingly.

**Step 6: Update the notification preferences UI**

In `components/NotificationPreferences.vue`, the reminder preferences dropdowns currently only have 'any'/'none'. Add 'mine' option. (Check the component to verify the exact structure.)

**Step 7: Run tests**

Run: `npm run test`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add types/notification.ts server/services/NotificationService.ts server/api/user/notifications.put.ts components/NotificationPreferences.vue tests/
git commit -m "feat: add 'mine' filter option for reminder notifications to target assignees"
```

---

## Summary

| Task | Issue | Files Modified |
|------|-------|----------------|
| 1 | Test fixture field names | `tests/fixtures/test-data.ts` |
| 2 | Actor exclusion | `TaskService.ts`, `OccurrenceService.ts` |
| 3 | Household name empty | `TaskService.ts`, `OccurrenceService.ts`, `NotificationService.ts` |
| 4 | Wire up occurrence_assigned | `OccurrenceService.ts` |
| 5 | Wire up task_completed | SKIPPED — conceptual mismatch, occurrences complete not tasks |
| 6 | Dedicated email templates | `NotificationService.ts`, tests |
| 7 | Comment-based mine filtering | `NotificationService.ts`, `OccurrenceService.ts`, tests |
| 8 | Duplicate reminder prevention | `NotificationService.ts`, `types/task.ts`, tests |
| 9 | Filter reminders to assignees | `types/notification.ts`, `NotificationService.ts`, `NotificationPreferences.vue`, tests |
