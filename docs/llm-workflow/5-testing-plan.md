# Manual Testing Checklist

This document outlines the manual testing steps to be performed after the completion of each development phase, as defined in the `3-blueprint.md` document. It assumes the tester has access to and understanding of the project's idea, functional specification, and blueprint.

---

## Phase 1: Foundation

- [x] **1.1: Project Execution:** Attempt to start the development server (`npm run dev`). Expected: Server starts successfully without crashing, basic app accessible.
- [x] **1.2: Database Connection (Implicit):** Prisma client generated successfully during setup (`npx prisma generate`). (Connection verified implicitly in later phases).
- [x] **1.3: Database Schema Verification:** Connect to DB, check `_prisma_migrations` table for `20250406012546_init` migration with `finished_at` timestamp.
- [x] **1.4: Table Verification:** Verify tables (`users`, `households`, `categories`, `task_definitions`, `task_occurrences`, `occurrence_history_logs`) exist with columns matching `prisma/schema.prisma`.

---

## Phase 2: Authentication & Households

- [x] **2.1: Signup Success:** Navigate to Signup, attempt signup with valid, unique credentials. Expected: Signup succeeds, user redirected, user record exists in DB with hashed password.
- [x] **2.2: Login Success:** Attempt login with credentials from successful signup (2.1). Expected: Login succeeds, user redirected to protected area, session established.
- [x] **2.3: Authentication Middleware (Logged Out):** Attempt to access a protected page (e.g., `/tasks`) before logging in. Expected: Redirected to Login page.
- [x] **2.4: Authentication Middleware (Logged In):** Log in successfully, attempt to access the same protected page again. Expected: Access granted.
- [x] **2.5: Household Creation:** After signup/login (if no household), navigate to setup, choose "Create Household", enter name. Expected: Household created, user's `householdId` updated, user marked as admin, redirected to main app.

---

## Phase 3: Core Task Management

- [x] **3.1: Category Seeding:** Check `Category` table in DB. Expected: Predefined categories ("Cleaning", "Maintenance", "Shopping") exist.
- [ ] **3.2: Task Creation Success:** Navigate to Task List, click "Create Task", fill form (Name, Category, Desc, Instr), submit. Expected: New task appears in list, `TaskDefinition` record created linked to household, `metaStatus`='Active'.
- [ ] **3.3: Task Creation Failure (Invalid Data):** Attempt creation with invalid/missing data. Expected: Form shows validation errors, task not created.
- [ ] **3.4: Task List View:** Navigate to Task List page. Expected: All tasks for the household are displayed (Name, Category, Status).
- [ ] **3.5: Task Detail View:** Click a task in the list. Expected: Navigated to Task View page, all details displayed correctly.
- [ ] **3.6: Task Editing Success:** Navigate to Task View, click "Edit", modify basic fields, submit. Expected: Task View updates, DB record updated, changes reflected in Task List.
- [ ] **3.7: Occurrence Empty State:** Navigate to Task View page. Expected: "No occurrences yet" message displayed in occurrence section. API `GET /api/tasks/:id/occurrences` returns empty array.

---

## Phase 4: Occurrence Interaction

- [ ] **4.1: Manual Occurrence Creation (Temporary):** Use temp API/mechanism to create test occurrence (linked to TaskDef, assigned to user, due date). Expected: `TaskOccurrence` record created, status 'Assigned'.
- [ ] **4.2: Occurrence List View:** Navigate to Occurrences List / Task View. Expected: Manually created occurrence displayed (Task Name, Assignee, Due Date).
- [ ] **4.3: Execute Occurrence:** Find test occurrence, click "Execute". Expected: Status changes to 'Completed' in UI/DB, `completedAt` set, history log entry created.
- [ ] **4.4: Skip Occurrence:** Create test occurrence, find it, click "Skip", enter reason, submit. Expected: Status changes to 'Skipped' in UI/DB, `skippedAt` set, reason stored (likely in `OccurrenceHistoryLog`).
- [ ] **4.5: Add Comment:** Navigate to Occurrence View, find "Add Comment", enter comment, submit. Expected: Comment appears in Timeline/History, `OccurrenceHistoryLog` record created (type 'Comment').
- [ ] **4.6: View History:** Navigate to Occurrence View for executed/skipped/commented item. Expected: All events (creation, status changes, comments) displayed chronologically with details, matching `OccurrenceHistoryLog`.
- [ ] **4.7: Edit Occurrence:** Navigate to Occurrence View/List for 'Assigned' item, click "Edit", modify `dueDate`/assignees, submit. Expected: Details update in UI/DB, history log entry might be created.

---

## Phase 5: Advanced Task Logic

- [ ] **5.1: Pause Task:** Create task w/ future occurrence, navigate to Task List/View, click "Pause". Expected: Task `metaStatus`='Paused', future 'Assigned' occurrences marked 'Deleted' (or inactive).
- [ ] **5.2: Unpause Task:** Find paused task, click "Unpause". Expected: Task `metaStatus`='Active', scheduler should eventually generate next occurrence.
- [ ] **5.3: Delete Task:** Find active task, click "Delete". Expected: Task `metaStatus`='Soft-deleted', task hidden/filterable, future 'Assigned' occurrences marked 'Deleted'.
- [ ] **5.4: 'Once' Schedule:** Create task with schedule='Once', specific due date. Expected: Single `TaskOccurrence` generated immediately with status 'Assigned'. (Replaces 4.1).
- [ ] **5.5: Fixed Interval Recurrence:** Create task "Every 3 days". Expected: Initial occurrence generated. Scheduler generates subsequent occurrences with correct interval.
- [ ] **5.6: Specific Day of Week/Month Recurrence:** Create tasks "Every Monday" / "On the 15th". Expected: Initial occurrence for next matching date. Scheduler generates subsequent occurrences on correct days/dates.
- [ ] **5.7: End Condition (N times):** Create recurring task ending after 3 occurrences. Execute/skip occurrences. Expected: Scheduler stops after 3rd occurrence created/completed.
- [ ] **5.8: End Condition (Until Date):** Create recurring task ending by specific date. Expected: Scheduler stops generating occurrences with due dates after end date.
- [ ] **5.9: Variable Interval Recurrence:** Create task "7 days after completion". Execute initial occurrence. Expected: New occurrence generated with due date based on `completedAt` + interval. Test skip as well.
- [ ] **5.10: Scheduler Integration:** Verify temporary manual occurrence creation (4.1) is removed. Task creation with any schedule generates first occurrence via scheduler.

---

## Phase 6: Notifications

- [ ] **6.1: Reminder Notifications:** Create task/occurrence with `reminderConfig` (e.g., 1 day before), due tomorrow. Wait for scheduler. Expected: Email reminder sent/queued to assigned user(s) with correct content.
- [ ] **6.2: Notification Preferences UI:** Navigate to Profile/Settings. Expected: Options to enable/disable different notification types are present.
- [ ] **6.3: Update Notification Preferences:** Change preferences (e.g., disable task completion), save. Expected: Changes saved successfully (check API call/DB).
- [ ] **6.4: Event Notification (Task Assignment):** Enable "Task Assigned" notification. Have another user assign task to current user. Expected: Current user receives assignment email.
- [ ] **6.5: Event Notification (Preference Respected - Disabled):** Disable "Task Completed" notification. Execute a task. Expected: User does _not_ receive completion email.
- [ ] **6.6: Event Notification (Preference Respected - Enabled):** Re-enable "Task Completed". Execute another task. Expected: User _does_ receive completion email.
- [ ] **6.7: Comment Notification:** Enable comment notifications. Have another user comment on assigned occurrence. Expected: Current user receives comment notification email.

---

## Phase 7: UI Enhancement

- [ ] **7.1: Unified Occurrences List:** Navigate to main Occurrences List page. Expected: Occurrences from multiple different tasks displayed together.
- [ ] **7.2: Task List Filtering:** Navigate to Task List, use filters (Category, Status). Expected: Only matching tasks displayed.
- [ ] **7.3: Task List Searching:** Use search bar (search task name). Expected: Only matching tasks displayed.
- [ ] **7.4: Task List Sorting:** Use sort controls (Name A-Z/Z-A). Expected: List reorders correctly. Combine filter/sort.
- [ ] **7.5: Occurrence List Filtering:** Navigate to unified Occurrences List, use filters (Due Date, Status, Assignee). Expected: List updates correctly.
- [ ] **7.6: Occurrence List Searching:** Use search bar (search Task Name). Expected: List updates correctly.
- [ ] **7.7: Occurrence List Sorting:** Use sort controls. Expected: List updates correctly. Combine filter/search/sort.
- [ ] **7.8: Household Management - Invites:** Navigate to Household Mgmt, use "Invite User" form. Expected: Invite generated (check DB/email).
- [ ] **7.9: Household Management - User List & Actions:** Navigate to Household Mgmt. Expected: Member list displayed. If admin, test Remove User and Toggle Admin Status. Expected: Actions succeed, DB updated.
- [ ] **7.10: Household Management - Custom Categories:** Navigate to Household Mgmt / Categories. Test Create, Edit, Delete custom category. Expected: Actions succeed, category available/removed in task forms.
- [ ] **7.11: Dashboard:** Navigate to Dashboard page. Expected: Basic stats (overdue, upcoming) displayed. Upcoming occurrences list shown. Data appears accurate.

---

## Phase 8: Refinement

- [ ] **8.1: API Error Handling:** Attempt actions causing server errors (bad permissions, malformed requests). Expected: Graceful handling, user-facing messages, no crashes, check console/logs for details.
- [ ] **8.2: Frontend Validation/Error Handling:** Interact with forms using invalid data. Expected: Clear validation messages near fields _before_ submit. Error messages shown on API failure _after_ submit.
- [ ] **8.3: UI Polish & Responsiveness:** Use app on different screen sizes (desktop, tablet, mobile simulation). Expected: Layout adjusts, usable elements, no visual glitches, consistent style, smooth transitions.
- [ ] **8.4: Regression Testing:** Re-test key functionality from _all_ previous phases (signup, login, task create, occurrence execute, basic recurrence, filtering). Expected: All features still function correctly.

---
