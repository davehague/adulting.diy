# Changelog

## 2026-10-09

### Moving lists in from other tools
- Scripts holding the household's API key can now create projects (with their steps) and tasks, so a list kept in another app can be moved in at once; running the same move twice does not create duplicates
- A recurring task created this way gets its first due date straight away, including a "variable" one (counted from completion) that would otherwise wait for a first completion

### Photos in the project chat (on for selected households)
- A camera button in the chat takes or picks up to three photos, adds them to the project's Photos at once, and sends them with your question; the advisor sees them at full size and every other project photo as a thumbnail
- A message can be photos alone; the thread shows a message's photos above its text
- Projects can now hold 25 photos instead of 10
- The chat now runs on a faster model that can read pictures, so replies may read a little differently

## 2026-10-08

### Project chat (on for selected households)
- A project page now has a **Chat** button beside the Title that opens a full-screen chat about that project; the advisor already knows the project's notes, steps, plan, trades and linked providers, and remembers the whole conversation
- When a question needs current facts, the advisor can search the web and names the page it used; a "Searched: …" line under the reply shows what it looked up
- The thread is shared by the household; a message from the other member carries a "Household member" caption, and only one reply at a time is made per project
- A question that gets no reply stays in the thread with a **Retry** button; the text box keeps what you typed when a send does not go through
- Chat messages do not count against the daily limit of 20 that provider suggestions and DIY plans share

### DIY plan
- A project with saved provider suggestions no longer gets a "Hire this out" plan just because a trade is listed; the plan judges the work itself

## 2026-10-06

### DIY plan (on for selected households)
- A project page now has a **DIY plan** card: tap **Plan it** and get the steps in order with a time and a cost range each, the tools you probably have and may need, the materials with quantities, how hard the job is and why, and a safety line when one applies
- **Add** copies a step into the project's checklist with its time estimate; **Add all** copies every step that is not there yet
- When a job is really one for a professional, the plan says "Hire this out", lists the homeowner's steps instead, and offers **Find a provider** and **Set path to Hire**
- Steps that need a licensed trade are marked "Pro step" with the reason
- The latest plan is saved on the project and shown again when the page is reopened
- Provider suggestions and plans now share one daily limit of 20 asks per household

## 2026-10-05

### Suggested providers (on for selected households)
- The Find a provider window can now suggest providers: tap **Suggest providers** and the project is split into the trades it needs, with up to three providers from your own directory for each and a short reason for every pick
- An optional "Anything to add?" box takes details the project's notes do not have
- Add from a suggestion keeps the window open, so several providers can be added in a row
- Every trade has a **Search Google** link for finding that kind of contractor nearby, including when the directory has nobody to suggest
- The latest suggestions are saved on the project and shown again when the window is reopened
- Providers marked Avoid or Passed are never suggested, and phone numbers, emails and links are masked before anything is sent to the AI model

### Find a provider
- Adding a provider to a project now opens a **Find a provider** window with search, category and status filters, and sorting by most mentioned, recently mentioned, highest rated or name
- Tapping a provider there shows its details first (phone, your rating and notes, what neighbors said with links to the original posts, comments) instead of adding it straight away
- A provider is added with an explicit Add button, and ones already on the project are marked

## 2026-10-04

### Home Projects (slice 3a): providers on a project
- A project can have providers from the household directory linked to it, each with its own status for that project: Considering, Contacted, Chosen or Passed
- Finding a provider starts from a category saved on the project, so the list shows only that kind of provider first, most-mentioned first; other categories are a filter away
- Each linked provider shows a tap-to-call phone number and its neighbor recommendation count
- A project's card shows who has been chosen
- A provider's page lists the projects it is linked to, with the status on each

### Fixes to schedules, reminders and household permissions
- Tasks set to end "after N times" now get all N occurrences; they used to stop one short. A task that stopped early will get its missing occurrence
- Annual Variable tasks now schedule the next occurrence a year after the task was actually completed or skipped, as intended, instead of a year after the due date
- Reminders that were silently never sent now go out: the longest "after the due date" reminder on a task (including the default "3 days after"), and "on the due date" reminders on tasks with no "after" reminder
- Only household admins can change household settings, regenerate the invite code, remove members and change who is an admin; the check behind this was unreliable
- Account details can only be looked up by the signed-in person they belong to

### Home Projects (slice 2): steps and next steps
- Each project can have a checklist of steps: a line of text, a done checkbox and an optional time estimate in minutes; steps stay in the order they were added
- The dashboard has a new **Project next steps** section showing the next undone step of every Active project, which can be checked off there
- Checking off a project's last step asks whether to mark the project Done
- Projects with no steps, or with every step done, appear in the dashboard list as themselves

## 2026-10-03

### Home Projects (slice 1)
- New Projects page: a household list of things to fix, improve or build, with a title, optional location, status (Planning, Active, Future, Done) and path (DIY, Hire, Not sure)
- Capture from a phone or desktop with a title only, or with location and photos; photos are shrunk in the browser before upload, with per-photo retry if an upload fails
- Project page with photos shown full size, every field editable in place, and photo and project deletion
- Photos are private: only a signed-in member of the owning household can load one; up to 10 photos per project
- A **Projects** link was added to the main navigation beside Providers

## 2026-09-30

### Providers
- New Providers page: a household directory of contractors and service providers with search, category and status filters, and sorting
- Provider detail page with contact info, extra contacts, private rating, hired date and notes, and comments from either household member
- Admin-managed provider categories and statuses in Household > Provider settings (defaults: Lead, Recommended, Hired, Passed, Avoid)
- Neighbor evidence with source links and a "recommended by N neighbors" badge
- Providers can be linked to tasks from the task detail page
- Per-household API keys (created by admins, shown once, revocable) and a bulk ingest API for loading neighbor recommendations

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
