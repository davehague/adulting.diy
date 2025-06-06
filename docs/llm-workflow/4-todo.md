# Adulting.DIY - Project TODO Checklist

This checklist outlines the steps for building the Adulting.DIY application based on the defined specification and plan.

## Phase 1: Foundation

- [x] **1.1: Project Setup:** Initialize Nuxt 3 project (TypeScript, Pinia, Tailwind CSS).
- [x] **1.2: Define Core TypeScript Interfaces:** Create interfaces for `User`, `Household`, `Category`, `TaskDefinition`, `TaskOccurrence`, `OccurrenceHistoryLog`.
- [x] **1.3: Setup Database Connection:** Integrate Prisma, configure `.env` for CockroachDB.
- [x] **1.4: Define Initial Database Schema & Migration:** Translate interfaces to Prisma schema, define relations/enums/indices, create/apply initial migration (`init`), generate Prisma client.

## Phase 2: Authentication & Households

- [x] **2.1: Implement User Signup API Route:** `POST /api/user/register` (Implicit signup via Google Sign-In flow).
- [x] **2.2: Implement User Login API Route:** (Login handled via Google Sign-In flow, uses `/api/user/profile` for lookup).
- [x] **2.3: Implement Auth Middleware & Handling:** Nuxt server middleware for API protection, client middleware for page protection.
- [x] **2.4: Create Basic Login & Signup Vue Pages/Components:** `pages/login.vue` (Handles both via Google Sign-In).
- [x] **2.5: Setup Pinia Auth Store & Connect UI:** Create `stores/auth.ts`, connect `login.vue` page.
- [x] **2.6: Implement Household Creation API Route:** `POST /api/household/create` (validate user state, create household, link user as admin).
- [x] **2.7: Implement Household Joining API Route:** `POST /api/household/join` (validate user state, find household by code, link user).
- [x] **2.8: Implement Invite Code Generation Field:** Ensure `inviteCode` field in `Household` schema is unique.
- [x] **2.9: Create Initial Household Setup UI & Connect:** Create `pages/setup-household.vue`, add create/join forms, connect to APIs (2.6, 2.7), update store/navigate on success.

## Phase 3: Core Task Management

- [x] **3.1: Implement Predefined Category Seeding:** Create/run script to add predefined categories to DB idempotently.
- [x] **3.2: Implement Task Definition Create API:** `POST /api/tasks` (auth, validation, create TaskDefinition linked to household, default status 'Active').
- [x] **3.3: Implement Task Definition List API:** `GET /api/tasks` (auth, fetch tasks for household, basic fields, include category name, filter out soft-deleted).
- [x] **3.4: Create Pinia Task Store:** `stores/tasks.ts` (state: tasks, loading, error; actions: fetchTasks, createTask).
- [x] **3.5: Create Vue Component: TaskCreateForm.vue:** Form fields (name, categoryId, description, instructions), emits.
- [x] **3.5.1: Create Categories List API:** `GET /api/categories` (auth, fetch predefined + household custom categories).
- [x] **3.5.2: Populate Category Dropdown:** Update `TaskCreateForm.vue` to fetch categories (3.5.1) and populate dropdown.
- [x] **3.6: Create Vue Page: TasksListPage.vue:** Fetch tasks via store, display in compact rows, add "Create Task" button (opens form).
- [x] **3.7: Wire up TaskCreateForm:** Connect form submission to `createTask` store action, handle loading/errors, refresh list.
- [x] **3.8: Implement Task Definition View API:** `GET /api/tasks/:id` (auth, fetch specific task by ID, verify household ownership, include category).
- [x] **3.9: Create Vue Page: TaskViewPage.vue:** Dynamic route `pages/tasks/[id].vue`, fetch task details, display info, add placeholders for occurrences/actions. Link from Task List.
- [x] **3.10: Implement Task Definition Update API:** `PUT /api/tasks/:id` (auth, validation, verify ownership, update task).
- [x] **3.11: Create Vue Component: TaskEditForm.vue & Connect:** Create form similar to create form, accept task prop, pre-populate. Add 'Edit' button on Task View, connect form submission to `updateTask` store action calling API (3.10). Refresh data on success.
- [x] **3.12: Implement Basic Occurrence List API (for Task View):** `GET /api/tasks/:id/occurrences` (auth, verify parent task ownership, fetch related occurrences with assignees - initially empty).
- [x] **3.13: Display Empty State for Occurrences:** Update `TaskViewPage.vue` to call API (3.12) and display "No occurrences" message.

## Phase 4: Occurrence Interaction - Manual/Basic

- [x] **4.1: _Temporary Step:_ Add API/Mechanism to manually create a basic Task Occurrence:** (For testing UI - dueDate, status='Assigned', assigneeIds=currentUser).
- [x] **4.2: Update Occurrence List API (3.12):** Ensure it returns manually created occurrences.
- [x] **4.3: Create Vue Page: OccurrencesListPage.vue:** (Initial version: Filtered by task) Fetch occurrences (API 3.12), display in compact rows (Task Name, Category, Assignee, Due Date).
- [x] **4.4: Implement Occurrence Execute API:** `POST /api/occurrences/:id/execute` (auth, update status='Completed', set `completedAt`).
- [x] **4.5: Implement Occurrence Skip API:** `POST /api/occurrences/:id/skip` (auth, require `reason`, update status='Skipped', set `skippedAt`).
- [x] **4.6: Add Execute/Skip Buttons & Connect:** Add buttons to `OccurrencesListPage.vue`, wire to APIs via Task Store actions. Add modal for skip reason.
- [ ] **4.7: Implement Occurrence Comment API:** `POST /api/occurrences/:id/comments` (auth, create `OccurrenceHistoryLog` entry).
- [ ] **4.8: Implement Occurrence History Fetch API:** `GET /api/occurrences/:id/history` (auth, fetch history logs for occurrence).
- [ ] **4.9: Create Vue Component: OccurrenceTimeline.vue:** Fetch history (API 4.8), display comments/status changes.
- [ ] **4.10: Create Vue Page: OccurrenceViewPage.vue:** Dynamic route `pages/occurrences/[id].vue`. Display occurrence details & `OccurrenceTimeline.vue`. Link from Occurrences List.
- [ ] **4.11: Add Comment Button/Form & Connect:** Add UI on Occurrence View/List, wire to Comment API (4.7).
- [ ] **4.12: Implement Occurrence Edit API:** `PUT /api/occurrences/:id` (auth, allow changing `dueDate`, `assigneeIds`, log changes).
- [ ] **4.13: Add Edit Button/Form & Connect:** Add 'Edit' button on Occurrence row/view, create form/modal, wire to Edit API (4.12).

## Phase 5: Advanced Task Logic

- [x] **5.1: Implement Task Pause API:** `POST /api/tasks/:id/pause` (auth, set Task `metaStatus`='Paused', update future Occurrences `status`='Deleted').
- [x] **5.2: Implement Task Unpause API:** `POST /api/tasks/:id/unpause` (auth, set Task `metaStatus`='Active').
- [x] **5.3: Implement Task Delete API:** `DELETE /api/tasks/:id` (auth, set Task `metaStatus`='Soft-deleted', update future Occurrences `status`='Deleted').
- [x] **5.4: Add Task Action Buttons & Connect:** Add Pause/Unpause/Delete buttons on Task List/View, wire to APIs (5.1, 5.2, 5.3). Update UI state.
- [x] **5.5: Update Task APIs/Forms for Schedule:** Update Create/Edit APIs (3.2, 3.10) & Forms (3.5, 3.11) to handle `scheduleConfig` input (basic structure, 'Once' type).
- [ ] **5.6: Implement Basic Scheduler Logic:** Create background task/job. Handle 'Once' tasks on creation.
- [ ] **5.7: Implement Fixed Interval Recurrence:** Update Scheduler/APIs.
- [ ] **5.8: Implement Specific Days of Week Recurrence:** Update Scheduler/APIs.
- [ ] **5.9: Implement Specific Day of Month Recurrence:** Update Scheduler/APIs.
- [ ] **5.10: Implement Specific Weekday of Month Recurrence:** Update Scheduler/APIs.
- [ ] **5.11: Implement End Conditions:** Update Scheduler/APIs (N times, Until Date). Check on Execute/Skip.
- [ ] **5.12: Implement Variable Interval Recurrence:** Update Scheduler/APIs (trigger post-Execute/Skip, use correct dates, handle Unpause).
- [x] **5.13: Update Task Forms for Recurrence UI:** Enhance Task Create/Edit forms to support defining all recurrence options.
- [ ] **5.14: Remove Temporary Occurrence Creation:** Remove Step 4.1. Ensure scheduler handles initial generation.

## Phase 6: Notifications

- [ ] **6.1: Integrate Email Service Provider:** Add library/utility for sending emails via Nuxt server.
- [ ] **6.2: Implement Task Reminder Logic:** Update Scheduler to check `reminderConfig`, queue/send emails.
- [ ] **6.3: Update Task APIs/Forms for Reminders:** Update Create/Edit APIs (3.2, 3.10) & Forms (3.5, 3.11) to handle `reminderConfig` input.
- [ ] **6.4: Implement User Notification Preferences API:** `PUT /api/profile/notifications` (auth, update user's preferences JSON).
- [ ] **6.5: Create User Profile Page & Preferences UI:** `pages/profile.vue`. Add form to manage notification toggles, wire to API (6.4). Allow basic profile edits (name?).
- [ ] **6.6: Integrate Event Notification Triggers:** Modify relevant APIs (Task Create/Pause/Delete, Occurrence Assign/Execute/Skip/Comment) to check user preferences (API 6.4) and send emails (Service 6.1). Handle "Mine" logic & single notification for mass deletions.

## Phase 7: UI Enhancement

- [ ] **7.1: Implement Full Occurrences List Page:** Update `OccurrencesListPage.vue` (4.3) to show _all_ relevant occurrences (not task-specific). Create `GET /api/occurrences` endpoint.
- [ ] **7.2: Implement Tasks List Filtering UI & Logic:** Add controls for Status, Category. Update `GET /api/tasks` (3.3) to accept filter params.
- [ ] **7.3: Implement Tasks List Searching UI & Logic:** Add search input. Update `GET /api/tasks` to search Name, Description.
- [ ] **7.4: Implement Tasks List Sorting UI & Logic:** Add sort controls. Update `GET /api/tasks` to accept sort params.
- [ ] **7.5: Implement Occurrences List Filtering UI & Logic:** Add controls (Due Date, Status, Category, Assignee). Update `GET /api/occurrences` (7.1) to accept filter params.
- [ ] **7.6: Implement Occurrences List Searching UI & Logic:** Add search input. Update `GET /api/occurrences` to search Task Name, Description.
- [ ] **7.7: Implement Occurrences List Sorting UI & Logic:** Add sort controls. Update `GET /api/occurrences` to accept sort params.
- [ ] **7.8: Implement Household Management Page UI:** `pages/household.vue` (Admin only). Add Invite form, User list (w/ Remove/Admin buttons), Custom Category CRUD UI.
- [ ] **7.9: Implement Household Management APIs:** `GET /users`, `POST /invites`, `DELETE /users/:id`, `PUT /users/:id/admin`, `GET/POST/PUT/DELETE /categories`. Wire up UI (7.8).
- [ ] **7.10: Implement Dashboard Page UI:** `pages/dashboard.vue`. Add basic stats, upcoming tasks list. Create necessary API endpoints (`GET /api/dashboard/stats`, `GET /api/dashboard/upcoming`).

## Phase 8: Refinement

- [ ] **8.1: Enhance API Error Handling:** Improve validation, specific error codes, logging.
- [ ] **8.2: Enhance Frontend Error Handling:** User feedback messages, form validation clarity.
- [ ] **8.3: Code Cleanup & Refactoring:** Improve comments, types, consistency.
- [ ] **8.4: Basic End-to-End Testing:** Manual testing of all core workflows. (Consider adding automated tests).
- [ ] **8.5: UI Polish:** Review styling, transitions, responsiveness across pages.
