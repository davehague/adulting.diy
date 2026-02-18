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

Tasks support 6 recurrence patterns:

| Pattern | Example | Configuration |
|---------|---------|---------------|
| **Once** | "Set up the new router" | Single due date, no recurrence |
| **Fixed Interval** | "Every 2 weeks" | Interval + unit (day/week/month/year) |
| **Specific Days of Week** | "Every Monday and Friday" | Boolean flags per weekday |
| **Specific Day of Month** | "15th of each month" | Day number (1-31) |
| **Specific Weekday of Month** | "First Monday of each month" | Weekday + occurrence (first/second/third/fourth/last) |
| **Variable Interval** | "30 days after last completion" | Interval + unit, anchored to actual completion date |

### Fixed vs Variable Intervals

- **Fixed interval**: Next occurrence calculated from the original due date, preserving the cadence regardless of when the task was actually completed.
- **Variable interval**: Next occurrence calculated from the actual completion/skip date, allowing the schedule to "float" based on when work was done. Useful for tasks like "Change air filter every 90 days."

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

Completing or skipping an occurrence automatically triggers generation of the next occurrence (for recurring tasks).

## Task Lifecycle

```
active ──→ paused ──→ active (unpause)
  │           │
  │           └──→ soft-deleted
  └──→ soft-deleted
```

| Status | Scheduler generates occurrences? | Future pending occurrences |
|--------|--------------------------------|---------------------------|
| **Active** | Yes | Maintained |
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
