# Task Management

## Overview

Tasks are the core unit of work in Adulting.DIY. A **task definition** is the template that describes what needs to be done and how often, while **task occurrences** are the specific instances that get completed.

## Task Definitions

A task definition includes:
- **Name** and optional **description** and **instructions**
- **Category** for organization
- **Default assignees** (household members who normally handle this task)
- **Schedule configuration** (how and when it recurs)
- **Reminder configuration** (when to send reminders -- see [Notifications and Reminders](./notifications-and-reminders.md))

## Scheduling Patterns

Tasks support 8 recurrence patterns:

| Pattern | Example | Configuration |
|---------|---------|---------------|
| **Once** | "Set up the new router" | Single due date, no recurrence |
| **Fixed Interval** | "Every 2 weeks" | Interval + unit (day/week/month/year) |
| **Specific Days of Week** | "Every Monday and Friday" | Boolean flags per weekday |
| **Specific Day of Month** | "15th of each month" | Day number (1-31), or "last day of month" option |
| **Specific Weekday of Month** | "First Monday of each month" | Weekday + occurrence (first/second/third/fourth/last) |
| **Variable Interval** | "30 days after last completion" | Interval + unit, anchored to actual completion date |
| **Annual Fixed** | "Replace smoke detector batteries every Jan 1" | Month + day of month, recurs on the same calendar date each year regardless of completion |
| **Annual Variable** | "Annual furnace inspection" | Month + day of month as anchor, but shifts based on actual completion date (like variable interval, but yearly) |

### Fixed vs Variable Scheduling

When creating a task, users first choose a scheduling mode, then a pattern:

- **Fixed schedule**: Next occurrence calculated from the original due date, preserving the cadence regardless of when the task was actually completed. All patterns are available.
- **Variable schedule**: Next occurrence calculated from the actual completion/skip date, allowing the schedule to "float" based on when work was done. Only interval-based and annual patterns are available (calendar-anchored patterns like specific days of week or day of month are inherently fixed).

### Last Day of Month

For the "Specific Day of Month" pattern, a "Last day of the month" option is available. When enabled, the scheduler resolves to the actual last day of each month (28/29/30/31), so no months are ever skipped. When using a specific day number of 29 or higher, a warning notes that some months will be skipped.

## End Conditions

Tasks can be configured to stop generating occurrences:

| Condition | Behavior |
|-----------|----------|
| **Never** (default) | Recurs indefinitely |
| **After N times** | Stops after the specified number of completions |
| **Until date** | Stops when the next due date would exceed the cutoff |

## Task Occurrences

Each occurrence represents a specific instance of a task with:
- **Due date**
- **Status**: Created, Assigned, Completed, Skipped, or Deleted
- **Assignees** (inherited from task defaults, can be changed per occurrence)
- **Comments** thread for coordination
- **History log** (audit trail of all changes)

### Occurrence Actions

| Action | What happens |
|--------|-------------|
| **Complete** | Marks done, records completion timestamp, auto-generates next occurrence |
| **Skip** | Marks skipped with optional reason, auto-generates next occurrence |
| **Reassign** | Changes assignees for this specific occurrence |
| **Change due date** | Reschedules this specific occurrence |
| **Comment** | Adds a comment visible to household members |
| **Edit comment** | Authors can edit their own comments after posting |

Completing or skipping an occurrence automatically triggers generation of the next occurrence (for recurring tasks).

## Task Lifecycle

```
active ──→ paused ──→ active (unpause)
  │           │
  │           └──→ soft-deleted
  └──→ soft-deleted
```

| Status | Generates next occurrence? | Future pending occurrences |
|--------|--------------------------|---------------------------|
| **Active** | Yes (on complete/skip, scheduler as backup) | One pending at a time |
| **Paused** | No | Marked as deleted |
| **Soft-deleted** | No | Marked as deleted |

- **Pausing**: All future pending occurrences are deleted. Current/overdue occurrences can still be completed or skipped.
- **Unpausing**: Re-activates the task and immediately generates the next occurrence based on the task's schedule. For variable interval tasks, the next date is calculated from the last completed/skipped occurrence.
- **Deleting**: Same as pausing, but the task is hidden from queries and cannot be restored.

## Editing a Task's Schedule

When a task's schedule configuration is changed:

1. All future pending occurrences (`created`/`assigned`) are deleted
2. A new occurrence is generated based on the updated schedule
3. Completed and skipped occurrences are preserved (they are historical records)
4. Non-schedule changes (name, description, category, instructions) do not affect existing occurrences

## Catch-Up Feature

When overdue occurrences pile up, users can "catch up" a task:

1. All overdue occurrences are bulk-skipped
2. A single new occurrence is created for the next appropriate future date
3. The next date respects the task's scheduling pattern (e.g., next Monday for a weekly-on-Monday task)

Users can optionally override the calculated next date with a custom one.

### Automatic Catch-Up on Completion

When a user completes (or skips) an overdue occurrence, the system generates the next occurrence anchored to the completed one's original due date so the schedule pattern stays aligned. If that computed next date would *also* be in the past, the system automatically advances it to the next future slot — equivalent to running catch-up on the user's behalf. This prevents the "complete one overdue, get another overdue" loop when a task has been missed for multiple cycles. Auto-catch-up events are logged on the task history as `catch_up` with `trigger: auto_on_execute_or_skip`.

Note on `endCondition.times`: the count tracks *actual* occurrences created, not schedule slots. Auto-catch-up does not consume phantom slots for cycles that were skipped — a task set to "10 times, weekly" will produce 10 occurrences regardless of how many cycles were auto-caught-up, they'll just be spread across more calendar time.

## Filtering and Sorting

Both the tasks list and occurrences list pages provide a compact toolbar for filtering, sorting, and searching.

### Task List Filters

| Filter | Options |
|--------|---------|
| **Search** | Free-text search across task names |
| **Status** | Active (default), Overdue, Paused, Deleted |
| **Category** | All categories or a specific one |

Sortable columns: Task name, Category, Next Due date, Status. Click a column header to toggle ascending/descending.

### Occurrences List Filters

| Filter | Options |
|--------|---------|
| **Search** | Free-text search across task names |
| **Status** | Pending (default), Completed, Skipped, Deleted |
| **Category** | All categories or a specific one |
| **Assignee** | All assignees or a specific household member |
| **Date range** | Optional from/to date filter (collapsible) |

Sortable columns: Task name, Due Date, Status, Assignees.

### Filter Persistence

All filter and sort selections are saved to `localStorage` and restored on the next visit, so users return to their preferred view.
