# Changelog

## 2026-02-18

### Flexible Reminders
- Tasks can now have up to 5 reminder rules with independent timing
- Reminders support before, on, and after due date timing
- Overdue reminders ("X days after") provide nudges for incomplete tasks
- Reminder subject lines adapt based on timing context

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
