# Manual Testing Plan

This document outlines the manual testing steps to be performed after the completion of each development phase, as defined in the `3-blueprint.md` document. It assumes the tester has access to and understanding of the project's idea, functional specification, and blueprint.

---

## Phase 1: Foundation

**Goal:** Verify the basic project structure and database setup.

**Testable Functionality:**

- Project runs without critical errors.
- Database connection is established.
- Initial database schema matches the defined models.

**Testing Steps:**

1.  **Project Execution:**
    - Attempt to start the development server (e.g., `npm run dev`).
    - **Expected:** The server starts successfully without crashing, and the basic application structure is accessible in a browser (likely a default Nuxt page).
2.  **Database Connection (Indirect):**
    - While no direct UI exists yet, successful completion of subsequent phases (like signup) will implicitly test the connection. For now, confirm the Prisma client generation (`npx prisma generate`) completed without errors during setup.
    - **Expected:** Prisma client generated successfully.
3.  **Database Schema Verification:**
    - Connect to the CockroachDB instance using a database client tool.
    - Inspect the database schema (`adulting` or the configured name).
    - Query the `_prisma_migrations` table.
    - **Expected:** The initial migration record (e.g., `20250406012546_init`) exists in the `_prisma_migrations` table and has a non-null `finished_at` timestamp, indicating it applied successfully. Tables corresponding to the models (`users`, `households`, `categories`, `task_definitions`, `task_occurrences`, `occurrence_history_logs`) should exist with columns matching the `prisma/schema.prisma` definition. (Note: The `assigneeIds` relationship on `TaskOccurrence` is implemented as a `String[]` array column, not a separate relation table).
    - **Current Status (as of 2025-04-06): PASSED.** The migration issue was resolved by manually editing the migration SQL and reapplying. The database schema is now up-to-date.

---

## Phase 2: Authentication & Households

**Goal:** Verify user registration, login, and the initial household setup flow.

**Testable Functionality:**

- User signup creates a new user account.
- User login authenticates existing users.
- Protected routes/pages require login.
- Users can create a new household.
- Users can join an existing household (manual DB check for invite code needed initially).
- Users are associated with a household after setup.

**Testing Steps:**

1.  **Signup:**
    - Navigate to the Signup page.
    - Attempt signup with valid, unique email, name, and password.
    - **Expected:** Signup succeeds, user is likely redirected (e.g., to login or household setup). User record exists in the `User` table with a hashed password.
    - Attempt signup with an already existing email.
    - **Expected:** Signup fails with an appropriate error message (e.g., "Email already taken").
    - Attempt signup with invalid data (e.g., missing fields, invalid email format).
    - **Expected:** Signup fails with appropriate validation error messages.
2.  **Login:**
    - Navigate to the Login page.
    - Attempt login with incorrect credentials (wrong email or password).
    - **Expected:** Login fails with an "Invalid credentials" or similar error.
    - Attempt login with the credentials created during successful signup.
    - **Expected:** Login succeeds. User is redirected to a protected area (e.g., household setup or dashboard if already set up). Session/cookie is established.
3.  **Authentication Middleware:**
    - Attempt to access a protected page/route (e.g., `/tasks` if it exists, or `/household`) _before_ logging in.
    - **Expected:** User is redirected to the Login page.
    - Log in successfully.
    - Attempt to access the same protected page again.
    - **Expected:** User can access the page.
4.  **Household Creation:**
    - After signup/login (if the user has no household), navigate to the household setup flow.
    - Choose the "Create Household" option.
    - Enter a valid household name.
    - **Expected:** Household is created in the `Household` table. The user's `householdId` in the `User` table is updated to link to the new household. The user is marked as an admin for this household (verify `isAdmin` flag or relation). User is redirected to the main application area (e.g., dashboard or task list).
5.  **Household Joining (Manual Invite Code):**
    - _Setup:_ Manually add an invite code to an existing household record in the database. Create a second user account.
    - Log in as the second user.
    - Navigate to the household setup flow.
    - Choose the "Join Household" option.
    - Enter the manually created invite code.
    - **Expected:** The second user's `householdId` is updated to link to the existing household. User is redirected to the main application area.

---

## Phase 3: Core Task Management

**Goal:** Verify the creation, viewing, and basic editing of Task Definitions.

**Testable Functionality:**

- Predefined categories exist.
- Users can create new Task Definitions.
- Users can view a list of Task Definitions within their household.
- Users can view the details of a specific Task Definition.
- Users can edit the basic fields of a Task Definition.
- An empty state is shown for Task Occurrences.

**Testing Steps:**

1.  **Category Seeding:**
    - Check the `Category` table in the database.
    - **Expected:** Predefined categories (e.g., "Cleaning", "Maintenance", "Shopping") exist.
2.  **Task Creation:**
    - Navigate to the Task List page.
    - Click the "Create Task" button.
    - Fill in the Task Create form (Name, Category, Description, Instructions).
    - Submit the form.
    - **Expected:** The new task appears in the Task List. A corresponding record exists in the `TaskDefinition` table, linked to the user's `householdId`. Default `metaStatus` should be 'Active'.
    - Attempt creation with invalid/missing data.
    - **Expected:** Form shows validation errors, task is not created.
3.  **Task List View:**
    - Navigate to the Task List page.
    - **Expected:** All tasks created for the current user's household are displayed in a list format (showing at least Name, Category, Status).
4.  **Task Detail View:**
    - Click on a task in the Task List.
    - **Expected:** User is navigated to the Task View page. All details entered during creation (Name, Category, Description, Instructions) are displayed correctly.
5.  **Task Editing:**
    - Navigate to the Task View page for an existing task.
    - Click the "Edit" button.
    - Modify basic fields (e.g., Name, Description).
    - Submit the edit form.
    - **Expected:** The Task View page updates with the new details. The corresponding `TaskDefinition` record in the database is updated.
    - Verify the changes are also reflected in the Task List page.
6.  **Occurrence Empty State:**
    - Navigate to the Task View page for any task.
    - Check the section for Task Occurrences.
    - **Expected:** An empty state message is displayed (e.g., "No occurrences yet for this task"). The API call (`GET /api/tasks/:id/occurrences`) should return an empty array.

---

## Phase 4: Occurrence Interaction

**Goal:** Verify manual occurrence creation (temporary), execution, skipping, commenting, and editing.

**Testable Functionality:**

- (Temporary) Manual creation of a basic Task Occurrence.
- Occurrences are listed.
- Users can mark an occurrence as "Executed".
- Users can mark an occurrence as "Skipped" with a reason.
- Users can add comments to an occurrence.
- Occurrence history (status changes, comments) is viewable.
- Users can edit occurrence details (due date, assignees).

**Testing Steps:**

1.  **Manual Occurrence Creation (Temporary):**
    - Use the temporary API endpoint/mechanism to create a test occurrence linked to an existing Task Definition. Assign it to the current user, set a due date.
    - **Expected:** A record is created in the `TaskOccurrence` table linked to the correct `TaskDefinition` and `User` (assignee). Status should be 'Assigned'.
2.  **Occurrence List View:**
    - Navigate to the Occurrences List page (or the Task View page where occurrences are listed).
    - **Expected:** The manually created occurrence is displayed, showing relevant details (Task Name, Assignee, Due Date).
3.  **Execute Occurrence:**
    - Find the test occurrence in the list.
    - Click the "Execute" button.
    - **Expected:** The occurrence's status changes to 'Completed' in the UI and in the `TaskOccurrence` table. `completedAt` timestamp is set. An entry might appear in the history log.
4.  **Skip Occurrence:**
    - Create another test occurrence.
    - Find it in the list.
    - Click the "Skip" button.
    - Enter a reason in the prompted modal/form.
    - Submit.
    - **Expected:** The occurrence's status changes to 'Skipped' in the UI and in the `TaskOccurrence` table. `skippedAt` timestamp is set. The skip reason should be stored (likely in `OccurrenceHistoryLog`).
5.  **Add Comment:**
    - Navigate to the Occurrence View page for a test occurrence.
    - Find the "Add Comment" form/button.
    - Enter a comment and submit.
    - **Expected:** The comment appears in the Occurrence Timeline/History section. A corresponding record exists in the `OccurrenceHistoryLog` table with type 'Comment'.
6.  **View History:**
    - Navigate to the Occurrence View page for an occurrence that has been executed, skipped, or commented on.
    - Examine the Occurrence Timeline/History section.
    - **Expected:** All relevant events (creation, status changes like Executed/Skipped, comments) are displayed chronologically with timestamps and associated users/details (like skip reason). Data should match the `OccurrenceHistoryLog` table.
7.  **Edit Occurrence:**
    - Navigate to the Occurrence View page or list for an 'Assigned' occurrence.
    - Click the "Edit" button.
    - Modify the `dueDate` and/or change/add assignees.
    - Submit the changes.
    - **Expected:** The occurrence details update in the UI and in the `TaskOccurrence` table. An entry might be added to the `OccurrenceHistoryLog` indicating the change.

---

## Phase 5: Advanced Task Logic

**Goal:** Verify task pausing/unpausing/deletion, and the core recurrence scheduling logic.

**Testable Functionality:**

- Tasks can be paused, preventing future occurrences (manual check).
- Paused tasks can be unpaused.
- Tasks can be soft-deleted.
- Basic 'Once' schedule generates an occurrence on task creation.
- Fixed Interval recurrence generates occurrences correctly.
- Specific Day of Week/Month recurrence generates occurrences correctly.
- End conditions (N times, Until Date) stop occurrence generation.
- Variable Interval recurrence generates occurrences after completion/skip.
- Scheduler correctly handles generating initial occurrences (replaces manual step).

**Testing Steps:**

_Note: Testing recurrence requires observing the scheduler's behavior over time or triggering it manually if possible. Verification often involves checking the `TaskOccurrence` table directly._

1.  **Pause Task:**
    - Create a task with a future occurrence (manually or via 'Once' schedule).
    - Navigate to the Task List/View page.
    - Click the "Pause" button for the task.
    - **Expected:** Task `metaStatus` changes to 'Paused' in the database and UI. Any _future_ 'Assigned' occurrences for this task should have their status changed to 'Deleted' (or similar inactive state) in the `TaskOccurrence` table.
2.  **Unpause Task:**
    - Find the paused task.
    - Click the "Unpause" button.
    - **Expected:** Task `metaStatus` changes back to 'Active'. The scheduler should eventually generate the _next_ appropriate occurrence based on its schedule (this might not be immediate).
3.  **Delete Task:**
    - Find an active task.
    - Click the "Delete" button.
    - **Expected:** Task `metaStatus` changes to 'Soft-deleted' in the database. The task might disappear from the default Task List view (or be filterable). Any _future_ 'Assigned' occurrences should be marked as 'Deleted'.
4.  **'Once' Schedule:**
    - Create a new task, explicitly setting the schedule type to 'Once' with a specific due date.
    - **Expected:** Immediately after task creation, a single `TaskOccurrence` record should be generated with the specified due date and status 'Assigned'. Verify this in the database and UI. (This replaces the temporary manual creation from Phase 4).
5.  **Fixed Interval Recurrence:**
    - Create a task with a fixed interval schedule (e.g., "Every 3 days", starting today).
    - **Expected:** An initial occurrence is generated. After triggering/waiting for the scheduler, subsequent occurrences should appear in the `TaskOccurrence` table with due dates incremented by the specified interval.
6.  **Specific Day of Week/Month Recurrence:**
    - Create tasks with schedules like "Every Monday" or "On the 15th of the month".
    - **Expected:** Initial occurrence generated for the _next_ matching date. Subsequent occurrences generated by the scheduler should fall on the correct days/dates.
7.  **End Conditions:**
    - Create a recurring task with an "End after N occurrences" condition (e.g., end after 3). Execute/skip occurrences.
    - **Expected:** The scheduler stops generating new occurrences after the Nth one is created/completed.
    - Create a recurring task with an "End by Date" condition.
    - **Expected:** The scheduler stops generating occurrences with due dates after the specified end date.
8.  **Variable Interval Recurrence:**
    - Create a task with a variable interval (e.g., "7 days after completion").
    - Execute the initial occurrence.
    - **Expected:** A new occurrence should be generated by the scheduler with a due date calculated based on the `completedAt` date of the previous one + the interval. Test with skipping as well.
9.  **Scheduler Integration:**
    - Verify that the temporary manual occurrence creation step (4.1) is removed and no longer needed. Task creation with any schedule type should now correctly generate the first occurrence via the scheduler logic.

---

## Phase 6: Notifications

**Goal:** Verify that users receive email notifications based on task events and their preferences.

**Testable Functionality:**

- Task reminder emails are sent before occurrence due dates.
- Users can configure their notification preferences.
- Event-based notifications (task created, assigned, completed, commented, etc.) are sent according to preferences.

**Testing Steps:**

_Note: Requires configuring an email service and potentially a way to intercept/view sent emails during testing._

1.  **Reminder Notifications:**
    - Create a task/occurrence with a `reminderConfig` set (e.g., remind 1 day before due date). Set the due date for tomorrow.
    - Wait for the scheduler/reminder logic to run.
    - **Expected:** An email notification reminding the assigned user(s) about the upcoming task should be sent/queued. Verify email content for correctness (task name, due date).
2.  **Notification Preferences UI:**
    - Navigate to the User Profile / Settings page.
    - Locate the Notification Preferences section.
    - **Expected:** Options to enable/disable different types of notifications (reminders, task assigned, task completed, comments, etc.) are present.
3.  **Update Notification Preferences:**
    - Change some notification preferences (e.g., disable notifications for task completion). Save the preferences.
    - **Expected:** The changes are saved successfully (verify API call `PUT /api/profile/notifications` and potentially check user settings in the database).
4.  **Event-Based Notifications (Test Case: Task Assignment):**
    - Ensure the current user has notifications for "Task Assigned to Me" enabled.
    - Have another user (or admin) create a task/occurrence and assign it to the current user.
    - **Expected:** The current user receives an email notification about the new assignment.
5.  **Event-Based Notifications (Test Case: Preference Respected):**
    - Disable notifications for "Task Completed".
    - Execute an assigned task occurrence.
    - **Expected:** The user should _not_ receive an email notification about the task completion.
    - Re-enable the preference and execute another task.
    - **Expected:** The user _should_ receive the completion notification email.
6.  **Comment Notification:**
    - Ensure comment notifications are enabled.
    - Have another user comment on a task occurrence assigned to the current user.
    - **Expected:** The current user receives an email notification about the new comment, potentially including the comment text.

---

## Phase 7: UI Enhancement

**Goal:** Verify improvements to list views, filtering/sorting, household management, and the dashboard.

**Testable Functionality:**

- Unified Occurrences List page shows occurrences from all tasks.
- Filtering works correctly on Task and Occurrence lists.
- Searching works correctly on Task and Occurrence lists.
- Sorting works correctly on Task and Occurrence lists.
- Household management features (invites, user management, custom categories) work.
- Dashboard displays relevant information.

**Testing Steps:**

1.  **Unified Occurrences List:**
    - Navigate to the main Occurrences List page.
    - **Expected:** Occurrences from _multiple different tasks_ within the household are displayed together.
2.  **Task List Filtering/Searching/Sorting:**
    - Navigate to the Task List page.
    - Use filter controls (e.g., filter by Category 'Cleaning', Status 'Paused').
    - **Expected:** Only tasks matching the filter criteria are displayed.
    - Use the search bar (e.g., search for a specific word in a task name).
    - **Expected:** Only tasks matching the search term are displayed.
    - Use sorting controls (e.g., sort by Name A-Z, Name Z-A).
    - **Expected:** The list reorders according to the selected criteria. Combine filtering and sorting.
3.  **Occurrence List Filtering/Searching/Sorting:**
    - Navigate to the unified Occurrences List page.
    - Perform similar filtering (e.g., by Due Date range, Status 'Completed', Assignee), searching (e.g., by Task Name), and sorting tests as done for the Task List.
    - **Expected:** The list updates correctly based on the applied criteria.
4.  **Household Management - Invites:**
    - Navigate to the Household Management page.
    - Use the "Invite User" form, entering a valid email address.
    - **Expected:** An invite is generated (mechanism might vary - check `HouseholdInvites` table or similar). Potentially an email is sent to the invited user.
5.  **Household Management - User List:**
    - Navigate to the Household Management page.
    - **Expected:** A list of current household members is displayed.
    - If admin, attempt to remove a non-admin user.
    - **Expected:** User is removed from the household.
    - If admin, attempt to toggle admin status for another user.
    - **Expected:** User's admin status is updated.
6.  **Household Management - Custom Categories:**
    - Navigate to the Household Management page / Category section.
    - Create a new custom category.
    - **Expected:** The category appears in the list of custom categories and is available for selection when creating/editing tasks.
    - Edit the custom category name.
    - **Expected:** Name updates correctly.
    - Delete the custom category.
    - **Expected:** Category is removed (ensure handling if tasks are using it).
7.  **Dashboard:**
    - Navigate to the Dashboard page.
    - **Expected:** Basic statistics (e.g., number of overdue tasks, upcoming tasks) are displayed. A list of upcoming occurrences is shown. Data appears accurate based on current tasks/occurrences.

---

## Phase 8: Refinement

**Goal:** Verify overall application stability, error handling, and UI polish.

**Testable Functionality:**

- Graceful handling of API errors.
- Clear frontend validation and error messages.
- Consistent UI/UX, responsiveness.
- No major regressions from previous phases.

**Testing Steps:**

1.  **API Error Handling:**
    - Attempt actions that should cause server errors (e.g., try to access data without permission, send malformed requests using browser dev tools or API tools).
    - **Expected:** The application handles errors gracefully, showing appropriate user-facing messages (e.g., "An error occurred") rather than crashing. Check browser console/network tab for specific error codes (e.g., 401, 403, 400, 500). Server logs should contain detailed error information.
2.  **Frontend Validation/Error Handling:**
    - Interact with forms, intentionally entering invalid data (e.g., invalid dates, missing required fields).
    - **Expected:** Clear, specific validation messages are displayed next to the relevant fields _before_ submitting. Error messages are shown if API calls fail after submission.
3.  **UI Polish & Responsiveness:**
    - Use the application across different screen sizes (desktop, tablet, mobile - use browser dev tools for simulation).
    - **Expected:** Layout adjusts appropriately, elements remain usable, no major visual glitches. UI elements (buttons, forms, lists) are consistent in style and behavior. Transitions/animations are smooth.
4.  **Regression Testing:**
    - Re-test key functionality from _all_ previous phases (e.g., signup, login, task create, occurrence execute, basic recurrence, filtering).
    - **Expected:** All previously working features still function as expected.

---
