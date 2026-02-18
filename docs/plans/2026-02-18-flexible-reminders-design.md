# Flexible Reminder Configuration Design

**Date:** 2026-02-18
**Status:** Approved

## Overview

Replace the fixed 3-slot reminder system (initialReminder, followUpReminder, overdueReminder) with a Google Calendar-style "add as many as you want" model. Users can add up to 5 reminders per task, each configured as before/on/after the due date.

## Design Decisions

- **Max reminders per task:** 5
- **Data model:** Explicit objects `{ days: number, timing: 'before' | 'on' | 'after' }`
- **Notification preferences:** Single `reminders: 'any' | 'mine' | 'none'` (replaces 3 separate settings)
- **Email templates:** Auto-tone by timing (amber for before/on, red for after)

## Data Model

```typescript
// types/task.ts
export interface ReminderEntry {
  days: number;              // 0+ integer
  timing: 'before' | 'on' | 'after';
}

export interface ReminderConfig {
  reminders: ReminderEntry[];  // max 5 entries
}
```

When `timing` is `'on'`, `days` is always 0 (enforced by validation).

### NotificationEventType

Collapse from 3 types to 1:
- Remove: `task_reminder_initial`, `task_reminder_followup`, `task_reminder_overdue`
- Add: `task_reminder`

### NotificationPreferences

Collapse from 3 settings to 1:
- Remove: `reminder_initial`, `reminder_followup`, `reminder_overdue`
- Add: `reminders: 'any' | 'mine' | 'none'`

### Deduplication

Key in `occurrence_history_logs.newValue` changes to per-reminder identifier:
- `task_reminder:before:3`
- `task_reminder:on:0`
- `task_reminder:after:2`

## Backend Changes

### validateReminderConfig (server/utils/validation.ts)

- Input must be object with `reminders` array
- Each entry: `days` (non-negative integer), `timing` ('before' | 'on' | 'after')
- If `timing` is `'on'`, force `days` to 0
- Deduplicate identical entries
- Cap at 5 entries
- Return `null` if no valid reminders
- Auto-convert old format `{ initialReminder, followUpReminder, overdueReminder }` to new format

### checkAndSendTaskReminders (NotificationService)

- Replace 3 hardcoded blocks with loop over `task.reminderConfig.reminders`
- For each entry, compute target date:
  - `before`: `dueDate - days`
  - `on`: `dueDate` (days is 0)
  - `after`: `dueDate + days`
- Check `isDateToday(targetDate, timezone)`
- Dedup key: `task_reminder:${timing}:${days}`
- Pass `reminderEntry` in `NotificationContext` for email tone

### shouldSendNotification

- Remove 3 separate reminder cases
- Add single `case "task_reminder"` reading `preferences.reminders` (default `'any'`)

### NotificationContext

- Add optional `reminderEntry?: ReminderEntry`

## Email Templates (EmailProvider)

Remove 3 separate templates. Add single `task_reminder` template:

| Timing | Heading | Colors | Subject |
|--------|---------|--------|---------|
| before (days > 1) | Task Reminder | amber #d97706 | Reminder: {task} due in {days} days |
| before (days = 1) | Task Reminder | amber #d97706 | Reminder: {task} due tomorrow |
| on | Due Today | amber #d97706 | Due Today: {task} |
| after | Task Overdue | red #dc2626 | Overdue: {task} ({days} days overdue) |

## Frontend Changes

### TaskCreateForm.vue & TaskEditForm.vue

Replace 3 fixed inputs with dynamic list:
- Each row: number input + timing select + remove button
- "Add Reminder" button (disabled at 5 entries)
- When "on due date" selected, days input hidden
- Default for new tasks: empty list

### NotificationPreferences.vue

- Remove 3 separate reminder dropdowns
- Add single "Task Reminders" dropdown (any/mine/none)

## Testing

### validate-reminder-config.test.ts (rewrite)

- Rejects non-object/null/undefined/array
- Accepts valid reminders array
- Enforces cap of 5
- Forces days=0 for timing='on'
- Rejects invalid timing values and negative days
- Deduplicates identical entries
- Auto-converts old format to new

### notification-service.test.ts (update)

- Remove ~15 tests referencing 3 individual reminder event types
- Add: renderEmailTemplate('task_reminder') - before/on/after tone (3 tests)
- Add: generateEmailContent('task_reminder') - subject/body variations (4 tests)
- Add: shouldSendNotification('task_reminder') - any/mine/none (3 tests)
- Add: checkAndSendTaskReminders - processes array, correct dedup keys (2-3 tests)
- Update dedup tests for new key format
- All non-reminder tests unchanged

## DB Migration

### task_definitions.reminderConfig

```sql
-- Example: { "initialReminder": 7, "followUpReminder": 1 }
-- Becomes: { "reminders": [{ "days": 7, "timing": "before" }, { "days": 1, "timing": "before" }] }

-- overdueReminder maps to timing: "after"
-- NULL stays NULL
```

### users.notificationPreferences

Collapse `reminder_initial`/`reminder_followup`/`reminder_overdue` into single `reminders`:
- If any was 'none' → 'none'
- If any was 'mine' → 'mine'
- Otherwise → 'any'
- Remove old 3 keys

## Backward Compatibility

- `validateReminderConfig`: auto-converts old format if it reaches the API
- `shouldSendNotification`: defaults missing `reminders` pref to `'any'`
- Old dedup records use different key format, no conflict with new records

## Implementation Order

1. Types & Validation (types/task.ts, types/notification.ts, validation.ts, validation tests)
2. Backend notification logic (NotificationService.ts, EmailProvider.ts, notification tests)
3. Frontend (TaskCreateForm.vue, TaskEditForm.vue, NotificationPreferences.vue)
4. DB migration (task_definitions, users tables)

**Files touched:** 10 files modified, 0 new files.
