# Notifications and Reminders

> Keeps household members informed by email and Slack when something happens to a task and when a task is coming due, with each person choosing what they hear about.

## What You Can Do

- Choose, for each kind of event, whether to hear about everything in the household, only what involves you, or nothing
- Turn email and Slack delivery on or off independently
- Give each task up to 5 reminder rules: before, on, or after its due date
- Jump straight from a reminder email to the occurrence or the task

## How It Works

### Notification Events

Notifications fire automatically when key actions happen in the household.

| Event | Trigger | Default |
|-------|---------|---------|
| Task Created | New task added to the household | Any task |
| Task Paused | Task paused | Any task |
| Task Deleted | Task deleted | Any task |
| Occurrence Assigned | Occurrence assigned to someone | My occurrences only |
| Occurrence Completed | Occurrence completed | My occurrences only |
| Occurrence Skipped | Occurrence skipped | My occurrences only |
| Occurrence Commented | Comment added to an occurrence | My occurrences only |
| Task Reminders | A task's reminder rule comes due | My tasks only |

### Preferences

Each person sets a preference per event:

- **Any**: notifications for every such event in the household
- **Mine only**: only for occurrences the person is assigned to. For Occurrence Commented, people who have already commented on the occurrence count as well. Not offered for the three task-level events.
- **None**: no notifications for that event

When an occurrence's assignees change, everyone now assigned is notified, not only the people who were added. Occurrences that pick up a task's default assignees automatically do not send an assignment notification.

The person who performs an action is never notified about it. If Alice creates a task, Alice hears nothing, but other members who chose "Any task" do.

### Channels

| Channel | Default | Setup |
|---------|---------|-------|
| **Email** | On | None |
| **Slack** | Off | Requires a Slack incoming webhook URL |

Each channel is toggled independently, and both can be on at once.

### Reminder Rules

A rule is a number of days plus a direction: **before** the due date, **on** the due date, or **after** it (an overdue nudge). A task can have up to 5 rules.

For example, a task due February 25 with four rules (7 days before, 1 day before, on the due date, 3 days after) sends reminders on Feb 18, Feb 24, Feb 25 and Feb 28.

New tasks created in the app start with two rules: on the due date, and 3 days after. Either can be removed and more added.

### Reminder Delivery

- Reminders are sent once a day
- The same reminder is never sent twice for the same occurrence on the same day
- Reminders are only sent for pending occurrences, so an "after" reminder stops once the occurrence is completed or skipped; paused tasks send no reminders
- With the default "My tasks only" preference, a reminder for an occurrence with no assignees reaches nobody
- Subject lines adapt to the rule: due in X days, due tomorrow, due today, or X days overdue
- Reminder emails carry two buttons: **Complete Occurrence** opens that occurrence so it can be marked done, and **View Task** opens the task for its history, pausing or catch-up. Slack reminders carry a single button that opens the occurrence

## Connections

- **[Task Management](./task-management.md)**: every event comes from a task or one of its occurrences, and reminder rules are part of each task.
- **[Household Management](./household-management.md)**: notifications go to members of the household, and the household's timezone decides what "today" means for reminders.

## Where It Appears

- **Profile > Notification Preferences**: per-event preferences and channel settings
- **Task create and edit forms**: the task's reminder rules
- **Your inbox and Slack**: the notifications themselves

## Current Limitations

- Email and Slack are the only channels; there are no push or in-app notifications.
- Slack delivery is set up per person with their own webhook, not once for the household.
- Reminders go out once a day at a fixed time; you cannot choose the time of day.
- Only tasks and occurrences generate notifications. Providers and projects do not.
