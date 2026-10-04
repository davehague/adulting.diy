# Home projects, slice 2: steps and the next-step list (design spec)

Status: design agreed in conversation on 2026-10-04, awaiting David's review of this written spec. No code is written until this spec and a written implementation plan are both approved.

This replaces the handoff `2026-10-04-projects-slice-2-brief.md`. Slice 1 is described in `2026-10-03-projects-design.md` and `docs/functionality/projects.md`.

## Goal

Slice 1 lets David and Amanda capture and list their home projects. Slice 2 answers the next question: "what is the next thing I can do around the house?"

Each project gets a short checklist of steps. The home dashboard shows one row per Active project with only its next undone step, so a dozen projects read as a handful of things to do, not a wall.

Success for slice 2: David opens the dashboard on his phone, sees the next step for each Active project, and checks one off without opening the project.

## Decisions made in the brainstorm

Decided 2026-10-03:

- A step is a line of text, a done checkbox and an order, plus an optional time estimate in minutes typed by hand (the field AI fills in later).
- No assignee, due date or reminders on steps.
- Steps are a new table. They are not the chore tasks (`TaskDefinition` / `TaskOccurrence`), which carry scheduling and reminders a step does not need.
- The cross-project list shows, for each Active project, only its next undone step (the first not done, by order). Only Active projects feed the list.
- A project with no steps appears in the list as itself.
- Any household member can create, edit and delete steps. There are no admin-only parts.

Decided 2026-10-04:

- The list lives on the home dashboard (`/dashboard`), as its own section.
- No reordering. Steps stay in the order they were added; a new step goes to the bottom. A position number is still stored so reordering or AI-inserted steps can come later without a migration.
- Checking off the last undone step shows a pop-up asking whether to mark the project Done.
- Done steps stay visible on the project page, in place, greyed and struck through.
- Checking a project-as-itself row on the dashboard shows the same pop-up, not an instant Done. This refines the 2026-10-03 decision ("checking it off marks the project Done") so one stray tap cannot remove a project from the list.

## Out of scope for slice 2

- Reordering steps (drag or buttons).
- A step count on project cards ("2 of 6 steps") and a total-time-remaining figure.
- Assignees, due dates and reminders on steps.
- AI-suggested steps or estimates.
- Linking providers to projects, engagement status and quotes.
- Showing steps or the next-step list on `/projects` or `/projects/new`.

## Data model

One new table. A step is done when `doneAt` is set; there is no separate boolean.

```prisma
model ProjectStep {
  id              String    @id @default(uuid())
  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId       String
  text            String
  position        Int       // order within the project; lowest first
  doneAt          DateTime? // set when checked off, cleared when unchecked
  estimateMinutes Int?      // optional, typed by hand
  createdBy       User      @relation("ProjectStepCreatedBy", fields: [createdById], references: [id])
  createdById     String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([projectId, position])
  @@map("project_steps")
}
```

`Project` gains `steps ProjectStep[]` and `User` gains the matching relation field.

Position: a new step gets the project's highest position plus one (0 for the first). Deleting a step leaves a gap, which is fine because only the relative order matters. Two steps added at the same instant can receive the same position; the list then orders by `position`, then `createdAt`, so the result is still stable.

Limits, enforced by Zod and the service:

- Text: 1 to 200 characters after trimming.
- Estimate: a whole number of minutes from 1 to 9999, or empty.
- At most 100 steps per project (`MAX_PROJECT_STEPS`). The 101st add returns 409 with "This project already has 100 steps".

### Migration

Hand-written, in a new folder `prisma/migrations/<timestamp>_add_project_steps/`, mirroring `20261003120000_add_projects/migration.sql`: `CREATE TABLE "project_steps"`, then `ALTER TABLE "project_steps" SET (schema_locked = false);`, then the index and the two foreign keys (`projectId` cascade, `createdById` restrict). Never `prisma migrate dev`. The migration only adds a table, so it is safe to apply while the current code is live.

## The next-step rule

One pure function decides what each Active project shows. It takes a project's steps (already ordered) and returns one of three kinds:

- `step`: the first step with no `doneAt`.
- `noSteps`: the project has no steps.
- `allDone`: the project has steps and every one is done.

It lives in a shared file (`utils/project-steps.ts`) so the service and the project page use the same rule, and it is unit-tested without a database.

## API

All routes use `defineHouseholdProtectedEventHandler` and the `toHttpError` pattern of the existing project routes. Every step route first loads the project by id, household and `metaStatus: 'active'` (404 "Project not found" otherwise), then, for routes that name a step, requires the step to belong to that project (404 "Step not found" otherwise).

| Route | Purpose |
|---|---|
| `GET /api/projects/next-steps` | The dashboard list. |
| `POST /api/projects/:id/steps` | Add a step. Body: `{ text, estimateMinutes? }`. Returns the step. |
| `PUT /api/projects/:id/steps/:stepId` | Change a step. Body: any of `{ text, estimateMinutes, done }`. Returns the step. |
| `DELETE /api/projects/:id/steps/:stepId` | Remove a step for good. |
| `GET /api/projects/:id` (existing) | Now also returns `steps`, ordered by position then creation time. |

`done: true` sets `doneAt` to now if it is not already set (checking an already-done step keeps its original time); `done: false` clears it. `estimateMinutes: null` clears the estimate.

`GET /api/projects/next-steps` returns:

```ts
interface NextStepsResponse {
  hasProjects: boolean; // the household has at least one non-deleted project, in any status
  items: NextStepItem[];
}

interface NextStepItem {
  projectId: string;
  projectTitle: string;
  kind: 'step' | 'noSteps' | 'allDone';
  step: { id: string; text: string; estimateMinutes: number | null } | null; // set only when kind is 'step'
}
```

Items cover the household's Active, non-deleted projects, newest project first (the same order as the Projects list). `next-steps.get.ts` sits beside `locations.get.ts`; Nitro already resolves a static segment ahead of `[id]` there.

Marking a project Done uses the existing `PUT /api/projects/:id` with `{ status: 'done' }`. No new route.

## Code shape

- `server/services/ProjectStepService.ts`: `add`, `update`, `remove`, `nextSteps`. Separate from `ProjectService`, which only gains `steps` in its detail include and DTO.
- `server/utils/project-schemas.ts`: `stepCreateSchema` and `stepUpdateSchema`.
- `types/project.ts`: `ProjectStepDto`, the input types, `MAX_PROJECT_STEPS`, the next-steps response types; `ProjectDetail` gains `steps`.
- `utils/project-steps.ts`: the next-step rule and a minutes formatter ("30 min", "1 h 30 min").
- `composables/useProjects.ts`: `addStep`, `updateStep`, `deleteStep`, `listNextSteps`.
- `components/projects/ProjectSteps.vue`: the Steps section of the project page.
- `components/projects/ProjectNextSteps.vue`: the dashboard section. It fetches its own data.
- `components/projects/MarkDoneDialog.vue`: the pop-up, following the existing modal pattern (`components/occurrences/CompleteModal.vue`).
- `pages/projects/[id].vue` and `pages/dashboard.vue` each gain one component tag and a small handler. The project page is already over 300 lines, so step logic does not go inline.

## Screens

### Dashboard: "Project next steps"

Placed directly under the three stat cards and above Coming Up, styled like the Coming Up card.

- One row per item: a checkbox, the step text, the project title in small text beneath it, and the estimate when there is one.
- For `noSteps` and `allDone` items the main text is the project title and the small text is "No steps yet" or "All steps done".
- Tapping the text opens `/projects/:id`. This is the "tap to see the rest". Only the checkbox checks things off.
- Checking a `step` row saves `done: true`, then reloads the list. The row then shows that project's next step. If the project's item comes back as `allDone`, the pop-up opens for that project.
- Checking a `noSteps` or `allDone` row opens the pop-up directly; nothing is saved unless **Mark Done** is chosen.
- The checkbox is disabled while its save is in flight. If the save fails the box returns to unchecked and a one-line error shows in the section.
- The section loads independently of the chore data. If its request fails it shows "Could not load project steps" with a retry link, and the rest of the dashboard is unaffected.
- When `items` is empty and `hasProjects` is true, the section shows "No active projects. Set a project to Active to see its next step here." with a link to `/projects`. When `hasProjects` is false the section is not rendered at all.

### Project page: "Steps"

A new section between the details and the photos.

- Each step: a checkbox, the text, an optional minutes field, and a remove button. Removing asks for confirmation the same way removing a photo does.
- Text and minutes are edited in place and save when the field loses focus or Enter is pressed, like the title. Clearing the text is rejected ("Step text is required") and the field returns to the saved value. Clearing the minutes removes the estimate.
- An "Add a step" input at the bottom with an Add button. Enter adds the step and keeps focus in the input, so several steps can be typed in a row. The estimate is set on the row afterwards. At 100 steps the input is replaced by a line saying the limit is reached.
- Done steps stay in place, greyed and struck through. Unchecking restores one.
- With no steps the section shows "No steps yet." above the input.
- Steps can be added and edited on a project in any status, including Done.
- A failed save shows the server's message in the section and puts the field or checkbox back to the saved value.

### The "mark Done?" pop-up

An in-app dialog: "That was the last step of *{title}*. Mark the project Done?" with **Mark Done** and **Not yet**. When opened from a project-as-itself row the first sentence is dropped: "Mark *{title}* Done?".

- It opens when a step is checked and the project now has steps, all done, and a status other than Done. It does not open when a step is unchecked, edited or removed, or when the project is already Done.
- **Mark Done** saves `status: 'done'`. On the dashboard the project then leaves the list. On the project page the status field shows Done.
- **Not yet**, Escape, or tapping outside closes it and changes nothing. The project stays Active and appears on the dashboard as itself ("All steps done"), so the choice is offered again there.
- If the save fails, the dialog shows the error and stays open.

## Behaviour notes

- Two people checking the same step at once is harmless: the second request finds it already done and keeps the first time.
- Setting a project to Done by hand leaves its steps as they are. Moving a Done project back to Active puts it back on the dashboard with whatever its steps say.
- Deleting a project hides its steps with it (every step route requires a non-deleted project). The rows stay, like the photos.
- A browser tab still running the previous build may receive a project without `steps`, and a new tab may briefly talk to an old server mid-deploy. The page treats a missing `steps` as an empty list, the same guard `photoIds` has.

## Testing

Automated (Vitest, Prisma mocked, following `tests/unit/services/project-service.test.ts`):

- `ProjectStepService`: household isolation on every method (another household's project is 404; a step from another project is 404); add assigns the next position and enforces the cap; update sets, keeps and clears `doneAt` and the estimate; remove deletes only the named step; `nextSteps` returns only Active non-deleted projects, in order, with the right kind, and the right `hasProjects`.
- The next-step rule and the minutes formatter, as pure functions.
- The two Zod schemas: trimming, length limits, estimate bounds, rejection of non-integers.
- `ProjectService.get` returns steps in order.

Not automated, and never run before David sees it:

- The four step routes and the changed project route (the repo has no route tests).
- The three components and both page changes. The dev server is not started against the production database and Google sign-in does not work on preview URLs, so their first real run is on David's phone in production after the merge.

`npx nuxi typecheck` must show no errors in new or changed files (65 pre-existing errors elsewhere are the baseline).

## Delivery

Built with subagent-driven development on a feature branch `feat/project-steps` in the main checkout (no git worktrees): Sonnet implementers, an Opus review after each task and an Opus review of the whole branch.

Order, each step needing David's explicit yes:

1. Apply the migration with `npx prisma migrate deploy`.
2. Merge to `main` and push (Vercel deploys).
3. David runs the numbered phone test steps supplied with the final report.

After the build, `docs/functionality/projects.md`, `docs/tech/api-endpoints.md`, the changelog and the data-model line in `CLAUDE.md` are updated with the `update-docs` skill.

## Later slices (not designed here)

- Link providers to a project with a status (considering, contacted, chosen, passed), then quotes as numbers.
- AI help: suggested next steps and time estimates; "describe your problem" routing to a provider category with a reason per shortlisted provider. Ranking stays deterministic. The AI explains and routes; it never picks the contractor. When AI regenerates steps it must match and keep existing ones, never wipe them, and planning must not run inside a single web request.
- A clean-up job for photos of long-deleted projects.

## Open items carried from the handoff brief

- Five tests in `tests/unit/services/notification-service.test.ts` fail when the suite runs after 8 pm US Eastern. Under investigation on 2026-10-04; handled outside this slice unless David decides otherwise.
- `npx nuxi typecheck` reports 65 pre-existing errors in unrelated files.
- David's click-through results for the providers screens are still unknown.
- Offered, not approved: a `/shelloverflow` post, and a logged-out detector for the Worthington watcher (under investigation on 2026-10-04).
- From the slice 1 cleanup, never run in a browser: the "Saved" text clearing after about 2 seconds, and the reworded maximum-photos message.
- Worth doing once: Amanda opens Projects on her phone to confirm she sees and can edit everything.
