# Home Projects Slice 2 (Steps and the Dashboard Next-Step List) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each home project a checklist of steps, and show the next undone step of every Active project on the home dashboard, checkable in place.

**Architecture:** One new table (`project_steps`) behind a new `ProjectStepService`, four new Nitro routes and one extended route, following the slice 1 project patterns. A pure function (`nextStepOf`) decides what each project shows and is shared by the server and the pages. Three new Vue components: the Steps section on the project page, the self-loading "Project next steps" section on the dashboard, and a "mark Done?" dialog used by both.

**Tech Stack:** Nuxt 3 / Vue 3 `<script setup>` / TypeScript, Nitro (h3), Prisma 5 on CockroachDB, Zod 3, Tailwind, lucide-vue-next, Vitest with mocked Prisma.

**Spec:** `docs/superpowers/specs/2026-10-04-projects-steps-design.md`. Read it before starting any task.

## Execution rules (set by David)

- Subagent-driven development: one implementer per task, an independent reviewer after each task, a fix round when the reviewer finds problems, and a final whole-branch review.
- Implementer subagents run on **Sonnet** (`model: "sonnet"`). Reviewer subagents, including the final whole-branch review, run on **Opus** (`model: "opus"`).
- Work in the main checkout on branch `feat/project-steps` (already created; the spec and this plan are committed on it). Do **not** use git worktrees: a symlinked `node_modules` breaks this repo's Vitest setup. Tasks run one at a time.
- Commit with explicit paths only. Never `git add -A` or `git add .`; `.claude/settings.local.json` is modified locally and must not be committed.
- **Local dev uses the production database.** No task may run `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, a seed or db script, or the dev server. `npx prisma validate` and `npx prisma generate` are safe (they do not contact the database).
- These need David's explicit go-ahead and are done by the controller, never by a subagent: applying the migration, any `git push`, any merge.
- End every commit message with these two lines:

  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011yRKa57ifyoe1JZBEnGWT6
  ```

- Code style (CLAUDE.md): explicit TypeScript types, no `any`, arrow functions, `import { type X }`, camelCase and PascalCase. Match the comment density of neighbouring files. Markdown: never hard-wrap prose.
- When reporting, say plainly what was only unit-tested and what was not exercised at all.

## Global Constraints

- A step is done when `doneAt` is set. There is no separate boolean column.
- Step text: 1 to 200 characters after trimming. Error messages: "Step text is required", "Step text must be 200 characters or fewer".
- Estimate: a whole number of minutes from 1 to 9999, or null. Error message for anything else: "Estimate must be a whole number of minutes from 1 to 9999".
- At most 100 steps per project (`MAX_PROJECT_STEPS`). The 101st add returns 409 with "This project already has 100 steps".
- Steps are ordered by `position` ascending, then `createdAt` ascending. A new step gets the highest existing position plus one (0 for the first). There is no reorder UI.
- The next-step kinds are exactly `step`, `noSteps`, `allDone`.
- Only projects with `metaStatus: 'active'` and `status: 'active'` feed the dashboard list, newest project first.
- Every step route requires the project to be in the caller's household and not deleted (404 "Project not found"), and a named step to belong to that project (404 "Step not found").
- The "mark Done?" dialog opens only when a step is checked (not unchecked, edited or removed), the project then has steps that are all done, and the project's status is not `done`. On the dashboard it also opens when a `noSteps` or `allDone` row is checked.
- Dialog copy: after a last step, "That was the last step of {title}. Mark the project Done?"; from a project-as-itself row, "Mark {title} Done?". Buttons: "Mark Done" and "Not yet".
- Dashboard copy: section title "Project next steps"; "No steps yet"; "All steps done"; "No active projects. Set a project to Active to see its next step here."; "Could not load project steps".
- Known baselines: `npx nuxi typecheck` reports 65 errors in files unrelated to projects; none may mention a file this plan creates or changes. After Task 1 the full suite must pass at any time of day.

## Review Focus

Inputs and conditions the spec implies that are most likely to bite, each pinned by a test in the task that owns the code:

1. A step or project id from another household, or a step id that belongs to a different project in the same household: every service method returns 404 and writes nothing (Task 3 tests).
2. An estimate typed as `1.5`, `0`, `-5`, `10000` or text: rejected with the estimate message, never stored (Task 2 schema tests; the page repeats the check before sending).
3. Two people checking the same step: the second check keeps the first `doneAt` (Task 3 test "keeps the original doneAt").
4. A response from an older server build with no `steps`, or a step with no `doneAt` key: treated as an empty list and as not done; nothing throws (Task 2 `nextStepOf` tests; `?? []` guards in Tasks 5 and 6).
5. Text of only spaces, or 201 characters, on add and on edit: rejected with the text messages; on edit the field returns to the saved value (Task 2 schema tests).

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `tests/unit/services/notification-service.test.ts` | 1 | Fixtures built at noon UTC |
| `prisma/schema.prisma` | 2 | `ProjectStep` model and relations |
| `prisma/migrations/20261004120000_add_project_steps/migration.sql` | 2 | Hand-written migration |
| `types/project.ts` | 2 | Step DTOs, inputs, limits, next-step types |
| `utils/project-steps.ts` | 2 | `nextStepOf`, `formatMinutes` |
| `server/utils/project-schemas.ts` | 2 | `stepCreateSchema`, `stepUpdateSchema` |
| `server/services/ProjectStepService.ts` | 3 | add, update, remove, nextSteps |
| `server/services/ProjectService.ts` | 3 | Detail includes steps |
| `server/api/projects/next-steps.get.ts` and `server/api/projects/[id]/steps*.ts` | 4 | Routes |
| `composables/useProjects.ts` | 4 | Client calls |
| `components/projects/MarkDoneDialog.vue` | 5 | The pop-up |
| `components/projects/ProjectSteps.vue` | 5 | Steps section |
| `pages/projects/[id].vue` | 5 | Mounts the section and dialog |
| `components/projects/ProjectNextSteps.vue` | 6 | Dashboard section |
| `pages/dashboard.vue` | 6 | Mounts the section |
| docs and `CLAUDE.md` | 7 | Documentation |

---

### Task 1: Make the notification tests pass at any time of day

Five tests in `tests/unit/services/notification-service.test.ts` fail after 20:00 US Eastern (after 00:00 UTC). Cause, already investigated: the tests build due dates at **local** midnight, while production stores due dates at **noon UTC** (`server/utils/dates.ts`, `parseDateOnly`) and `NotificationService.isDateToday` compares calendar days in the household timezone (UTC in these tests). When the local day is behind the UTC day the fixture lands on the wrong UTC day. Production is not affected: the reminder cron runs at 13:00 UTC. This task changes test fixtures only.

**Files:**
- Modify: `tests/unit/services/notification-service.test.ts` (six due-date fixtures, near lines 215-217, 265-267, 315-317, 681-683, 730-732, 781-783)

**Interfaces:**
- Consumes: nothing.
- Produces: a full suite that passes regardless of the clock. Later tasks rely on `npx vitest run` being green.

- [ ] **Step 1: Reproduce the failure (RED)**

The machine's timezone can be faked per command. At any moment at least one of these two zones is on a different calendar day from UTC:

```bash
TZ=Etc/GMT+12 npx vitest run tests/unit/services/notification-service.test.ts
TZ=Etc/GMT-14 npx vitest run tests/unit/services/notification-service.test.ts
```

Expected: one of the two runs shows failures in these tests (the other passes): "sends overdue reminder for occurrence with dueDate in the past", "sends before reminder for upcoming occurrence", "processes multiple reminders in config", "sends reminder if none was sent today", "does not log dedup record when send fails". Record the output in your report. If neither run fails, stop and report NEEDS_CONTEXT with both outputs.

- [ ] **Step 2: Build the six due-date fixtures at noon UTC**

Each fixture is a pair of lines of this shape (variable names differ: `threeDaysAgo`, `threeDaysFromNow`, `dueDate`):

```ts
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    threeDaysAgo.setHours(0, 0, 0, 0)
```

Replace each pair with the UTC equivalent at noon, keeping the same offset (`- 3` or `+ 3`):

```ts
    // Noon UTC, like production due dates (parseDateOnly), so the calendar day is the same in every timezone.
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3)
    threeDaysAgo.setUTCHours(12, 0, 0, 0)
```

Apply this to all six fixtures, including the one in "does not send reminder if one was already sent today" (it currently passes after 20:00 Eastern only because nothing is sent at all). Put the comment on the first one only. Do not change the `today.setHours(0, 0, 0, 0)` lines or the `yesterday` / `tomorrow` helpers near lines 187-193 unless Step 3 still fails; if you have to, say exactly why in your report. Do not touch `server/`.

- [ ] **Step 3: Verify under both fake timezones and the real one (GREEN)**

```bash
TZ=Etc/GMT+12 npx vitest run tests/unit/services/notification-service.test.ts
TZ=Etc/GMT-14 npx vitest run tests/unit/services/notification-service.test.ts
npx vitest run tests/unit/services/notification-service.test.ts
```

Expected: all three runs pass every test in the file (81 tests).

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: every test passes (603 at the start of this plan).

- [ ] **Step 5: Commit**

```bash
git add tests/unit/services/notification-service.test.ts
git commit -m "test: build notification due-date fixtures at noon UTC so the suite passes at any hour"
```

---

### Task 2: Foundations (schema, migration, types, next-step rule, validation)

**Files:**
- Modify: `prisma/schema.prisma` (the `User` model near line 31, the `Project` model near line 315, new model after `ProjectPhoto`)
- Create: `prisma/migrations/20261004120000_add_project_steps/migration.sql`
- Modify: `types/project.ts`
- Create: `utils/project-steps.ts`
- Modify: `server/utils/project-schemas.ts`
- Test: `tests/unit/utils/project-steps.test.ts` (new), `tests/unit/utils/project-schemas.test.ts` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - Prisma model `ProjectStep` (`prisma.projectStep`), relation `Project.steps`.
  - From `@/types/project`: `MAX_PROJECT_STEPS`, `MAX_STEP_TEXT_LENGTH`, `MAX_STEP_ESTIMATE_MINUTES`, `ProjectStepDto`, `ProjectStepCreateInput`, `ProjectStepUpdateInput`, `NextStepKind`, `NextStepSummary`, `NextStepItem`, `NextStepsResponse`; `ProjectDetail.steps: ProjectStepDto[]`.
  - From `@/utils/project-steps`: `nextStepOf<T extends { doneAt?: Date | string | null }>(steps: T[]): { kind: NextStepKind; step: T | null }` and `formatMinutes(minutes: number): string`.
  - From `@/server/utils/project-schemas`: `stepCreateSchema`, `stepUpdateSchema`.

- [ ] **Step 1: Write the failing tests for the next-step rule and the formatter**

Create `tests/unit/utils/project-steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextStepOf, formatMinutes } from '@/utils/project-steps'

const step = (id: string, doneAt: Date | string | null = null) => ({ id, doneAt })

describe('nextStepOf', () => {
  it('reports noSteps for an empty list', () => {
    expect(nextStepOf([])).toEqual({ kind: 'noSteps', step: null })
  })

  it('returns the first step that is not done', () => {
    const steps = [step('a', new Date()), step('b'), step('c')]
    expect(nextStepOf(steps)).toEqual({ kind: 'step', step: steps[1] })
  })

  it('returns the first step when none are done', () => {
    const steps = [step('a'), step('b')]
    expect(nextStepOf(steps).step).toBe(steps[0])
  })

  it('reports allDone when every step is done', () => {
    expect(nextStepOf([step('a', new Date()), step('b', '2026-10-04T12:00:00.000Z')])).toEqual({ kind: 'allDone', step: null })
  })

  it('treats a step with no doneAt key as not done', () => {
    const steps = [{ id: 'a' }]
    expect(nextStepOf(steps)).toEqual({ kind: 'step', step: steps[0] })
  })
})

describe('formatMinutes', () => {
  it('shows minutes under an hour', () => {
    expect(formatMinutes(30)).toBe('30 min')
  })

  it('shows whole hours without minutes', () => {
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(120)).toBe('2 h')
  })

  it('shows hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatMinutes(9999)).toBe('166 h 39 min')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/utils/project-steps.test.ts`
Expected: FAIL, cannot resolve `@/utils/project-steps`.

- [ ] **Step 3: Add the types**

In `types/project.ts`, add after the `MAX_THUMB_PHOTO_BYTES` line:

```ts
export const MAX_PROJECT_STEPS = 100;
export const MAX_STEP_TEXT_LENGTH = 200;
export const MAX_STEP_ESTIMATE_MINUTES = 9999;
```

Add after the `ProjectPhotoDto` interface:

```ts
export interface ProjectStepDto {
  id: string;
  text: string;
  position: number;
  // set when the step is checked off; null means not done
  doneAt: Date | string | null;
  estimateMinutes: number | null;
}

export interface ProjectStepCreateInput {
  text: string;
  estimateMinutes?: number | null;
}

export interface ProjectStepUpdateInput {
  text?: string;
  estimateMinutes?: number | null;
  done?: boolean;
}

export type NextStepKind = 'step' | 'noSteps' | 'allDone';

export interface NextStepSummary {
  id: string;
  text: string;
  estimateMinutes: number | null;
}

export interface NextStepItem {
  projectId: string;
  projectTitle: string;
  kind: NextStepKind;
  // set only when kind is 'step'
  step: NextStepSummary | null;
}

export interface NextStepsResponse {
  // the household has at least one non-deleted project, in any status
  hasProjects: boolean;
  items: NextStepItem[];
}
```

In the `ProjectDetail` interface add, after `photos: ProjectPhotoDto[];`:

```ts
  steps: ProjectStepDto[];
```

- [ ] **Step 4: Write the next-step rule and the formatter**

Create `utils/project-steps.ts`:

```ts
import { type NextStepKind } from '@/types/project';

interface StepLike {
  doneAt?: Date | string | null;
}

export interface NextStepResult<T extends StepLike> {
  kind: NextStepKind;
  step: T | null;
}

// What a project shows in the next-step list. `steps` must already be in display order.
export const nextStepOf = <T extends StepLike>(steps: T[]): NextStepResult<T> => {
  if (steps.length === 0) return { kind: 'noSteps', step: null };
  const next = steps.find((step) => !step.doneAt);
  return next ? { kind: 'step', step: next } : { kind: 'allDone', step: null };
};

export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/unit/utils/project-steps.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Write the failing schema tests**

In `tests/unit/utils/project-schemas.test.ts`, add `stepCreateSchema` and `stepUpdateSchema` to the existing import from `@/server/utils/project-schemas`, and append at the end of the file:

```ts
const ESTIMATE_MESSAGE = 'Estimate must be a whole number of minutes from 1 to 9999'

describe('stepCreateSchema', () => {
  it('trims the text and accepts text alone', () => {
    const parsed = stepCreateSchema.parse({ text: '  Buy primer  ' })
    expect(parsed.text).toBe('Buy primer')
    expect(parsed.estimateMinutes).toBeUndefined()
  })

  it('rejects missing text and text of only spaces', () => {
    for (const body of [{}, { text: '   ' }]) {
      const result = stepCreateSchema.safeParse(body)
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0].message).toBe('Step text is required')
    }
  })

  it('accepts 200 characters and rejects 201', () => {
    expect(stepCreateSchema.safeParse({ text: 'a'.repeat(200) }).success).toBe(true)
    const result = stepCreateSchema.safeParse({ text: 'a'.repeat(201) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Step text must be 200 characters or fewer')
  })

  it('accepts an estimate from 1 to 9999 and null', () => {
    expect(stepCreateSchema.parse({ text: 'x', estimateMinutes: 1 }).estimateMinutes).toBe(1)
    expect(stepCreateSchema.parse({ text: 'x', estimateMinutes: 9999 }).estimateMinutes).toBe(9999)
    expect(stepCreateSchema.parse({ text: 'x', estimateMinutes: null }).estimateMinutes).toBeNull()
  })

  it('rejects an estimate that is not a whole number from 1 to 9999', () => {
    for (const estimateMinutes of [0, -5, 1.5, 10000, '30', 'abc']) {
      const result = stepCreateSchema.safeParse({ text: 'x', estimateMinutes })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0].message).toBe(ESTIMATE_MESSAGE)
    }
  })
})

describe('stepUpdateSchema', () => {
  it('accepts an empty body and each field alone', () => {
    expect(stepUpdateSchema.parse({})).toEqual({})
    expect(stepUpdateSchema.parse({ done: true })).toEqual({ done: true })
    expect(stepUpdateSchema.parse({ text: ' Sand the patch ' })).toEqual({ text: 'Sand the patch' })
    expect(stepUpdateSchema.parse({ estimateMinutes: null })).toEqual({ estimateMinutes: null })
  })

  it('rejects text of only spaces', () => {
    const result = stepUpdateSchema.safeParse({ text: '  ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Step text is required')
  })

  it('rejects a done value that is not a boolean', () => {
    const result = stepUpdateSchema.safeParse({ done: 'yes' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Done must be true or false')
  })

  it('rejects a bad estimate', () => {
    const result = stepUpdateSchema.safeParse({ estimateMinutes: 1.5 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe(ESTIMATE_MESSAGE)
  })
})
```

- [ ] **Step 7: Run them to see them fail**

Run: `npx vitest run tests/unit/utils/project-schemas.test.ts`
Expected: the new `describe` blocks FAIL (`stepCreateSchema` is undefined); the existing tests still pass.

- [ ] **Step 8: Write the schemas**

In `server/utils/project-schemas.ts`, add `MAX_STEP_ESTIMATE_MINUTES` and `MAX_STEP_TEXT_LENGTH` to the import from `@/types/project`, and add after `projectUpdateSchema`:

```ts
const ESTIMATE_MESSAGE = `Estimate must be a whole number of minutes from 1 to ${MAX_STEP_ESTIMATE_MINUTES}`;

const stepText = z
  .string({ required_error: 'Step text is required', invalid_type_error: 'Step text is required' })
  .trim()
  .min(1, 'Step text is required')
  .max(MAX_STEP_TEXT_LENGTH, `Step text must be ${MAX_STEP_TEXT_LENGTH} characters or fewer`);

const estimateMinutes = z
  .number({ invalid_type_error: ESTIMATE_MESSAGE })
  .int(ESTIMATE_MESSAGE)
  .min(1, ESTIMATE_MESSAGE)
  .max(MAX_STEP_ESTIMATE_MINUTES, ESTIMATE_MESSAGE)
  .nullable()
  .optional();

export const stepCreateSchema = z.object({ text: stepText, estimateMinutes });

export const stepUpdateSchema = z.object({
  text: stepText.optional(),
  estimateMinutes,
  done: z.boolean({ invalid_type_error: 'Done must be true or false' }).optional(),
});
```

- [ ] **Step 9: Run the schema tests to see them pass**

Run: `npx vitest run tests/unit/utils/project-schemas.test.ts`
Expected: PASS, including the 9 new tests. If a message assertion fails because Zod reports a different first issue (for example for `1.5`), adjust the schema, not the test: the messages in Global Constraints are the requirement.

- [ ] **Step 10: Add the Prisma model**

In `prisma/schema.prisma`:

In the `User` model, directly under the `projectPhotos ... @relation("ProjectPhotoUploadedBy")` line, add:

```prisma
  projectSteps           ProjectStep[]           @relation("ProjectStepCreatedBy")
```

In the `Project` model, directly under `photos      ProjectPhoto[]`, add:

```prisma
  steps       ProjectStep[]
```

After the closing brace of `model ProjectPhoto`, add:

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

Match the column alignment of the neighbouring lines in each model.

- [ ] **Step 11: Write the migration by hand**

Create `prisma/migrations/20261004120000_add_project_steps/migration.sql` with exactly:

```sql
-- CreateTable
CREATE TABLE "project_steps" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "text" STRING NOT NULL,
    "position" INT4 NOT NULL,
    "doneAt" TIMESTAMP(3),
    "estimateMinutes" INT4,
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_steps_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the index and foreign keys below can be added.
ALTER TABLE "project_steps" SET (schema_locked = false);

-- CreateIndex
CREATE INDEX "project_steps_projectId_position_idx" ON "project_steps"("projectId", "position");

-- AddForeignKey
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Compare it line by line with `prisma/migrations/20261003120000_add_projects/migration.sql` (the `project_photos` table is the closest match) and confirm the column types and constraint naming follow the same conventions. **Do not apply it.** Do not run any `prisma migrate` command.

- [ ] **Step 12: Validate the schema and regenerate the client**

```bash
npx prisma validate
npx prisma generate
```

Expected: "The schema at prisma/schema.prisma is valid" and a generated client. Neither command contacts the database.

- [ ] **Step 13: Full suite and typecheck**

```bash
npx vitest run
npx nuxi typecheck
```

Expected: all tests pass. Typecheck: `ProjectService.ts` will now report that `steps` is missing from the object `toDetail` returns; that single error is expected and is fixed in Task 3. No other error may mention a file this task changed.

- [ ] **Step 14: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261004120000_add_project_steps/migration.sql types/project.ts utils/project-steps.ts server/utils/project-schemas.ts tests/unit/utils/project-steps.test.ts tests/unit/utils/project-schemas.test.ts
git commit -m "feat: project step schema, migration, types, next-step rule and validation"
```

---

### Task 3: ProjectStepService, and steps on the project detail

**Files:**
- Create: `server/services/ProjectStepService.ts`
- Modify: `server/services/ProjectService.ts` (`detailInclude` near line 17, `toDetail` near line 26)
- Test: `tests/unit/services/project-step-service.test.ts` (new), `tests/unit/services/project-service.test.ts` (extend)

**Interfaces:**
- Consumes (Task 2): `prisma.projectStep`; `MAX_PROJECT_STEPS`, `ProjectStepDto`, `ProjectStepCreateInput`, `ProjectStepUpdateInput`, `NextStepItem`, `NextStepsResponse` from `@/types/project`; `nextStepOf` from `@/utils/project-steps`; `HttpError` from `@/server/utils/api-errors`.
- Produces:
  - `stepOrder` and `stepSelect` (exported query fragments).
  - `class ProjectStepService` with:
    - `add(householdId: string, userId: string, projectId: string, input: ProjectStepCreateInput): Promise<ProjectStepDto>`
    - `update(householdId: string, projectId: string, stepId: string, input: ProjectStepUpdateInput): Promise<ProjectStepDto>`
    - `remove(householdId: string, projectId: string, stepId: string): Promise<void>`
    - `nextSteps(householdId: string): Promise<NextStepsResponse>`
  - `ProjectService.get` and `ProjectService.update` return `steps` in order.

- [ ] **Step 1: Write the failing service tests**

Create `tests/unit/services/project-step-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    projectStep: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectStepService } from '@/server/services/ProjectStepService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const stepRow = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  text: 'Buy primer',
  position: 0,
  doneAt: null,
  estimateMinutes: null,
  ...overrides,
})

describe('ProjectStepService', () => {
  let service: ProjectStepService
  beforeEach(() => {
    service = new ProjectStepService()
    vi.clearAllMocks()
    db.project.findFirst.mockResolvedValue({ id: 'p1' })
  })

  describe('add', () => {
    it('returns 404 and writes nothing for a project in another household or a deleted one', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.add('h1', 'u1', 'p1', { text: 'x' })).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
      expect(db.projectStep.create).not.toHaveBeenCalled()
    })

    it('gives the first step position 0', async () => {
      db.projectStep.findMany.mockResolvedValue([])
      db.projectStep.create.mockResolvedValue(stepRow())
      await service.add('h1', 'u1', 'p1', { text: 'Buy primer' })
      expect(db.projectStep.create.mock.calls[0][0].data).toEqual({
        projectId: 'p1', createdById: 'u1', text: 'Buy primer', estimateMinutes: null, position: 0,
      })
    })

    it('puts a new step after the highest position, even when there are gaps', async () => {
      db.projectStep.findMany.mockResolvedValue([{ position: 0 }, { position: 4 }, { position: 2 }])
      db.projectStep.create.mockResolvedValue(stepRow({ position: 5 }))
      await service.add('h1', 'u1', 'p1', { text: 'x', estimateMinutes: 30 })
      const data = db.projectStep.create.mock.calls[0][0].data
      expect(data.position).toBe(5)
      expect(data.estimateMinutes).toBe(30)
    })

    it('returns the created step', async () => {
      db.projectStep.findMany.mockResolvedValue([])
      db.projectStep.create.mockResolvedValue(stepRow())
      await expect(service.add('h1', 'u1', 'p1', { text: 'Buy primer' })).resolves.toEqual(stepRow())
    })

    it('rejects the 101st step with 409 and writes nothing', async () => {
      db.projectStep.findMany.mockResolvedValue(Array.from({ length: 100 }, (_, position) => ({ position })))
      await expect(service.add('h1', 'u1', 'p1', { text: 'x' })).rejects.toMatchObject({
        statusCode: 409, message: 'This project already has 100 steps',
      })
      expect(db.projectStep.create).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('returns 404 and writes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'p1', 's1', { done: true })).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectStep.update).not.toHaveBeenCalled()
    })

    it('returns 404 and writes nothing for a step that belongs to a different project', async () => {
      db.projectStep.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'p1', 's1', { done: true })).rejects.toMatchObject({ statusCode: 404, message: 'Step not found' })
      expect(db.projectStep.findFirst.mock.calls[0][0].where).toEqual({ id: 's1', projectId: 'p1' })
      expect(db.projectStep.update).not.toHaveBeenCalled()
    })

    it('sets doneAt when a step is checked', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.update.mockResolvedValue(stepRow({ doneAt: new Date() }))
      await service.update('h1', 'p1', 's1', { done: true })
      const call = db.projectStep.update.mock.calls[0][0]
      expect(call.where).toEqual({ id: 's1' })
      expect(call.data.doneAt).toBeInstanceOf(Date)
    })

    it('keeps the original doneAt when a done step is checked again', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: new Date('2026-10-01T12:00:00Z') })
      db.projectStep.update.mockResolvedValue(stepRow({ doneAt: new Date('2026-10-01T12:00:00Z') }))
      await service.update('h1', 'p1', 's1', { done: true })
      expect('doneAt' in db.projectStep.update.mock.calls[0][0].data).toBe(false)
    })

    it('clears doneAt when a step is unchecked', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: new Date() })
      db.projectStep.update.mockResolvedValue(stepRow())
      await service.update('h1', 'p1', 's1', { done: false })
      expect(db.projectStep.update.mock.calls[0][0].data).toEqual({ doneAt: null })
    })

    it('changes only the fields that were sent, and can clear the estimate', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.update.mockResolvedValue(stepRow({ text: 'Sand' }))
      await service.update('h1', 'p1', 's1', { text: 'Sand' })
      expect(db.projectStep.update.mock.calls[0][0].data).toEqual({ text: 'Sand' })
      await service.update('h1', 'p1', 's1', { estimateMinutes: null })
      expect(db.projectStep.update.mock.calls[1][0].data).toEqual({ estimateMinutes: null })
    })
  })

  describe('remove', () => {
    it('returns 404 and deletes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'p1', 's1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectStep.delete).not.toHaveBeenCalled()
    })

    it('returns 404 and deletes nothing for a step that belongs to a different project', async () => {
      db.projectStep.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'p1', 's1')).rejects.toMatchObject({ statusCode: 404, message: 'Step not found' })
      expect(db.projectStep.delete).not.toHaveBeenCalled()
    })

    it('deletes only the named step', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      await service.remove('h1', 'p1', 's1')
      expect(db.projectStep.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
    })
  })

  describe('nextSteps', () => {
    it('asks only for the household\'s Active, non-deleted projects, newest first, with ordered steps', async () => {
      db.project.count.mockResolvedValue(0)
      db.project.findMany.mockResolvedValue([])
      await service.nextSteps('h1')
      const query = db.project.findMany.mock.calls[0][0]
      expect(query.where).toEqual({ householdId: 'h1', metaStatus: 'active', status: 'active' })
      expect(query.orderBy).toEqual({ createdAt: 'desc' })
      expect(query.select.steps.orderBy).toEqual([{ position: 'asc' }, { createdAt: 'asc' }])
      expect(db.project.count.mock.calls[0][0].where).toEqual({ householdId: 'h1', metaStatus: 'active' })
    })

    it('reports hasProjects false with no items for a household with no projects', async () => {
      db.project.count.mockResolvedValue(0)
      db.project.findMany.mockResolvedValue([])
      await expect(service.nextSteps('h1')).resolves.toEqual({ hasProjects: false, items: [] })
    })

    it('reports hasProjects true with no items when no project is Active', async () => {
      db.project.count.mockResolvedValue(3)
      db.project.findMany.mockResolvedValue([])
      await expect(service.nextSteps('h1')).resolves.toEqual({ hasProjects: true, items: [] })
    })

    it('returns one item per project with the right kind, in query order', async () => {
      db.project.count.mockResolvedValue(3)
      db.project.findMany.mockResolvedValue([
        {
          id: 'p-step', title: 'Fix gate latch',
          steps: [
            stepRow({ id: 's1', doneAt: new Date() }),
            stepRow({ id: 's2', text: 'Fit new latch', position: 1, estimateMinutes: 30 }),
            stepRow({ id: 's3', text: 'Paint', position: 2 }),
          ],
        },
        { id: 'p-empty', title: 'Clean light fixtures', steps: [] },
        { id: 'p-done', title: 'Patch drywall', steps: [stepRow({ id: 's9', doneAt: new Date() })] },
      ])
      const result = await service.nextSteps('h1')
      expect(result.items).toEqual([
        { projectId: 'p-step', projectTitle: 'Fix gate latch', kind: 'step', step: { id: 's2', text: 'Fit new latch', estimateMinutes: 30 } },
        { projectId: 'p-empty', projectTitle: 'Clean light fixtures', kind: 'noSteps', step: null },
        { projectId: 'p-done', projectTitle: 'Patch drywall', kind: 'allDone', step: null },
      ])
    })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/services/project-step-service.test.ts`
Expected: FAIL, cannot resolve `@/server/services/ProjectStepService`.

- [ ] **Step 3: Write the service**

Create `server/services/ProjectStepService.ts`:

```ts
import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import {
  MAX_PROJECT_STEPS,
  type NextStepItem,
  type NextStepsResponse,
  type ProjectStepCreateInput,
  type ProjectStepDto,
  type ProjectStepUpdateInput,
} from '@/types/project';
import { nextStepOf } from '@/utils/project-steps';

// createdAt breaks the tie when two steps added at the same instant got the same position.
export const stepOrder = [{ position: 'asc' }, { createdAt: 'asc' }] satisfies Prisma.ProjectStepOrderByWithRelationInput[];

export const stepSelect = {
  id: true,
  text: true,
  position: true,
  doneAt: true,
  estimateMinutes: true,
} satisfies Prisma.ProjectStepSelect;

export class ProjectStepService {
  async add(householdId: string, userId: string, projectId: string, input: ProjectStepCreateInput): Promise<ProjectStepDto> {
    await this.requireProject(householdId, projectId);
    const existing = await prisma.projectStep.findMany({ where: { projectId }, select: { position: true } });
    if (existing.length >= MAX_PROJECT_STEPS) {
      throw new HttpError(`This project already has ${MAX_PROJECT_STEPS} steps`, 409);
    }
    const position = existing.reduce((highest, step) => Math.max(highest, step.position), -1) + 1;
    return prisma.projectStep.create({
      data: {
        projectId,
        createdById: userId,
        text: input.text,
        estimateMinutes: input.estimateMinutes ?? null,
        position,
      },
      select: stepSelect,
    });
  }

  async update(householdId: string, projectId: string, stepId: string, input: ProjectStepUpdateInput): Promise<ProjectStepDto> {
    await this.requireProject(householdId, projectId);
    const step = await this.requireStep(projectId, stepId);
    const data: Prisma.ProjectStepUpdateInput = {};
    if (input.text !== undefined) data.text = input.text;
    if (input.estimateMinutes !== undefined) data.estimateMinutes = input.estimateMinutes;
    // Checking a step that is already done keeps the time it was first checked.
    if (input.done === true && step.doneAt === null) data.doneAt = new Date();
    if (input.done === false) data.doneAt = null;
    return prisma.projectStep.update({ where: { id: stepId }, data, select: stepSelect });
  }

  async remove(householdId: string, projectId: string, stepId: string): Promise<void> {
    await this.requireProject(householdId, projectId);
    await this.requireStep(projectId, stepId);
    await prisma.projectStep.delete({ where: { id: stepId } });
  }

  async nextSteps(householdId: string): Promise<NextStepsResponse> {
    const [projectCount, activeProjects] = await Promise.all([
      prisma.project.count({ where: { householdId, metaStatus: 'active' } }),
      prisma.project.findMany({
        where: { householdId, metaStatus: 'active', status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, steps: { orderBy: stepOrder, select: stepSelect } },
      }),
    ]);

    const items: NextStepItem[] = activeProjects.map((project) => {
      const { kind, step } = nextStepOf(project.steps);
      return {
        projectId: project.id,
        projectTitle: project.title,
        kind,
        step: step ? { id: step.id, text: step.text, estimateMinutes: step.estimateMinutes } : null,
      };
    });

    return { hasProjects: projectCount > 0, items };
  }

  private async requireProject(householdId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);
  }

  private async requireStep(projectId: string, stepId: string): Promise<{ id: string; doneAt: Date | null }> {
    const step = await prisma.projectStep.findFirst({
      where: { id: stepId, projectId },
      select: { id: true, doneAt: true },
    });
    if (!step) throw new HttpError('Step not found', 404);
    return step;
  }
}
```

- [ ] **Step 4: Run the service tests to see them pass**

Run: `npx vitest run tests/unit/services/project-step-service.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Write the failing test for steps on the project detail**

In `tests/unit/services/project-service.test.ts`:

Add `steps: [],` to the object returned by the `row` helper, directly under `photos: [],`.

Inside `describe('get', ...)`, add after the "returns the project with its photos" test:

```ts
    it('returns the project with its steps, asked for in position then creation order', async () => {
      const steps = [
        { id: 's1', text: 'Buy primer', position: 0, doneAt: new Date('2026-10-02T12:00:00Z'), estimateMinutes: 20 },
        { id: 's2', text: 'Paint', position: 1, doneAt: null, estimateMinutes: null },
      ]
      db.project.findFirst.mockResolvedValue(row({ steps }))
      const result = await service.get('h1', 'p1')
      expect(result.steps).toEqual(steps)
      expect(db.project.findFirst.mock.calls[0][0].include.steps.orderBy).toEqual([{ position: 'asc' }, { createdAt: 'asc' }])
    })
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run tests/unit/services/project-service.test.ts`
Expected: the new test FAILS (`result.steps` is undefined); the others pass.

- [ ] **Step 7: Include steps in the project detail**

In `server/services/ProjectService.ts`:

Add this import under the existing `HttpError` import:

```ts
import { stepOrder, stepSelect } from '@/server/services/ProjectStepService';
```

Change `detailInclude` to:

```ts
const detailInclude = {
  photos: {
    orderBy: { position: 'asc' },
    select: { id: true, width: true, height: true, position: true },
  },
  steps: { orderBy: stepOrder, select: stepSelect },
} satisfies Prisma.ProjectInclude;
```

In `toDetail`, add after `photos: project.photos,`:

```ts
  steps: project.steps,
```

Change nothing else in this file. `list` keeps its own include and does not return steps.

- [ ] **Step 8: Run both service test files, the full suite and typecheck**

```bash
npx vitest run tests/unit/services/project-service.test.ts tests/unit/services/project-step-service.test.ts
npx vitest run
npx nuxi typecheck
```

Expected: everything passes. Typecheck: the `toDetail` error from Task 2 is gone; no error mentions a file changed by Tasks 2 or 3.

- [ ] **Step 9: Commit**

```bash
git add server/services/ProjectStepService.ts server/services/ProjectService.ts tests/unit/services/project-step-service.test.ts tests/unit/services/project-service.test.ts
git commit -m "feat: ProjectStepService and steps on the project detail"
```

---

### Task 4: Routes and client calls

The repo has no route tests, so this task has no automated tests. The routes are thin: parse, validate, call the service. Say so in your report.

**Files:**
- Create: `server/api/projects/next-steps.get.ts`
- Create: `server/api/projects/[id]/steps.post.ts`
- Create: `server/api/projects/[id]/steps/[stepId].put.ts`
- Create: `server/api/projects/[id]/steps/[stepId].delete.ts`
- Modify: `composables/useProjects.ts`

**Interfaces:**
- Consumes (Task 2): `stepCreateSchema`, `stepUpdateSchema`; the step types. (Task 3): `ProjectStepService`.
- Produces, from `useProjects()`:
  - `listNextSteps(): Promise<NextStepsResponse>`
  - `addStep(projectId: string, input: ProjectStepCreateInput): Promise<ProjectStepDto>`
  - `updateStep(projectId: string, stepId: string, input: ProjectStepUpdateInput): Promise<ProjectStepDto>`
  - `deleteStep(projectId: string, stepId: string): Promise<unknown>`

- [ ] **Step 1: The next-steps route**

Create `server/api/projects/next-steps.get.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (_event, _authUser, householdId) => {
  try {
    return await new ProjectStepService().nextSteps(householdId);
  } catch (error) {
    return toHttpError(error, 'listing project next steps');
  }
});
```

It sits beside `locations.get.ts`, which already shows that Nitro resolves a static segment ahead of `[id]`.

- [ ] **Step 2: The add route**

Create `server/api/projects/[id]/steps.post.ts`:

```ts
import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { stepCreateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = stepCreateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectStepService().add(householdId, authUser.userId, projectId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'adding project step');
  }
});
```

- [ ] **Step 3: The update route**

Create `server/api/projects/[id]/steps/[stepId].put.ts`:

```ts
import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { stepUpdateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const stepId = event.context.params?.stepId;
    if (!projectId || !stepId) throw new HttpError('Project ID and step ID are required', 400);
    const parsed = stepUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectStepService().update(householdId, projectId, stepId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating project step');
  }
});
```

- [ ] **Step 4: The delete route**

Create `server/api/projects/[id]/steps/[stepId].delete.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const stepId = event.context.params?.stepId;
    if (!projectId || !stepId) throw new HttpError('Project ID and step ID are required', 400);
    await new ProjectStepService().remove(householdId, projectId, stepId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting project step');
  }
});
```

- [ ] **Step 5: The client calls**

In `composables/useProjects.ts`, add `type NextStepsResponse`, `type ProjectStepCreateInput`, `type ProjectStepDto` and `type ProjectStepUpdateInput` to the import from `@/types/project` (keep the list alphabetical), then add after `fetchPhotoBlob`:

```ts
  const listNextSteps = () => api.get<NextStepsResponse>('/api/projects/next-steps');
  const addStep = (projectId: string, input: ProjectStepCreateInput) =>
    api.post<ProjectStepDto>(`/api/projects/${projectId}/steps`, input);
  const updateStep = (projectId: string, stepId: string, input: ProjectStepUpdateInput) =>
    api.put<ProjectStepDto>(`/api/projects/${projectId}/steps/${stepId}`, input);
  const deleteStep = (projectId: string, stepId: string) =>
    api.delete(`/api/projects/${projectId}/steps/${stepId}`);
```

and change the `return` to:

```ts
  return {
    listProjects, getProject, createProject, updateProject, deleteProject, listLocations,
    uploadPhoto, deletePhoto, fetchPhotoBlob,
    listNextSteps, addStep, updateStep, deleteStep,
  };
```

- [ ] **Step 6: Check against the existing routes, then full suite and typecheck**

Read `server/api/projects/[id].put.ts` and `server/api/projects/[id]/photos/[photoId].delete.ts` and confirm the four new files follow the same shape (wrapper, params, schema parse, `toHttpError`).

```bash
npx vitest run
npx nuxi typecheck
```

Expected: all tests pass; no typecheck error mentions a file this task created or changed.

- [ ] **Step 7: Commit**

```bash
git add server/api/projects/next-steps.get.ts "server/api/projects/[id]/steps.post.ts" "server/api/projects/[id]/steps/[stepId].put.ts" "server/api/projects/[id]/steps/[stepId].delete.ts" composables/useProjects.ts
git commit -m "feat: project step routes and client calls"
```

---

### Task 5: The "mark Done?" dialog and the Steps section on the project page

No automated tests: the repo has no component tests and the dev server must not be started. Include in your report a hand trace of: add two steps; check the first (no dialog); check the second (dialog opens); Not yet; uncheck and re-check the second (dialog opens again); Mark Done (status shows Done); on a Done project, uncheck and re-check a step (no dialog); a failed save of a checkbox, of the text and of the estimate.

**Files:**
- Create: `components/projects/MarkDoneDialog.vue`
- Create: `components/projects/ProjectSteps.vue`
- Modify: `pages/projects/[id].vue`

**Interfaces:**
- Consumes (Task 2): `MAX_PROJECT_STEPS`, `MAX_STEP_ESTIMATE_MINUTES`, `ProjectStepDto`, `ProjectStatus`; `nextStepOf`, `formatMinutes`. (Task 4): `addStep`, `updateStep`, `deleteStep` from `useProjects()`.
- Produces:
  - `MarkDoneDialog` props `{ show: boolean; projectTitle: string; afterLastStep: boolean; saving?: boolean; error?: string | null }`, emits `confirm` and `cancel`. Task 6 uses it with exactly these names.
  - `ProjectSteps` props `{ projectId: string; steps: ProjectStepDto[]; projectStatus: ProjectStatus }`, emits `update:steps` (the whole new array) and `all-done`.

Layout note for phone widths: a step's text can be 200 characters, so a row shows the text as wrapping plain text. Tapping the text opens that one row for editing (text field, minutes field, Remove, Close). Each field still saves when it loses focus or Enter is pressed, as the spec says. The remove button lives in the open row.

- [ ] **Step 1: The dialog**

Create `components/projects/MarkDoneDialog.vue`:

```vue
<template>
  <div v-if="show"
       class="fixed inset-0 z-50 overflow-y-auto bg-stone-500 bg-opacity-75"
       aria-labelledby="mark-done-title"
       role="dialog"
       aria-modal="true">
    <!-- Tapping the dimmed area (this wrapper itself, not the panel inside it) is the same as "Not yet". -->
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0" @click.self="cancel">
      <div class="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <h3 id="mark-done-title" class="text-lg font-medium leading-6 text-stone-900 font-heading">Mark project Done?</h3>
        <p class="mt-3 text-sm text-stone-600 break-words">
          <template v-if="afterLastStep">
            That was the last step of <span class="font-medium text-stone-900">{{ projectTitle }}</span>. Mark the project Done?
          </template>
          <template v-else>
            Mark <span class="font-medium text-stone-900">{{ projectTitle }}</span> Done?
          </template>
        </p>
        <p v-if="error" class="mt-3 text-sm text-red-700" aria-live="polite">{{ error }}</p>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button type="button"
                  :disabled="saving"
                  class="inline-flex w-full items-center justify-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 sm:col-start-2"
                  @click="emit('confirm')">
            <Check :size="16" />{{ saving ? 'Saving...' : 'Mark Done' }}
          </button>
          <button type="button"
                  :disabled="saving"
                  class="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-2 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50 sm:col-start-1 sm:mt-0"
                  @click="cancel">
            <X :size="16" />Not yet
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue';
import { Check, X } from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  projectTitle: string;
  // true when the dialog follows the last step being checked; false when a project row itself was checked
  afterLastStep: boolean;
  saving?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const cancel = (): void => {
  if (!props.saving) emit('cancel');
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') cancel();
};

// Escape only matters while the dialog is open. `show` starts false, so nothing touches `window` during SSR.
watch(() => props.show, (show) => {
  if (show) window.addEventListener('keydown', onKeydown);
  else window.removeEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
```

- [ ] **Step 2: The Steps section**

Create `components/projects/ProjectSteps.vue`:

```vue
<template>
  <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
    <h2 class="text-lg font-medium text-stone-900 mb-3">Steps</h2>

    <p v-if="steps.length === 0" class="text-sm text-stone-600 mb-3">No steps yet.</p>
    <ul v-else class="divide-y divide-stone-100 mb-3">
      <li v-for="step in steps" :key="step.id" class="py-2">
        <div class="flex items-start gap-3">
          <input type="checkbox"
                 class="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                 :checked="!!step.doneAt"
                 :disabled="busyIds.includes(step.id)"
                 :aria-label="`Done: ${step.text}`"
                 @change="toggleDone(step, $event)">

          <!-- Closed row: wrapping text, tap to edit. -->
          <button v-if="editingId !== step.id"
                  type="button"
                  class="flex-1 min-w-0 text-left"
                  @click="openEditor(step)">
            <span class="block text-sm break-words"
                  :class="step.doneAt ? 'line-through text-stone-400' : 'text-stone-900'">{{ step.text }}</span>
            <span v-if="step.estimateMinutes !== null" class="block text-xs text-stone-500 mt-0.5">
              {{ formatMinutes(step.estimateMinutes) }}
            </span>
          </button>

          <!-- Open row: each field saves when it loses focus or Enter is pressed. -->
          <div v-else class="flex-1 min-w-0 space-y-2">
            <input :id="`step-text-${step.id}`"
                   type="text"
                   :maxlength="MAX_STEP_TEXT_LENGTH"
                   :value="step.text"
                   aria-label="Step"
                   class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                   @change="saveText(step, $event)"
                   @keydown.enter.prevent="blurTarget">
            <div class="flex flex-wrap items-center gap-2">
              <label :for="`step-estimate-${step.id}`" class="text-xs text-stone-600">Estimate (minutes)</label>
              <input :id="`step-estimate-${step.id}`"
                     type="number"
                     inputmode="numeric"
                     min="1"
                     :max="MAX_STEP_ESTIMATE_MINUTES"
                     step="1"
                     :value="step.estimateMinutes ?? ''"
                     class="w-24 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                     @change="saveEstimate(step, $event)"
                     @keydown.enter.prevent="blurTarget">
              <span class="flex-1" />
              <button type="button"
                      class="text-sm font-medium text-red-700 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50"
                      :disabled="busyIds.includes(step.id)"
                      @click="removeStep(step)">
                Remove
              </button>
              <button type="button"
                      class="text-sm font-medium text-stone-600 px-2 py-1 rounded-lg hover:bg-stone-100"
                      @click="editingId = null">
                Close
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="error" class="text-sm text-red-700 mb-3" aria-live="polite">{{ error }}</p>

    <form v-if="steps.length < MAX_PROJECT_STEPS" class="flex gap-2" @submit.prevent="addNewStep">
      <input ref="newStepInput"
             v-model="newText"
             type="text"
             :maxlength="MAX_STEP_TEXT_LENGTH"
             placeholder="Add a step"
             aria-label="Add a step"
             class="flex-1 min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
      <button type="submit"
              :disabled="adding || newText.trim() === ''"
              class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
        <Plus :size="16" />Add
      </button>
    </form>
    <p v-else class="text-sm text-stone-600">That's the maximum of {{ MAX_PROJECT_STEPS }} steps for a project.</p>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { Plus } from 'lucide-vue-next';
import {
  MAX_PROJECT_STEPS,
  MAX_STEP_ESTIMATE_MINUTES,
  MAX_STEP_TEXT_LENGTH,
  type ProjectStatus,
  type ProjectStepDto,
} from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { formatMinutes, nextStepOf } from '@/utils/project-steps';

const props = defineProps<{
  projectId: string;
  steps: ProjectStepDto[];
  projectStatus: ProjectStatus;
}>();

const emit = defineEmits<{
  (e: 'update:steps', steps: ProjectStepDto[]): void;
  // a step was just checked and every step is now done, on a project that is not Done yet
  (e: 'all-done'): void;
}>();

const { addStep, updateStep, deleteStep } = useProjects();

const error = ref<string | null>(null);
const busyIds = ref<string[]>([]);
const editingId = ref<string | null>(null);
const newText = ref('');
const adding = ref(false);
const newStepInput = ref<HTMLInputElement | null>(null);

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

const withStep = (updated: ProjectStepDto): ProjectStepDto[] =>
  props.steps.map((step) => (step.id === updated.id ? updated : step));

const setBusy = (stepId: string, busy: boolean): void => {
  busyIds.value = busy ? [...busyIds.value, stepId] : busyIds.value.filter((id) => id !== stepId);
};

const blurTarget = (event: Event): void => {
  (event.target as HTMLElement).blur();
};

const openEditor = async (step: ProjectStepDto): Promise<void> => {
  editingId.value = step.id;
  await nextTick();
  document.getElementById(`step-text-${step.id}`)?.focus();
};

const toggleDone = async (step: ProjectStepDto, event: Event): Promise<void> => {
  const box = event.target as HTMLInputElement;
  const done = box.checked;
  error.value = null;
  setBusy(step.id, true);
  try {
    const updated = await updateStep(props.projectId, step.id, { done });
    const next = withStep(updated);
    emit('update:steps', next);
    if (done && props.projectStatus !== 'done' && nextStepOf(next).kind === 'allDone') emit('all-done');
  } catch (e) {
    // The bound value did not change, so Vue will not reset the box; put it back by hand.
    box.checked = !done;
    error.value = messageOf(e, 'Could not save the step');
  } finally {
    setBusy(step.id, false);
  }
};

const saveText = async (step: ProjectStepDto, event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const text = input.value.trim();
  error.value = null;
  if (text === '') {
    error.value = 'Step text is required';
    input.value = step.text;
    return;
  }
  if (text === step.text) {
    input.value = step.text;
    return;
  }
  try {
    emit('update:steps', withStep(await updateStep(props.projectId, step.id, { text })));
  } catch (e) {
    input.value = step.text;
    error.value = messageOf(e, 'Could not save the step');
  }
};

const saveEstimate = async (step: ProjectStepDto, event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const saved = step.estimateMinutes === null ? '' : String(step.estimateMinutes);
  const raw = input.value.trim();
  error.value = null;

  let estimateMinutes: number | null = null;
  if (raw !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_STEP_ESTIMATE_MINUTES) {
      error.value = `Estimate must be a whole number of minutes from 1 to ${MAX_STEP_ESTIMATE_MINUTES}`;
      input.value = saved;
      return;
    }
    estimateMinutes = parsed;
  }
  if (estimateMinutes === step.estimateMinutes) return;

  try {
    emit('update:steps', withStep(await updateStep(props.projectId, step.id, { estimateMinutes })));
  } catch (e) {
    input.value = saved;
    error.value = messageOf(e, 'Could not save the estimate');
  }
};

const removeStep = async (step: ProjectStepDto): Promise<void> => {
  if (!window.confirm('Remove this step? This cannot be undone.')) return;
  error.value = null;
  setBusy(step.id, true);
  try {
    await deleteStep(props.projectId, step.id);
    if (editingId.value === step.id) editingId.value = null;
    emit('update:steps', props.steps.filter((existing) => existing.id !== step.id));
  } catch (e) {
    error.value = messageOf(e, 'Could not remove the step');
  } finally {
    setBusy(step.id, false);
  }
};

const addNewStep = async (): Promise<void> => {
  const text = newText.value.trim();
  if (text === '' || adding.value) return;
  error.value = null;
  adding.value = true;
  try {
    const created = await addStep(props.projectId, { text });
    emit('update:steps', [...props.steps, created]);
    newText.value = '';
  } catch (e) {
    error.value = messageOf(e, 'Could not add the step');
  } finally {
    adding.value = false;
  }
  // Keep the cursor in the box so several steps can be typed in a row.
  await nextTick();
  newStepInput.value?.focus();
};
</script>
```

- [ ] **Step 3: Mount both on the project page**

In `pages/projects/[id].vue`:

Template: between the closing `</section>` of the Details section and the `<!-- Photos -->` comment, add:

```vue
      <!-- Steps -->
      <ProjectSteps :project-id="project.id"
                    :steps="project.steps ?? []"
                    :project-status="project.status"
                    @update:steps="onStepsChange"
                    @all-done="openMarkDone" />

```

Directly before the `<!-- Full-size viewer -->` comment, add:

```vue
    <MarkDoneDialog v-if="project"
                    :show="markDone.open"
                    :project-title="project.title"
                    after-last-step
                    :saving="markDone.saving"
                    :error="markDone.error"
                    @confirm="confirmMarkDone"
                    @cancel="markDone.open = false" />

```

Script: add `type ProjectStepDto,` to the import from `@/types/project` (alphabetical, after `type ProjectStatus,`), and add these two imports after the `PhotoCarousel` import:

```ts
import ProjectSteps from '@/components/projects/ProjectSteps.vue';
import MarkDoneDialog from '@/components/projects/MarkDoneDialog.vue';
```

After the `onUploaded` function, add:

```ts
// An older server build (mid-deploy) may send a project without `steps`; the template guards the
// read with `?? []`, and every change replaces the array here.
const onStepsChange = (steps: ProjectStepDto[]): void => {
  if (project.value) project.value.steps = steps;
};

const markDone = reactive<{ open: boolean; saving: boolean; error: string | null }>({
  open: false, saving: false, error: null,
});

const openMarkDone = (): void => {
  markDone.error = null;
  markDone.open = true;
};

const confirmMarkDone = async (): Promise<void> => {
  markDone.saving = true;
  markDone.error = null;
  try {
    const updated = await updateProject(id.value, { status: 'done' });
    project.value = updated;
    fillForm(updated);
    markDone.open = false;
  } catch (e) {
    markDone.error = e instanceof Error ? e.message : 'Could not mark the project Done';
  } finally {
    markDone.saving = false;
  }
};
```

`reactive` is already imported in this file (it is used for `form`); confirm that and add it to the `vue` import only if it is missing. Change nothing else on the page.

- [ ] **Step 4: Full suite and typecheck**

```bash
npx vitest run
npx nuxi typecheck
```

Expected: all tests pass; no typecheck error mentions `MarkDoneDialog.vue`, `ProjectSteps.vue` or `pages/projects/[id].vue`.

- [ ] **Step 5: Commit**

```bash
git add components/projects/MarkDoneDialog.vue components/projects/ProjectSteps.vue "pages/projects/[id].vue"
git commit -m "feat: steps on the project page with a mark-Done prompt"
```

---

### Task 6: The "Project next steps" section on the dashboard

No automated tests, for the same reasons as Task 5. Include in your report a hand trace of: first load with no projects (nothing rendered); projects but none Active (hint); checking a `step` row whose project has more steps (row swaps, no dialog); checking the last step (dialog, after-last-step wording); checking a `noSteps` row (dialog, short wording, nothing saved until Mark Done); Not yet (row unchecked, still listed); Mark Done (row gone); a failed step save; a failed reload.

**Files:**
- Create: `components/projects/ProjectNextSteps.vue`
- Modify: `pages/dashboard.vue`

**Interfaces:**
- Consumes (Task 2): `NextStepItem`, `NextStepsResponse`, `formatMinutes`. (Task 4): `listNextSteps`, `updateStep`, `updateProject` from `useProjects()`. (Task 5): `MarkDoneDialog` with props `show`, `projectTitle`, `afterLastStep`, `saving`, `error` and emits `confirm`, `cancel`.
- Produces: `ProjectNextSteps`, a component with no props and no emits.

- [ ] **Step 1: The dashboard section**

Create `components/projects/ProjectNextSteps.vue`:

```vue
<template>
  <!-- Rendered only once we know the household has projects, or to report that loading failed. -->
  <div v-if="loadError || data?.hasProjects" class="bg-white rounded-xl shadow-sm border border-stone-100 mb-8">
    <div class="px-6 py-4 border-b border-stone-100">
      <h2 class="font-heading font-semibold text-stone-900">Project next steps</h2>
    </div>

    <div v-if="loadError" class="px-6 py-6 text-sm text-red-700">
      Could not load project steps.
      <button type="button" class="font-medium underline" @click="load">Try again</button>
    </div>

    <div v-else-if="items.length === 0" class="px-6 py-6 text-sm text-stone-500">
      No active projects. Set a project to Active to see its next step here.
      <NuxtLink to="/projects" class="text-amber-700 font-medium">Go to Projects &rarr;</NuxtLink>
    </div>

    <ul v-else class="divide-y divide-stone-50">
      <li v-for="item in items" :key="item.projectId" class="flex items-start gap-3 px-6 py-3.5">
        <input type="checkbox"
               class="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
               :checked="checkingProjectId === item.projectId"
               :disabled="checkingProjectId !== null"
               :aria-label="item.step ? `Done: ${item.step.text}` : `Mark ${item.projectTitle} Done`"
               @change="onCheck(item, $event)">
        <NuxtLink :to="`/projects/${item.projectId}`" class="flex-1 min-w-0">
          <span class="block text-sm font-medium text-stone-900 break-words">
            {{ item.step ? item.step.text : item.projectTitle }}
          </span>
          <span class="block text-xs text-stone-400 break-words">{{ subTextOf(item) }}</span>
        </NuxtLink>
        <span v-if="item.step && item.step.estimateMinutes !== null" class="text-xs text-stone-500 shrink-0 mt-0.5">
          {{ formatMinutes(item.step.estimateMinutes) }}
        </span>
      </li>
    </ul>

    <p v-if="actionError" class="px-6 py-3 border-t border-stone-100 text-sm text-red-700" aria-live="polite">
      {{ actionError }}
    </p>

    <MarkDoneDialog :show="dialog.open"
                    :project-title="dialog.projectTitle"
                    :after-last-step="dialog.afterLastStep"
                    :saving="dialog.saving"
                    :error="dialog.error"
                    @confirm="confirmMarkDone"
                    @cancel="dialog.open = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { type NextStepItem, type NextStepsResponse } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { formatMinutes } from '@/utils/project-steps';
import MarkDoneDialog from '@/components/projects/MarkDoneDialog.vue';

const authStore = useAuthStore();
const { listNextSteps, updateStep, updateProject } = useProjects();

const data = ref<NextStepsResponse | null>(null);
const loadError = ref(false);
const actionError = ref<string | null>(null);
// The project whose step is being saved. Its box stays checked until the list reloads; all boxes are disabled meanwhile.
const checkingProjectId = ref<string | null>(null);

// `items` may be missing in a response from an older server build; treat that as empty.
const items = computed<NextStepItem[]>(() => data.value?.items ?? []);

const dialog = reactive<{
  open: boolean; projectId: string; projectTitle: string; afterLastStep: boolean; saving: boolean; error: string | null;
}>({ open: false, projectId: '', projectTitle: '', afterLastStep: false, saving: false, error: null });

const subTextOf = (item: NextStepItem): string => {
  if (item.kind === 'noSteps') return 'No steps yet';
  if (item.kind === 'allDone') return 'All steps done';
  return item.projectTitle;
};

const load = async (): Promise<boolean> => {
  try {
    data.value = await listNextSteps();
    loadError.value = false;
    return true;
  } catch {
    loadError.value = true;
    return false;
  }
};

const openDialog = (item: NextStepItem, afterLastStep: boolean): void => {
  dialog.projectId = item.projectId;
  dialog.projectTitle = item.projectTitle;
  dialog.afterLastStep = afterLastStep;
  dialog.error = null;
  dialog.open = true;
};

const onCheck = async (item: NextStepItem, event: Event): Promise<void> => {
  const box = event.target as HTMLInputElement;
  actionError.value = null;

  // A project shown as itself: nothing is saved unless the dialog is confirmed, so the box goes straight back.
  if (!item.step) {
    box.checked = false;
    openDialog(item, false);
    return;
  }

  checkingProjectId.value = item.projectId;
  try {
    await updateStep(item.projectId, item.step.id, { done: true });
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Could not save the step';
    checkingProjectId.value = null;
    return;
  }

  const reloaded = await load();
  checkingProjectId.value = null;
  if (!reloaded) return;

  const refreshed = items.value.find((candidate) => candidate.projectId === item.projectId);
  if (refreshed?.kind === 'allDone') openDialog(refreshed, true);
};

const confirmMarkDone = async (): Promise<void> => {
  dialog.saving = true;
  dialog.error = null;
  try {
    await updateProject(dialog.projectId, { status: 'done' });
    dialog.open = false;
    await load();
  } catch (e) {
    dialog.error = e instanceof Error ? e.message : 'Could not mark the project Done';
  } finally {
    dialog.saving = false;
  }
};

// Same pattern as the dashboard page: wait for auth before the first request.
onMounted(() => {
  watch(() => authStore.isReady, (ready) => {
    if (ready) load();
  }, { immediate: true });
});
</script>
```

- [ ] **Step 2: Mount it on the dashboard**

In `pages/dashboard.vue`:

Template: between the closing `</div>` of the "Stat Cards Row" grid and the `<!-- Coming Up -->` comment, add:

```vue
      <!-- Project next steps: loads its own data, so a failure here never affects the chore sections. -->
      <ProjectNextSteps />

```

Script: after the `lucide-vue-next` import, add:

```ts
import ProjectNextSteps from '@/components/projects/ProjectNextSteps.vue';
```

Change nothing else. The section sits inside the page's `<template v-else>`, so it mounts once the chore request has settled (the page's `fetchDashboardData` catches its own errors and clears `loading` either way).

- [ ] **Step 3: Full suite and typecheck**

```bash
npx vitest run
npx nuxi typecheck
```

Expected: all tests pass; no typecheck error mentions `ProjectNextSteps.vue`. `pages/dashboard.vue` must not gain errors: if typecheck lists any for that file, confirm with `git diff pages/dashboard.vue` that none is on a line you added, and say so in your report.

- [ ] **Step 4: Commit**

```bash
git add components/projects/ProjectNextSteps.vue pages/dashboard.vue
git commit -m "feat: project next steps on the dashboard"
```

---

### Task 7: Documentation

**Files:**
- Modify: `docs/functionality/projects.md`
- Modify: `docs/tech/api-endpoints.md` (the Projects table near line 89 and the model list near line 192)
- Modify: `docs/functionality/changelog.md`
- Modify: `CLAUDE.md` (Key Concepts item 9, the `components/projects/` line in the structure tree)

**Interfaces:**
- Consumes: the behaviour built in Tasks 2 to 6 and the spec.
- Produces: docs that match the code. No code changes.

Never hard-wrap prose in these files: one paragraph per line.

- [ ] **Step 1: `docs/functionality/projects.md`**

In "What a Project Is", change the first sentence to: "Each project has a title, an optional location, a status, a path, optional notes, up to 10 photos, and a checklist of steps."

Add a new section after "The Project Page" (before "Photo Limits and Privacy"):

```markdown
## Steps

A project can have a checklist of steps, shown in a **Steps** section on the project page between the details and the photos. A step is a line of text (up to 200 characters) with a checkbox and an optional time estimate in whole minutes. Steps stay in the order they were added; a new step goes to the bottom, and there is no reordering. A project can hold at most 100 steps. Steps can be added and edited on a project in any status, and any household member can add, change, check off and remove them.

Type into **Add a step** and press Enter or tap Add; the cursor stays in the box so several steps can be entered in a row. Tapping a step's text opens that step for editing: the text and the estimate each save when the field is left or Enter is pressed, clearing the estimate removes it, and **Remove** deletes the step for good after a confirmation. Checked-off steps stay where they are, greyed and struck through, and unchecking one brings it back.

Checking off the last undone step asks "Mark the project Done?" with **Mark Done** and **Not yet**. Not yet changes nothing. The question is not asked when the project is already Done, or when a step is unchecked, edited or removed.

## Next Steps on the Dashboard

The dashboard shows a **Project next steps** section under the stat cards with one row for each Active project: its next undone step (the first one not checked off), the project's title beneath it, and the estimate when there is one. Only Active projects appear, newest project first. Tapping the text opens the project; ticking the box checks the step off and the row moves on to that project's next step.

An Active project with no steps, or with every step done, appears as itself, labelled "No steps yet" or "All steps done". Ticking that row, or ticking a project's last step, asks whether to mark the project Done; choosing Mark Done takes it off the list. When the household has projects but none is Active, the section says so and links to Projects. When the household has no projects, the section is not shown.
```

In "Not Yet", delete the two bullets about steps and the cross-project next-step list, and add these to the list: "Reordering steps.", "A step count on project cards and a total of the time remaining.", "Assignees, due dates or reminders on steps."

- [ ] **Step 2: `docs/tech/api-endpoints.md`**

In the Projects table, add this row directly after the `/api/projects/locations` row:

```markdown
| `GET` | `/api/projects/next-steps` | Household | The dashboard list: `hasProjects` (any non-deleted project exists) and one item per Active project, newest first, each with `kind` = `step`, `noSteps` or `allDone` and, for `step`, the next undone step (id, text, estimate) |
```

Change the description of `GET /api/projects/[id]` to "Get one project with its photos in order and its steps in order (position, then creation time)".

Add these rows after the last photos row:

```markdown
| `POST` | `/api/projects/[id]/steps` | Household | Add a step (`text` required, 1 to 200 characters; `estimateMinutes` optional, whole number 1 to 9999); it goes last. 409 at 100 steps |
| `PUT` | `/api/projects/[id]/steps/[stepId]` | Household | Update any of `text`, `estimateMinutes` (null clears it), `done` (true sets the done time unless already set, false clears it) |
| `DELETE` | `/api/projects/[id]/steps/[stepId]` | Household | Remove a step for good |
```

In the model list near line 192, change the Projects entry to: "**Project**, **ProjectPhoto**, **ProjectStep**: Home project tracking with private photos and a checklist of steps (see [projects.md](../functionality/projects.md))".

- [ ] **Step 3: `docs/functionality/changelog.md`**

Add at the top, under the `# Changelog` heading:

```markdown
## 2026-10-04

### Home Projects (slice 2): steps and next steps
- Each project can have a checklist of steps: a line of text, a done checkbox and an optional time estimate in minutes; steps stay in the order they were added
- The dashboard has a new **Project next steps** section showing the next undone step of every Active project, which can be checked off there
- Checking off a project's last step asks whether to mark the project Done
- Projects with no steps, or with every step done, appear in the dashboard list as themselves

```

- [ ] **Step 4: `CLAUDE.md`**

Change Key Concepts item 9 to: "**Project**: Household home-project tracking (title, location, status, path, notes), with **ProjectPhoto** (private photos in Vercel Blob) and **ProjectStep** (a checklist; the dashboard shows each Active project's next undone step). See [docs/functionality/projects.md](docs/functionality/projects.md)".

In the project structure tree, change the `components/projects/` comment to "Photo uploader, authenticated image, steps, dashboard next steps and mark-Done dialog components".

In the `server/services/` list, change the `Project*Service.ts` comment to "Project, ProjectPhoto, ProjectStep".

- [ ] **Step 5: Check and commit**

Confirm no paragraph was hard-wrapped (`git diff` should show whole-line changes only) and that every claim matches the code on this branch.

```bash
git add docs/functionality/projects.md docs/tech/api-endpoints.md docs/functionality/changelog.md CLAUDE.md
git commit -m "docs: project steps and the dashboard next-step list"
```

---

## After the tasks (controller, not subagents)

1. Final whole-branch Opus review of `main..feat/project-steps` against the spec, with a fix round if it finds anything above Minor.
2. Report to David: what was unit-tested (the service, the next-step rule, the formatter, the schemas, the notification fixtures) and what was never run (all four step routes, the three components, both page changes, the migration).
3. Ask David before each of: `npx prisma migrate deploy` (the migration only adds a table, so it goes first), the merge to `main`, the push.
4. Give David the phone test steps below, adjusted for anything that changed during the build.
5. Update the memory file with the new state.

## Phone test steps (production, after the merge and deploy)

1. Open https://www.adulting.diy on your phone and sign in. **Expect:** the dashboard. If none of your projects is Active, a "Project next steps" card under the three stat cards reads "No active projects. Set a project to Active to see its next step here."
2. Tap **Projects**, open any project, and set **Status** to Active. Scroll to **Steps**. **Expect:** "No steps yet." and an "Add a step" box.
3. Type `Buy primer`, press Enter, type `Paint the patch`, press Enter. **Expect:** both appear in that order, and the cursor stays in the box after each.
4. Tap the text "Buy primer". **Expect:** the row opens with a text field, "Estimate (minutes)", Remove and Close. Type `30` in the estimate, tap Close. **Expect:** "30 min" under "Buy primer".
5. Go to the dashboard. **Expect:** a row "Buy primer" with the project title under it and "30 min" on the right.
6. Tick that row's checkbox. **Expect:** it briefly stays ticked, then the row changes to "Paint the patch". No pop-up.
7. Tick "Paint the patch". **Expect:** a pop-up "That was the last step of (project title). Mark the project Done?" with Mark Done and Not yet.
8. Tap **Not yet**. **Expect:** the pop-up closes; the row now shows the project title with "All steps done" under it.
9. Tap the row's text. **Expect:** the project page; both steps greyed and struck through.
10. Untick "Paint the patch", then tick it again. **Expect:** the same pop-up. Tap **Mark Done**. **Expect:** Status shows Done.
11. Go to the dashboard. **Expect:** that project is no longer in "Project next steps".
12. Set another project to Active without adding steps, and open the dashboard. **Expect:** a row with the project's title and "No steps yet". Tick it. **Expect:** a pop-up "Mark (project title) Done?". Tap Not yet. **Expect:** the row is still there, unticked.
13. Back on a project page, open a step, tap **Remove** and confirm. **Expect:** the step is gone. Reload the page. **Expect:** it stays gone, and the other steps and their ticks are as you left them.
14. In a step's estimate, type `1.5` and tap elsewhere. **Expect:** a red line "Estimate must be a whole number of minutes from 1 to 9999" and the field returns to its previous value.
