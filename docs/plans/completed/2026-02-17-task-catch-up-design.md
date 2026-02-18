# Task Catch-Up Feature Design

## Overview

A "catch up" feature that lets users skip all overdue occurrences for a task and reset it to its next upcoming due date. Accessible from the task detail page and the task context menu on the task list.

## Data Model

### New `TaskHistoryLog` Model

A new table for task-level events, separate from occurrence-level history.

```prisma
model TaskHistoryLog {
  id        String         @id @default(uuid())
  task      TaskDefinition @relation(fields: [taskId], references: [id])
  taskId    String
  user      User           @relation(fields: [userId], references: [id])
  userId    String
  logType   String         // "created" | "edited" | "paused" | "unpaused" | "catch_up" | "soft_deleted"
  details   Json?          // Flexible payload per event type
  comment   String?        // Optional user-provided comment
  createdAt DateTime       @default(now())
  @@map("task_history_logs")
}
```

Relations added to `TaskDefinition` and `User` models.

**Log types**: `catch_up` is the primary type for this feature. The model supports future event types (paused, edited, etc.) but we only implement `catch_up` now.

**Details payload for catch_up**:
```json
{
  "occurrencesSkipped": 15,
  "newDueDate": "2026-03-15T00:00:00.000Z",
  "previousDueDate": "2024-11-01T00:00:00.000Z"
}
```

## Backend Logic

### API Endpoint: `POST /api/tasks/[id]/catch-up`

**Request body**: `{ comment?: string }`

**Auth**: Requires household membership (uses `defineHouseholdProtectedEventHandler`).

**Logic**:

1. Fetch all overdue occurrences for the task (status `created` or `assigned`, `dueDate < now`), ordered by dueDate ascending.
2. For each overdue occurrence:
   - Set status to `skipped`, `skippedAt` to now.
   - Create `OccurrenceHistoryLog` entry with `logType: "status_change"` and comment "Skipped during catch-up".
3. Calculate the next due date based on schedule type:
   - **Fixed schedules** (fixed_interval, specific_days_of_week, specific_day_of_month, specific_weekday_of_month): Walk forward from the last overdue occurrence's due date using `calculateNextDueDate()` until the result is today or later.
   - **Variable interval**: Today + the configured interval (e.g., today + 7 days).
   - **Once**: No new occurrence generated.
4. If no future occurrence already exists, create a new occurrence with the calculated due date.
5. Log a `catch_up` entry to `TaskHistoryLog` with the details payload and optional user comment.
6. Return `{ occurrencesSkipped: number, newDueDate: string | null }`.

**Edge cases**:
- If there are no overdue occurrences, return 400 "No overdue occurrences to catch up".
- If a future occurrence already exists, skip creation but still skip the overdue ones.

## What Happens to Occurrences

All overdue occurrences are **marked as skipped** (not deleted). Each gets:
- Status set to `skipped`
- `skippedAt` timestamp
- An `OccurrenceHistoryLog` entry: status_change with comment "Skipped during catch-up"

This preserves the full audit trail — you can see every occurrence that existed and that it was skipped as part of a catch-up.

## Task Timeline

### New `TaskTimeline.vue` Component

Added to the task detail page below the occurrences table.

- Fetches from `GET /api/tasks/[id]/history`
- Visual style matches `OccurrenceTimeline.vue` — vertical timeline with icons, timestamps, user attribution
- Catch-up entries display: "Caught up — 15 occurrences skipped. Next due date: March 15, 2026" plus user comment if provided
- Initially only shows `catch_up` events; model supports future event types

### New API Endpoint: `GET /api/tasks/[id]/history`

Returns all `TaskHistoryLog` entries for the task, ordered by `createdAt` descending, with user relation included.

## Frontend

### Entry Points

1. **Task context menu** (task list page): "Catch Up" menu item, visible when `nextOccurrence.dueDate < today`.
2. **Task detail page**: "Catch Up" button alongside Edit/Pause/Delete, visible when there are overdue occurrences.

### Confirmation Modal

- Header: "Catch Up — [Task Name]"
- Body: "This task has **N overdue occurrences**. They will be marked as skipped and the next due date will be set to **[date]**."
- Optional comment textarea with placeholder "Add a reason (optional)"
- Buttons: "Cancel" and "Catch Up"

### After Success

Toast confirming "Caught up — N occurrences skipped. Next due: [date]." Page data refreshed.

## Tests

### Unit Tests

1. **Catch-up date calculation**:
   - Fixed interval: walks forward to next future date
   - Variable interval: today + interval
   - Specific days of week: next matching weekday from today
   - Specific day of month: next matching day from today
   - Once: no new occurrence
   - Mixed overdue/future: only skips overdue, leaves future alone

2. **Catch-up service method**:
   - Skips all overdue occurrences with correct status/timestamp
   - Creates OccurrenceHistoryLog on each skipped occurrence
   - Creates TaskHistoryLog with correct details
   - Stores optional user comment
   - Creates new occurrence with correct due date
   - Returns correct count and new due date

### Integration Tests

3. **API endpoint** `POST /api/tasks/[id]/catch-up`:
   - Happy path: returns skipped count and new due date
   - No overdue occurrences: returns 400
   - Auth: requires household membership

Approximately 12-15 test cases covering critical paths.
