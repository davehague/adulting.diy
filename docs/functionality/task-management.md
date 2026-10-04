# Task Management

> Set up the household's recurring and one-time tasks, then complete, skip, reassign and discuss each one as it comes due.

## What You Can Do

- Create a task with a name, optional description and instructions, a category, default assignees, a schedule and reminder rules
- Choose from 8 recurrence patterns, on either a fixed or a variable schedule
- Have a task stop on its own after a number of times or after a date
- Complete or skip each occurrence, reassign it, move its due date, and comment on it
- Pause a task and resume it later, or delete it
- Catch up a task whose overdue occurrences have piled up
- Search, filter and sort the task list and the occurrence list
- See what is overdue, due today and coming up on the dashboard

## How It Works

### Tasks and Occurrences

A **task** is the template: what needs doing, who normally does it, and how often. An **occurrence** is one specific instance of that task with its own due date, status, assignees, comments and history. A task includes:

- **Name** and optional **description** and **instructions**
- **Category** for organization
- **Default assignees** (the household members who normally handle it)
- **Schedule** (how and when it recurs)
- **Reminder rules** (see [Notifications and Reminders](./notifications-and-reminders.md))

### Scheduling Patterns

| Pattern | Example | What you set |
|---------|---------|--------------|
| **Once** | "Set up the new router" | A single due date, no recurrence |
| **Fixed Interval** | "Every 2 weeks" | An interval and unit (day/week/month/year) |
| **Specific Days of Week** | "Every Monday and Friday" | Any combination of weekdays |
| **Specific Day of Month** | "15th of each month" | A day number (1-31), or "last day of month" |
| **Specific Weekday of Month** | "First Monday of each month" | A weekday and which one (first/second/third/fourth/last) |
| **Variable Interval** | "30 days after last completion" | An interval and unit, counted from the actual completion date |
| **Annual Fixed** | "Replace smoke detector batteries every Jan 1" | A month and day; recurs on the same calendar date each year regardless of completion |
| **Annual Variable** | "Annual furnace inspection" | A month and day as the starting point, then shifts based on the actual completion date |

When creating a task, you first choose a scheduling mode, then a pattern:

- **One time**: a single due date.
- **Fixed schedule**: the next occurrence is calculated from the original due date, preserving the cadence regardless of when the task was actually done. Offers the interval, days-of-week, day-of-month, weekday-of-month and annual patterns.
- **Variable schedule**: the next occurrence is calculated from the actual completion or skip date, so the schedule "floats" with when the work was done. Offers only the interval and annual patterns, since calendar-anchored patterns are inherently fixed.

For "Specific Day of Month", the "Last day of the month" option resolves to the real last day of each month (28/29/30/31), so no month is skipped. Choosing a day number of 29 or higher shows a warning that some months will be skipped.

### End Conditions

| Condition | Behavior |
|-----------|----------|
| **Never** (default) | Recurs indefinitely |
| **After N times** | Stops once the task has had the specified number of occurrences |
| **Until date** | Stops when the next due date would land on or after the cutoff |

The "After N times" count tracks occurrences actually created, not calendar slots, so weeks that were caught up over do not use up the count. Occurrences removed by pausing or by a schedule change do not count either.

### Occurrences

Each occurrence has a due date, a status (Created, Assigned, Completed, Skipped or Deleted; Created and Assigned together are "pending"), assignees inherited from the task's defaults, a comment thread, and a history of every change.

| Action | What happens |
|--------|-------------|
| **Complete** | Marks it done, records when (now, or a date and time you choose), and generates the next occurrence |
| **Skip** | Marks it skipped with an optional reason, and generates the next occurrence |
| **Reassign** | Changes the assignees for this occurrence only |
| **Change due date** | Reschedules this occurrence only |
| **Comment** | Adds a comment visible to the household |
| **Edit comment** | Authors can edit their own comments |

For recurring tasks, completing or skipping an occurrence generates the next one straight away. A daily background check also makes sure every active recurring task has a pending occurrence.

### Task Lifecycle

| Status | Generates next occurrence? | Future pending occurrences |
|--------|--------------------------|---------------------------|
| **Active** | Yes | One pending at a time |
| **Paused** | No | Removed |
| **Deleted** | No | Removed |

- **Pausing** removes all future pending occurrences (they move to the Deleted filter in the occurrence list). Current and overdue occurrences can still be completed or skipped.
- **Unpausing** re-activates a recurring task and generates its next occurrence from the schedule. For variable schedules, the next date is counted from the last completed or skipped occurrence. If there is none yet, an Annual Variable task goes back to its starting date and a Variable Interval task waits, with no occurrence generated. A task that has already had all of its "After N times" occurrences generates nothing.
- **Deleting** works like pausing, but the task is hidden everywhere (unless the Deleted filter is chosen) and cannot be restored.

### Editing a Task's Schedule

Changing a task's schedule removes its pending occurrences that are due in the future and generates a new one from the updated schedule. Pending occurrences that are overdue or due today stay, and completed and skipped occurrences are kept as history. Changing anything else (name, description, category, instructions) does not affect existing occurrences.

### Catch-Up

When overdue occurrences pile up, you can catch up a task: every overdue occurrence is skipped in one go and a single new occurrence is created on the next appropriate future date, respecting the task's pattern (for example, the next Monday for a weekly-on-Monday task). You can override the calculated date with one of your own, and add a reason. If the task already has a pending occurrence in the future, that one is kept (or moved to your chosen date) instead of a new one being created.

Catch-up also happens automatically. When you complete or skip an overdue occurrence, the next one is calculated from the original due date so the pattern stays aligned; if that date would also be in the past, the system moves it forward to the next future slot. This prevents the "complete one overdue, get another overdue" loop when a task has been missed for several cycles. Each automatic catch-up is recorded in the task's history.

### Lists, Filters and Sorting

| List | Filters | Sortable columns |
|------|---------|------------------|
| **Tasks** | Search by name or description; Status (Active by default, Overdue, Paused, Deleted); Category | Task name, Category, Next Due date, Status |
| **Occurrences** | Search by task name or description; Status (Pending by default, Completed, Skipped, Deleted); Category; Assignee; optional date range | Task name, Category, Due Date, Status |

Filter and sort selections are remembered in the browser and restored on the next visit.

### Dashboard

The dashboard is the landing page after sign-in. It greets you by first name and time of day, offers a New Task button, and shows three stat cards:

| Card | What it shows | Links to |
|------|--------------|----------|
| **Overdue** | Pending occurrences past their due date | Occurrences list, pending |
| **Due Today** | Pending occurrences due today | Occurrences list, pending and due today or earlier (so overdue ones are listed too) |
| **Completed (7d)** | Occurrences completed in the last 7 days | Occurrences list, completed |

A **Coming Up** feed lists the next 5 pending occurrences, earliest first, each with a color-coded dot (red for overdue, amber for due today, grey for upcoming), the task name and category, the due date, and the assignees on larger screens. Each entry opens its occurrence, and a link at the bottom opens the full occurrences list.

## Connections

- **[Notifications and Reminders](./notifications-and-reminders.md)**: creating, pausing and deleting tasks, and assigning, completing, skipping and commenting on occurrences, all notify household members. Each task carries its own reminder rules.
- **[Household Management](./household-management.md)**: assignees are household members and categories come from the household. When a member leaves, they are removed from task defaults and upcoming occurrences but stay visible in history.
- **[Providers](./providers.md)**: a task can be linked to the providers who do that work.
- **[Projects](./projects.md)**: the dashboard also shows each Active project's next step, between the stat cards and Coming Up.

## Where It Appears

- **Dashboard**: stat cards and the Coming Up feed
- **Tasks**: the task list, the create and edit forms, and the task page (details, history, linked providers, pause, delete and catch-up)
- **Occurrences**: the occurrence list and the occurrence page (complete, skip, reassign, reschedule, comments, history)
- **Reminder emails**: buttons that open the occurrence and the task

## Current Limitations

- A deleted task cannot be restored.
- Only one pending occurrence exists per task at a time; there is no view of dates further out, and no calendar view.
- Variable schedules support only the interval and annual patterns.
- Manual catch-up does not check the end condition, so it can add an occurrence to a task that has already reached its limit.
- The first occurrence of a new recurring task falls one cycle out rather than today: for example, a monthly day-of-month task starts next month even if the day is still ahead this month.
- A day-of-month of 29 or higher skips shorter months unless "last day of month" is used.
- Tasks cannot have file attachments, rich text, or dependencies on other tasks.
