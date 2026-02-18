# Notifications and Reminders

## Overview

Adulting.DIY keeps household members informed through event-based notifications and flexible task reminders. Users control what they receive, through which channels, and at what granularity.

## Notification Events

Notifications fire automatically when key actions happen in the household.

### Task-Level Events

| Event | Trigger | Default Preference |
|-------|---------|-------------------|
| `task_created` | New task added to household | `any` |
| `task_paused` | Task paused (stops generating occurrences) | `any` |
| `task_deleted` | Task soft-deleted | `any` |

### Occurrence-Level Events

| Event | Trigger | Default Preference |
|-------|---------|-------------------|
| `occurrence_assigned` | Occurrence assigned to someone | `mine` |
| `occurrence_executed` | Task occurrence completed | `mine` |
| `occurrence_skipped` | Task occurrence skipped | `mine` |
| `occurrence_commented` | Comment added to an occurrence | `mine` |

### Reminders

| Event | Trigger | Default Preference |
|-------|---------|-------------------|
| `reminders` | Scheduled reminder based on task's reminder config | `mine` |

## User Preferences

Each user controls notifications per event type with three options:

- **`any`**: Receive notifications for all events in the household
- **`mine`**: Only receive notifications for occurrences the user is involved in (assigned to or has commented on)
- **`none`**: Disable notifications for that event type

Preferences are managed at **Profile > Notification Preferences**.

## Channels

Notifications can be delivered through multiple channels simultaneously:

| Channel | Default | Configuration |
|---------|---------|---------------|
| **Email** | Enabled | No extra setup needed |
| **Slack** | Disabled | Requires a Slack incoming webhook URL |

Each channel can be toggled independently. If Slack is enabled, a valid webhook URL (`https://hooks.slack.com/services/...`) must be provided.

## Flexible Reminders

Each task definition can have up to **5 reminder rules**, each with its own timing relative to the due date.

### Reminder Entry Format

| Field | Type | Description |
|-------|------|-------------|
| `days` | number (0+) | Number of days offset |
| `timing` | `before` \| `on` \| `after` | Direction relative to due date |

### Timing Examples

| Configuration | When it fires |
|--------------|---------------|
| `{ days: 7, timing: "before" }` | 7 days before due date |
| `{ days: 1, timing: "before" }` | 1 day before due date |
| `{ days: 0, timing: "on" }` | On the due date |
| `{ days: 3, timing: "after" }` | 3 days after due date (overdue) |

### Example: Multi-Reminder Task

A task with due date February 25 and this config:
```json
{
  "reminders": [
    { "days": 7, "timing": "before" },
    { "days": 1, "timing": "before" },
    { "days": 0, "timing": "on" },
    { "days": 3, "timing": "after" }
  ]
}
```

Triggers reminders on: Feb 18, Feb 24, Feb 25, and Feb 28.

### Reminder Delivery

- Reminders run daily via a scheduled cron job
- Each reminder is deduplicated per occurrence per day (no double-sends)
- "After" reminders serve as overdue nudges for incomplete tasks
- Reminder subject lines adapt to timing:
  - **Before**: "Reminder: [Task] due in X days"
  - **On**: "Due Today: [Task]"
  - **After**: "Overdue: [Task] (X days overdue)"

## Actor Exclusion Rule

The user who triggers an action is **never** notified about their own action. For example, if Alice creates a task, Alice does not receive a `task_created` notification -- but other household members with `any` preference do.
