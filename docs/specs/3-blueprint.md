**High-Level Blueprint:**

1.  **Foundation:** Project Setup, Core Data Models, Database Schema.
2.  **Authentication & Households:** User Signup, Login, Household Creation/Joining.
3.  **Core Task Management:** Task Definition CRUD, Basic Occurrence Viewing.
4.  **Occurrence Interaction:** Executing, Skipping, Commenting, Editing Occurrences.
5.  **Advanced Task Logic:** Task Pause/Delete, Recurrence Scheduling (Fixed & Variable), End Conditions.
6.  **Notifications:** Task Reminders, Event-Based Notifications, User Preferences.
7.  **UI Enhancement:** List Filtering/Sorting, Dashboard Implementation.
8.  **Refinement:** Error Handling, Testing, Polish.

**Iterative Breakdown & Step-by-Step Plan:**

This plan breaks the project into manageable steps, focusing on building blocks that integrate progressively.

**(Phase 1: Foundation)**

* **Step 1.1:** Project Setup (Nuxt 3, TypeScript, Pinia, Tailwind CSS - assuming standard setup).
* **Step 1.2:** Define Core TypeScript Interfaces (`User`, `Household`, `Category`, `TaskDefinition`, `TaskOccurrence`, `OccurrenceHistoryLog` - basic structure based on spec).
* **Step 1.3:** Setup Database Connection (CockroachDB adapter/ORM like Prisma).
* **Step 1.4:** Define Initial Database Schema (SQL/Prisma Schema for models defined in 1.2). Create initial migration.

**(Phase 2: Authentication & Households)**

* **Step 2.1:** Implement User Signup API Route (`POST /api/auth/signup` - hash password, create user).
* **Step 2.2:** Implement User Login API Route (`POST /api/auth/login` - verify password, create session/token).
* **Step 2.3:** Implement Middleware/Auth Handling in Nuxt (protect routes, access user session).
* **Step 2.4:** Create Basic Login & Signup Vue Pages/Components.
* **Step 2.5:** Setup Pinia Auth Store (manage user state, login/logout actions). Connect UI to store/API.
* **Step 2.6:** Implement Household Creation API Route (`POST /api/households` - create household, link user, set as admin).
* **Step 2.7:** Implement Household Joining API Route (`POST /api/households/join` - use invite code, link user).
* **Step 2.8:** Implement Invite Code Generation (logic within Household Management API later, but need field in schema).
* **Step 2.9:** Create Initial Household Setup UI (Prompt user to create or join after signup if no household). Connect to APIs.

**(Phase 3: Core Task Management)**

* **Step 3.1:** Implement Predefined Category Seeding (Add predefined categories to DB).
* **Step 3.2:** Implement Task Definition Create API (`POST /api/tasks` - basic fields: name, categoryId, description, instructions). Link to user's household. Set default `metaStatus`.
* **Step 3.3:** Implement Task Definition List API (`GET /api/tasks` - fetch tasks for user's household, basic fields only).
* **Step 3.4:** Create Pinia Task Store (manage task state, fetch/create actions).
* **Step 3.5:** Create Vue Component: `TaskCreateForm.vue` (basic fields).
* **Step 3.6:** Create Vue Page: `TasksListPage.vue`. Fetch tasks using Pinia store, display in compact rows (Name, Category, Status - hardcode 'Active' for now). Add 'Create Task' button linking to form/modal.
* **Step 3.7:** Wire up `TaskCreateForm` to create API via Pinia store.
* **Step 3.8:** Implement Task Definition View API (`GET /api/tasks/:id`).
* **Step 3.9:** Create Vue Page: `TaskViewPage.vue` (display basic task details). Link from Task List.
* **Step 3.10:** Implement Task Definition Update API (`PUT /api/tasks/:id` - basic fields).
* **Step 3.11:** Create Vue Component: `TaskEditForm.vue` (pre-populate from Task View API). Wire up to update API via Pinia store. Add 'Edit' button on Task List/View.
* **Step 3.12:** Implement Basic Occurrence List API (`GET /api/tasks/:id/occurrences` - fetch related occurrences, basic fields - *Note: No occurrences exist yet*).
* **Step 3.13:** Display empty state for occurrences on `TaskViewPage.vue`.

**(Phase 4: Occurrence Interaction - Manual/Basic)**

* **Step 4.1:** *Temporary Step:* Add API/Mechanism to manually create a basic Task Occurrence linked to a Task (for testing UI - fields: dueDate, status='Assigned', assigneeIds=currentUser).
* **Step 4.2:** Update `GET /api/tasks/:id/occurrences` to return manually created occurrences.
* **Step 4.3:** Create Vue Page: `OccurrencesListPage.vue` (initially maybe just reachable via 'View Occurrences' on Task List). Fetch and display occurrences for a *specific task* in compact rows (Task Name, Category, Assignee, Due Date).
* **Step 4.4:** Implement Occurrence Execute API (`POST /api/occurrences/:id/execute`). Set status to 'Completed', record `completedAt`.
* **Step 4.5:** Implement Occurrence Skip API (`POST /api/occurrences/:id/skip`). Requires `reason` in payload. Set status to 'Skipped', record `skippedAt`.
* **Step 4.6:** Add 'Execute' and 'Skip' buttons to Occurrence rows on `OccurrencesListPage.vue`. Wire up to APIs via Task Store actions. Update UI optimistically or refetch. (Implement Skip reason modal).
* **Step 4.7:** Implement Occurrence Comment API (`POST /api/occurrences/:id/comments`). Creates `OccurrenceHistoryLog` entry.
* **Step 4.8:** Implement Occurrence History Fetch API (`GET /api/occurrences/:id/history`).
* **Step 4.9:** Create Vue Component: `OccurrenceTimeline.vue`. Fetch history, display comments and status changes (basic format).
* **Step 4.10:** Create Vue Page: `OccurrenceViewPage.vue`. Display occurrence details and `OccurrenceTimeline.vue`. Link from `OccurrencesListPage.vue`.
* **Step 4.11:** Add 'Comment' button/form on `OccurrenceViewPage.vue` or List Page. Wire up to Comment API.
* **Step 4.12:** Implement Occurrence Edit API (`PUT /api/occurrences/:id`). Allow changing `dueDate`, `assigneeIds`. Log changes to history.
* **Step 4.13:** Add 'Edit' button on Occurrence row/view. Create form/modal for editing. Wire up to Edit API.

**(Phase 5: Advanced Task Logic)**

* **Step 5.1:** Implement Task Pause API (`POST /api/tasks/:id/pause`). Set Task `metaStatus`='Paused'. Find future Occurrences and update `status`='Deleted' (log reason).
* **Step 5.2:** Implement Task Unpause API (`POST /api/tasks/:id/unpause`). Set Task `metaStatus`='Active'. *(Occurrence generation handled later)*.
* **Step 5.3:** Implement Task Delete API (`DELETE /api/tasks/:id`). Set Task `metaStatus`='Soft-deleted'. Find future Occurrences and update `status`='Deleted' (log reason).
* **Step 5.4:** Add Pause/Unpause/Delete buttons to `TasksListPage.vue` / `TaskViewPage.vue`. Wire up to APIs. Update Task List UI based on status.
* **Step 5.5:** Update Task Definition Create/Edit APIs & Forms to handle `scheduleConfig` (basic structure, 'Once' type initially).
* **Step 5.6:** Implement Basic Scheduler Logic (e.g., Nuxt server task, cron job): Find 'Active' Tasks due for Occurrence generation. Handle 'Once' tasks (generate on creation).
* **Step 5.7:** Update Scheduler/APIs to handle Fixed Interval recurrence.
* **Step 5.8:** Update Scheduler/APIs to handle Specific Days of Week recurrence.
* **Step 5.9:** Update Scheduler/APIs to handle Specific Day of Month recurrence.
* **Step 5.10:** Update Scheduler/APIs to handle Specific Weekday of Month recurrence.
* **Step 5.11:** Update Scheduler/APIs to handle End Conditions (N times, Until Date).
* **Step 5.12:** Update Scheduler/APIs to handle Variable Interval recurrence (triggered post-Execute/Skip, using `completedAt`/`skippedAt`). Use pause date on Unpause.
* **Step 5.13:** Update Task/Occurrence Create/Edit forms UI to support defining all recurrence options.
* **Step 5.14:** Remove temporary manual occurrence creation step (Step 4.1). Ensure scheduler correctly generates initial occurrence on Task creation.

**(Phase 6: Notifications)**

* **Step 6.1:** Integrate Email Service Provider (e.g., SendGrid, Mailgun) via Nuxt server route/utility.
* **Step 6.2:** Implement Task Reminder Logic: Update Scheduler to check `reminderConfig` and queue emails based on Occurrence `dueDate`.
* **Step 6.3:** Update Task Create/Edit API & Form to handle `reminderConfig`.
* **Step 6.4:** Implement User Notification Preferences API (`PUT /api/profile/notifications`).
* **Step 6.5:** Create Vue components for User Profile Page to manage preferences. Wire up to API.
* **Step 6.6:** Integrate Event Notification triggers: Modify existing APIs (Task Create, Pause, Delete, Occurrence Assign, Execute, Skip, Comment) to check user preferences and queue appropriate emails. Handle "Mine" logic. Ensure single notification for mass deletions.

**(Phase 7: UI Enhancement)**

* **Step 7.1:** Implement Full Occurrences List Page: Modify `OccurrencesListPage.vue` to show occurrences across *all* tasks, not just filtered by one task.
* **Step 7.2:** Implement Filtering UI & Logic on Tasks List Page (Status, Category). Update API (`GET /api/tasks`) to accept filter params.
* **Step 7.3:** Implement Searching UI & Logic on Tasks List Page (Name, Description). Update API.
* **Step 7.4:** Implement Sorting UI & Logic on Tasks List Page. Update API.
* **Step 7.5:** Implement Filtering UI & Logic on Occurrences List Page (Due Date, Status, Category, Assignee). Update API (`GET /api/occurrences` - new endpoint needed).
* **Step 7.6:** Implement Searching UI & Logic on Occurrences List Page (Task Name, Description). Update API.
* **Step 7.7:** Implement Sorting UI & Logic on Occurrences List Page. Update API.
* **Step 7.8:** Implement Household Management Page UI (Invite User form, User List w/ Remove/Admin toggle buttons, Custom Category CRUD).
* **Step 7.9:** Implement Household Management APIs (`GET /api/household/users`, `POST /api/household/invites`, `DELETE /api/household/users/:id`, `PUT /api/household/users/:id/admin`, `GET/POST/PUT/DELETE /api/household/categories`). Wire up UI.
* **Step 7.10:** Implement Dashboard Page UI (Basic stats, upcoming tasks - requires new API endpoints).

**(Phase 8: Refinement)**

* **Step 8.1:** Enhance Error Handling across API routes (validation, specific error codes, logging).
* **Step 8.2:** Enhance Frontend Error Handling (user feedback messages, form validation).
* **Step 8.3:** Code Cleanup & Refactoring. Add missing comments. Ensure type safety.
* **Step 8.4:** Basic End-to-End Testing (manual or automated).
* **Step 8.5:** UI Polish (styling, transitions, responsiveness).

---

**LLM Prompts:**

Below are the prompts corresponding to the initial steps of the plan. Each prompt assumes the context of the previous ones and the overall project specification.

---

```text
**Prompt 1.1: Project Setup**

Initialize a new Nuxt 3 project named "adulting-diy" using TypeScript. Include Pinia for state management. Set up Tailwind CSS for styling according to Nuxt 3 documentation. Ensure the project structure is standard for Nuxt 3 development. Create a basic `app.vue` layout.
```

---

```text
**Prompt 1.2: Define Core TypeScript Interfaces**

Based on the project specification's Data Models section, create TypeScript interface definitions for `User`, `Household`, `Category`, `TaskDefinition`, `TaskOccurrence`, and `OccurrenceHistoryLog`. Place these interfaces in appropriate files under a `types` or `interfaces` directory (e.g., `types/database.ts` or separate files). Use basic types (string, number, boolean, Date, Array, Enum placeholders where appropriate) for now. Ensure consistent naming and structure as per the spec. Example for Enum placeholder: `metaStatus: 'Active' | 'Paused' | 'Soft-deleted' | 'Completed';`. Use the `@` alias for root path imports if needed elsewhere later.
```

---

```text
**Prompt 1.3: Setup Database Connection (Prisma)**

Integrate Prisma into the "adulting-diy" Nuxt 3 project to connect to a CockroachDB database.
1. Install Prisma client and CLI (`@prisma/client`, `prisma`).
2. Initialize Prisma (`npx prisma init`) which should create `prisma/schema.prisma` and `.env`.
3. Configure the `.env` file with the `DATABASE_URL` for your CockroachDB instance (use a placeholder format like `postgresql://user:password@host:port/database?sslmode=require`).
4. Update `prisma/schema.prisma` to set the provider to `cockroachdb`.
5. Create a Nuxt server utility (e.g., `server/utils/db.ts`) that initializes and exports a singleton Prisma client instance, ensuring it's properly instantiated for server routes.
```

---

```text
**Prompt 1.4: Define Initial Database Schema & Migration**

Translate the TypeScript interfaces defined in Prompt 1.2 (`User`, `Household`, `Category`, `TaskDefinition`, `TaskOccurrence`, `OccurrenceHistoryLog`) into Prisma models within the `prisma/schema.prisma` file.

* Use appropriate Prisma types (`String`, `DateTime`, `Boolean`, `Int`, `Json?`, etc.).
* Define relations between models correctly (e.g., `User` to `Household`, `TaskDefinition` to `Household`, `TaskOccurrence` to `TaskDefinition` and `User` (assignees), `OccurrenceHistoryLog` to `TaskOccurrence` and `User`). Use Prisma relation syntax (`@relation`). Define foreign key fields explicitly where needed.
* Set up primary keys (`@id`, potentially using `cuid()` or `uuid()` defaults).
* Add necessary indices (`@index`, `@@index`).
* Use `DateTime @default(now())` for `createdAt` and `@updatedAt` for `updatedAt` fields.
* Define Enums for status fields (`TaskMetaStatus`, `OccurrenceStatus`, `HistoryEventType`).
* Handle optional fields (`?`) and default values (`@default`).
* Ensure the schema reflects the one-to-many and many-to-many relationships accurately (e.g., `assigneeIds` on Occurrence might need a join table or be handled differently if using Prisma relations strictly). *Self-correction: Let's use a relation table for OccurrenceAssignees: `OccurrenceAssignee { occurrenceId, userId, @@id([occurrenceId, userId]) }`.* Adjust `TaskOccurrence` model accordingly. Similarly for `defaultAssigneeIds` on TaskDefinition.

After defining the schema, generate the first database migration using `npx prisma migrate dev --name init` and apply it. Ensure Prisma Client is generated (`npx prisma generate`).
```

---

```text
**Prompt 2.1: Implement User Signup API Route**

Create a Nuxt 3 server API route `server/api/auth/signup.post.ts`.
1.  It should accept `name`, `email`, and `password` in the request body.
2.  Validate the input (presence, basic email format, password complexity - basic check for now). Return a 400 error with a message if invalid.
3.  Check if a user with the given email already exists using the Prisma client (`server/utils/db.ts`). Return a 409 error if the email is taken.
4.  Hash the provided password using a library like `bcrypt`.
5.  Create a new `User` record in the database using Prisma, saving the `name`, `email`, and `passwordHash`.
6.  Return a 201 status code upon successful creation, potentially returning the newly created user's ID and email (excluding the password hash).
7.  Implement basic try/catch error handling for database operations and return a 500 error if something goes wrong. Use arrow function syntax for the handler.
```

---

```text
**Prompt 2.2: Implement User Login API Route**

Create a Nuxt 3 server API route `server/api/auth/login.post.ts`.
1.  It should accept `email` and `password` in the request body.
2.  Validate input presence. Return 400 if invalid.
3.  Find the user by email using Prisma. Return 404 if the user is not found.
4.  Compare the provided password with the stored `passwordHash` using `bcrypt`. Return 401 if the password doesn't match.
5.  If login is successful, establish a user session. *(For simplicity in Nuxt, let's use `nuxt-auth-utils` or a similar established library if available/preferred for session/token management. If not specified, implement basic session handling using Nuxt 3's server utilities or cookies for this step - e.g., set a secure, httpOnly cookie with user ID or basic session info)*.
6.  Return a 200 status code with basic user information (ID, name, email, isAdmin status, householdId) upon successful login.
7.  Include try/catch error handling. Use arrow function syntax.
```

---

```text
**Prompt 2.3: Implement Auth Middleware & Handling**

Configure authentication handling within the Nuxt 3 application.
1.  If using a library like `nuxt-auth-utils`, follow its setup instructions for middleware and session access.
2.  If implementing manually:
    * Create Nuxt server middleware (e.g., `server/middleware/auth.ts`) that checks for the session cookie/token set during login on protected API routes (e.g., routes under `/api/tasks`, `/api/households` excluding auth routes). If the session is invalid or missing, return a 401 Unauthorized error. Attach user session data (e.g., userId, householdId) to the `event.context` for use in subsequent API handlers.
    * Create global client-side middleware (e.g., `middleware/auth.global.ts`) that checks user authentication status (e.g., from a Pinia store updated after login) before allowing access to protected pages (like Dashboard, Tasks List). Redirect unauthenticated users to the Login page.
```

---

*(Continue generating prompts for subsequent steps: 2.4 (Login/Signup UI), 2.5 (Pinia Auth Store), 2.6 (Household Create API), etc., ensuring each prompt builds logically on the previous ones and references necessary code/concepts established earlier.)*