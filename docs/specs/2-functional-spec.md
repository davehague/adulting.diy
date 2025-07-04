Adulting.DIY - Functional & Technical Specification (v1.0)
1. Introduction

Adulting.DIY is a web application designed to help households manage shared tasks related to home, pets, and general life. It aims to prevent forgotten tasks, facilitate collaboration and shared responsibility among household members, and provide a history of task execution for informed decision-making. The initial version will be a web application with email notifications, with potential for a mobile app and push notifications in the future.

2. Core Pain Points Addressed

Preventing important tasks from being forgotten.

Improving collaboration and clarity on responsibilities within a household.

Providing accessible task history to inform future decisions.

3. Development Architecture & Conventions

Platform: Web Application (Initial)

Framework: Vue 3 with Nuxt (TypeScript)

State Management: Pinia

API Layer: Nuxt server routes

Coding Style: Compositional API with <script setup>, arrow function syntax (const func = async () => {}), import { type X } from '@/path' syntax for types.

Database: CockroachDB

Hosting: Vercel

4. Household & User Management

Multi-Household: The platform supports multiple independent households. Data is strictly isolated between households.

User Model: Users are unique by email address across the platform and can belong to only one household at a time.

Sign-up / Joining:

Option 1: Create a new household (user becomes the first Admin).

Option 2: Join an existing household using an invite code.

Admin Role:

At least one Admin is required per household.

Admins can invite new users (via generating invite codes).

Admins can remove users from the household.

Admins can promote other members to Admin or revoke Admin status.

Admins manage custom task categories for the household (on Household Management page).

Permissions (MVP): All members within a household are assumed to have full permissions to create, view, edit, assign, and manage the status of all tasks and occurrences within their household. The Admin role is primarily for user and category management in the MVP.

5. Data Models

5.1. Task Definition

Purpose: Represents the template or definition of a task.

Attributes:

taskId (Unique Identifier)

householdId (Foreign Key to Household)

name (Text, required)

description (Text, optional)

categoryId (Foreign Key to Category)

instructions (Text, optional)

scheduleConfig (Object/JSON storing recurrence rules):

Type: 'Once' or 'Recurring'

Recurrence Rules (if Recurring): Based on Google Calendar patterns, supporting: Fixed Interval (every X days/weeks/months/years), Specific Days of Week, Specific Day of Month, Specific Weekday of Month, Variable Interval (X days/weeks/months after last completion/skip).

End Condition: None (Indefinite), After N occurrences, or Until Date.

reminderConfig (Object/JSON):

initialDaysBefore (Integer, optional): Days before due for initial reminder.

followUpDaysBefore (Integer, optional): Days before due for follow-up reminder.

overdueDaysAfter (Integer, optional): Days after due for overdue reminder.

defaultAssigneeIds (Array of User IDs, optional)

metaStatus (Enum: 'Active', 'Paused', 'Soft-deleted', 'Completed') - 'Completed' applies when a task with an end condition finishes.

createdAt (Timestamp)

updatedAt (Timestamp)

5.2. Task Occurrence

Purpose: Represents a specific instance of a Task Definition that is due or has been actioned.

Attributes:

occurrenceId (Unique Identifier)

taskId (Foreign Key to Task Definition)

householdId (Foreign Key to Household)

dueDate (Date/Timestamp, required)

assigneeIds (Array of User IDs) - Can be empty if status is 'Created'. Only one assignee needs to execute/skip.

status (Enum: 'Created', 'Assigned', 'Completed', 'Skipped', 'Deleted') - Note: 'Deleted' status is set programmatically when Task is paused/deleted. Occurrences are not deleted directly by users.

completedAt (Timestamp, optional)

skippedAt (Timestamp, optional)

createdAt (Timestamp)

updatedAt (Timestamp)

5.3. Occurrence History/Timeline

Purpose: Logs events related to a specific Task Occurrence. Stored potentially as a related table or JSONB field on Occurrence.

Log Entry Attributes:

logId (Unique Identifier)

occurrenceId (Foreign Key to Task Occurrence)

timestamp (Timestamp)

userId (Foreign Key to User who performed action/commented)

eventType (Enum: 'Comment', 'StatusChange', 'AssigneeChange', 'DueDateChange', 'Created')

details (Object/JSON):

If 'Comment': { comment: "User text..." }

If 'StatusChange': { fromStatus: "Assigned", toStatus: "Completed" } or { toStatus: 'Deleted', reason: 'Parent task paused'} etc.

If 'AssigneeChange': { previousAssignees: [...], newAssignees: [...] }

If 'DueDateChange': { previousDueDate: "...", newDueDate: "..." }

If 'Created': { status: "Created/Assigned", assignees: [...] }

5.4. Category

Purpose: Organizes tasks.

Attributes:

categoryId (Unique Identifier)

householdId (Foreign Key to Household, Null for predefined categories)

name (Text, required)

isPredefined (Boolean)

Predefined Categories (available to all households): House, Pets, Auto, Shopping, Bills & Finance, Appointments & Errands.

5.5. User

Attributes:

userId (Unique Identifier)

email (Text, unique, required)

name (Text, required)

passwordHash (Text, required)

householdId (Foreign Key to Household, Nullable initially)

isAdmin (Boolean, default: false)

notificationPreferences (Object/JSON, see Notification section)

createdAt (Timestamp)

updatedAt (Timestamp)

5.6. Household

Attributes:

householdId (Unique Identifier)

name (Text, required - e.g., "The Smiths' Household")

inviteCode (Text, unique, perhaps renewable)

createdAt (Timestamp)

updatedAt (Timestamp)

6. Core Workflows & Business Logic

Task Creation: User defines Task, optionally sets Default Assignees. Task becomes 'Active'. First Occurrence generated ('Assigned' if default assignees, else 'Created'). Notifications sent.

Occurrence Assignment: assigneeIds updated, status becomes 'Assigned'. Notification sent.

Occurrence Commenting: Comment logged in Timeline. Notification sent.

Occurrence Execution (Completion): status becomes 'Completed', completedAt set. Logged in Timeline. Notification sent. Check Task End Condition; if met, update Task metaStatus, send Task Completed notification. If not met, generate next Occurrence (carry over assignees, use completion date for variable recurrence).

Occurrence Skipping: Requires comment. status becomes 'Skipped', skippedAt set. Logged in Timeline. Notification sent. Check Task End Condition. If not met, generate next Occurrence (carry over assignees, use skip date for variable recurrence).

Occurrence Editing: Can change dueDate and assigneeIds. Changes logged in Timeline.

Task Pausing: Task metaStatus -> 'Paused'. Future Occurrences -> 'Deleted' (reason logged). Notifications sent (Task Pause + single Occurrence Deletion summary). No new occurrences generated.

Task Unpausing: Task metaStatus -> 'Active'. New Occurrence generated (use pause date for variable recurrence).

Task Deletion (Soft): Task metaStatus -> 'Soft-deleted'. Future Occurrences -> 'Deleted' (reason logged). Notifications sent (Task Delete + single Occurrence Deletion summary). No new occurrences generated.

Scheduler / Occurrence Generation: Background process generates future occurrences (e.g., 3 months ahead) based on 'Active' Task schedules, respecting recurrence rules and end conditions. Triggered by Task creation/unpausing, Occurrence completion/skipping.

7. Notifications (Email MVP)

Task Reminders: Configurable per task (Initial X days before, Follow-up Y days before, Overdue Z days after).

Event-Based Notifications: User-configurable preferences:

Task Created (Any except mine / None) - Default: Any except mine

Task Paused (Any / None) - Default: Any

Task Completed by End Condition (Any / None) - Default: Any

Task Soft-deleted (Any / None) - Default: Any

Occurrence Assigned (Any / Mine / None) - Default: Mine ("Mine" = Assigned to me or I commented)

Occurrence Executed (Any / Mine / None) - Default: Mine

Occurrence Skipped (Any / Mine / None) - Default: Mine

Occurrence Commented On (Any / Mine / None) - Default: Mine

8. User Interface (UI) / User Experience (UX)

Key Pages: Dashboard, Tasks List, Occurrences List, User Profile, Household Management.

Tasks List Page: Compact rows. Visible: Name, Category, Status (Active/Paused). Default: Active/Paused tasks. Filter for Soft-deleted. Quick Actions: View, Edit, Pause/Unpause, Delete, View Occurrences. Search: Name, Description. Filter: Status, Category. Sort: Name, Category, Status.

Occurrences List Page: Compact rows. Visible: Task Name, Category, Assignee(s), Due Date, Status. Visual indicator for Overdue. Default: 'Created'/'Assigned' status. Filter for Completed, Skipped. Quick Actions: View, Edit, Respond, Execute, Skip. Search: Task Name, Description. Filter: Due Date Range, Status, Category, Assignee. Sort: Due Date, Task Name, Category, Assignee.

Detail Views: Dedicated pages for Task Definition and Task Occurrence details (including Timeline).

Forms: For creating/editing Tasks, editing Occurrences, profile, notifications, etc.

9. Data Handling & Error Handling

Data Persistence: CockroachDB.

API: Nuxt server routes.

State Management: Pinia.

Error Handling: (Requires detailed definition during development)

Use standard HTTP status codes and meaningful API error messages.

Display user-friendly errors in the frontend; handle loading states.

Implement backend logging, input validation, transaction handling.

Log scheduler errors, consider retry logic/alerting.

10. Future Considerations (Post-MVP)

File attachments

Rich text support

Granular intra-household permissions

Enhanced dashboard/widgets

Calendar View

Task dependencies

Mobile App (iOS/Android) & Push Notifications