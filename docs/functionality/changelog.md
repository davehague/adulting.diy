# Changelog

## 2026-04-23

### Email Reminder Improvements
- Task reminder emails now include both a "Complete Occurrence" button (to the occurrence page) and a "View Task" button (to the task detail page)
- Renamed the primary action from "Complete Task" to "Complete Occurrence" to match what the action actually does

### Login Redirect Preservation
- Clicking a protected link (e.g. an email button) while logged out now returns you to that destination after sign-in, instead of dropping you on the dashboard

### Auto Catch-Up on Overdue Completion
- Completing or skipping an overdue occurrence no longer produces another already-overdue occurrence when a task has been missed for multiple cycles; the system auto-advances the next occurrence to the next future slot
- An explicit `catch_up` task history entry is written when auto-advance fires

## 2026-03-07

### Schedule Configuration UX Overhaul
- Replaced the flat 8-option schedule type dropdown with a two-step selection: first choose a mode (One Time, Fixed Schedule, Variable Schedule) via radio buttons, then pick a pattern from a filtered dropdown
- Added contextual helper text explaining each mode (e.g., "Next occurrence follows the calendar pattern, regardless of when completed")
- Consistent pattern labels across fixed and variable modes (removed redundant "After Completion" / "Fixed Date" suffixes)
- End condition (never/times/date) is now hidden for one-time tasks since it doesn't apply
- Added due date field for one-time tasks on the edit form (was previously missing)

### Last Day of Month Scheduling
- Added "Last day of the month" checkbox option for the Specific Day of Month pattern
- When checked, the day number input is hidden and the scheduler uses the actual last day of each month (28/29/30/31)
- When unchecked with day 29/30/31 selected, a warning explains that some months will be skipped and suggests using "Last day of the month" instead

### Schedule Test Coverage
- Added comprehensive test coverage for all schedule patterns with all end conditions (never, times, date)
- Covers edge cases: Sunday/Monday boundaries, Feb leap year handling, year boundary wraps, month-skipping for days 29-31, all weekday-of-month permutations (first through last × all weekdays)

## 2026-02-20

### Detail Page Polish
- Unified status styling on task and occurrence detail pages to match their respective grid views (icon + text instead of colored capsules)
- Moved status and category from the TaskDetails header into the Task Information section as labeled fields
- Removed category from occurrence details (it belongs to the task, already shown in Task Details)
- Added skeleton loaders to task detail and occurrence detail pages (replaces plain "Loading..." text)

## 2026-02-19

### UI Consistency Improvements
- Unified context menu styling across occurrences and task detail pages to match the tasks list page (icons, stone-700 text color)
- Added mobile context menus to task detail occurrence list (Edit, Complete, Skip)
- Replaced browser confirm dialogs with proper Pause and Delete modals on task detail page (reusing shared modal components)
- Changed pending status icon from empty circle to play circle to match active task icon

### Scheduler Duplicate Occurrence Fix
- Fixed the scheduler creating extra pending occurrences for tasks that already had one
- The scheduler now only generates an occurrence when a task has zero pending occurrences (acts as a gap-filler)
- Cleaned up 4 tasks that had duplicate pending occurrences in production

## 2026-02-18

### Former Household Members
- When a user leaves a household, their name is preserved for historical display
- Departed users appear with dimmed grey italic styling throughout the app (task lists, occurrence lists, detail pages, timelines)
- Future task assignments are automatically cleaned up when a user leaves (removed from default assignees and upcoming occurrences)
- Past/completed occurrences retain the departed user for historical accuracy
- If a user rejoins the same household, they are restored as a normal active member

### Leave Household Improvements
- Leave household consolidated to the profile page (removed from household settings)
- Admins who are the sole admin see a helpful dialog directing them to transfer privileges before leaving
- Non-admin users see a standard confirmation dialog
- Fixed broken leave household API (was passing undefined user ID)

### Task-Occurrence Lifecycle Improvements
- Unpausing a task now immediately generates the next occurrence (previously required waiting for the daily scheduler)
- Editing a task's schedule now reconciles occurrences: future pending occurrences are deleted and regenerated based on the new schedule
- Completed and skipped occurrences are preserved during schedule changes
- Added invariant test ensuring catch-up never leaves a recurring task without an active occurrence
- Fixed 3 orphaned active tasks in production that had no active occurrences

### Flexible Reminders
- Tasks can now have up to 5 reminder rules with independent timing
- Reminders support before, on, and after due date timing
- Overdue reminders ("X days after") provide nudges for incomplete tasks
- Reminder subject lines adapt based on timing context
- New tasks default to an "on due date" reminder (removable)
- Task detail view updated to display the new reminder format
- All existing active tasks backfilled with an "on due date" reminder

### Notification Channels
- Added Slack as a notification channel alongside email
- Users can enable/disable channels independently in notification preferences
- Slack uses incoming webhooks with Block Kit formatting

### Notification Fixes
- Fixed silent notification failures that could cause reminders to be lost
- Individual provider errors no longer block other channels
- Added deduplication to prevent duplicate reminders on the same day
- Improved actor exclusion rule for task creation events

### Timezone Support
- Households now have a configurable timezone setting
- Reminder scheduling respects household timezone for "today" calculations
- Daily deduplication boundaries align with household timezone

### Task Catch-Up
- Added catch-up feature for tasks with accumulated overdue occurrences
- Bulk-skips all overdue occurrences and generates next future occurrence
- Respects scheduling patterns when calculating the next date
- Supports optional user-specified override date
