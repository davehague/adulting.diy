# Home Projects Slice 3a (Providers on a Project) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a household link providers from its directory to a home project, each link with its own status (considering, contacted, chosen, passed), found through a category-first picker.

**Architecture:** One new table (`project_providers`) and one new column (`projects.providerCategoryId`) behind a new `ProjectProviderService` and four new Nitro routes. The project detail, project list and provider detail responses each gain one additive field. Two new Vue components (the Providers section on the project page and its in-place picker); the picker reuses the existing `GET /api/providers` and `GET /api/provider-categories`.

**Tech Stack:** Nuxt 3 / Vue 3 `<script setup>` / TypeScript, Nitro (h3), Prisma 5 on CockroachDB, Zod 3, Tailwind, lucide-vue-next, Vitest with mocked Prisma.

**Spec:** `docs/superpowers/specs/2026-10-04-projects-providers-design.md`. Read it before starting any task.

## Execution rules (set by David)

- Subagent-driven development: one implementer per task, an independent reviewer after each task, a fix round when the reviewer finds problems, and a final whole-branch review.
- Implementer subagents run on **Sonnet** (`model: "sonnet"`). Reviewer subagents, including the final whole-branch review and any re-review, run on **Opus** (`model: "opus"`). Every reviewer writes its full report to a file in `.superpowers/sdd/2026-10-04-projects-providers/` and replies with a short summary only.
- Work in the main checkout on branch `feat/project-providers` (already created; the spec and this plan are committed on it). Do **not** use git worktrees: a symlinked `node_modules` breaks this repo's Vitest setup. Tasks run one at a time.
- Commit with explicit paths only. Never `git add -A` or `git add .`; `.claude/settings.local.json` is modified locally and must not be committed.
- **Local dev uses the production database.** No task may run `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, a seed or db script, or the dev server. `npx prisma validate`, `npx prisma generate` and `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` are safe (they do not contact the database).
- These need David's explicit go-ahead and are done by the controller, never by a subagent: applying the migration, any `git push`, any merge.
- The commit trailer is in the workspace's `standing-rules.md`, not here, because the session URL can change.
- Code style (CLAUDE.md): explicit TypeScript types, no `any`, arrow functions, `import { type X }`, camelCase and PascalCase. Match the comment density of neighbouring files. Markdown: never hard-wrap prose.
- The screens cannot be run. Implementers of Tasks 5 and 6 write a hand trace in their report (what happens on each tap, in order, including a failed save and two quick taps), and their reviewers write their own.
- When reporting, say plainly what was only unit-tested and what was not exercised at all.

## Global Constraints

- Link statuses are exactly `considering`, `contacted`, `chosen`, `passed`. A new link is `considering`. Labels: Considering, Contacted, Chosen, Passed.
- Link order on a project: chosen, contacted, considering, passed; within a status, oldest link first.
- A link whose provider has `metaStatus` other than `active` is never returned, never counted toward the cap, and never named on a card. A link whose project is deleted never appears on a provider's page. Link rows are never deleted automatically.
- At most 25 visible links per project (`MAX_PROJECT_PROVIDERS`). The 26th returns 409 "This project already has 25 providers".
- Error messages: "Project not found" (404), "Provider not found" (404), "That provider is already on this project" (409), "That provider is not on this project" (404), "Unknown status" (400), "Provider is required" (400), "Unknown provider category" (400).
- Every link route requires the project to be in the caller's household and not deleted, and the provider to be in the caller's household and not removed.
- Every link write (`POST`, `PUT`, `DELETE`) returns the project's full, sorted list of links.
- Screen copy: section title "Providers"; category dropdown first option "No category"; "No phone on file"; "3 neighbors" / "1 neighbor" (nothing at zero); button "Add provider"; picker heading "What kind of provider?" when the project has no category; "No providers in this category"; "Every provider in this category is already linked"; "That's the maximum of 25 providers for a project."; "Add a provider category in Household > Provider settings to link providers."; remove confirmation "Remove {name} from this project? To keep a record that you considered them, set them to Passed instead."; card line "Chosen: {name}" or "Chosen: {name} +{n}"; provider page section "Projects" with "No projects linked."
- Everything is laid out for a 375 px wide screen first.
- Baselines measured 2026-10-04 on `feat/project-providers`: `npx vitest run` is 46 files, 725 tests, all passing. `npx nuxi typecheck` had 65 pre-existing errors at slice 2; Task 1 re-measures it, and no error may mention a file this plan creates or changes.

## Deviations from the spec's wording (same behaviour)

- `POST /api/projects/[id]/providers` returns 200 like the existing step routes, not 201.
- There is no `listForProvider` method. A provider's linked projects come from one extra include in `ProviderService.findById`, the same way its linked tasks do.

## Caller audit of shared code (done 2026-10-04 by grep; re-run in Task 3)

| Shared thing | Every caller | Why the change is safe |
|---|---|---|
| `ProjectDetail` | `server/services/ProjectService.ts`, `composables/useProjects.ts`, `pages/projects/[id].vue` | Two added fields; nothing destructures exhaustively or matches on shape |
| `ProjectListItem` | `server/services/ProjectService.ts`, `composables/useProjects.ts`, `pages/projects/index.vue` | One added field |
| `ProjectUpdateInput` / `projectUpdateSchema` | `server/api/projects/[id].put.ts`, `composables/useProjects.ts`, `pages/projects/[id].vue`, `tests/unit/utils/project-schemas.test.ts` | One added optional field |
| `ProviderDetail` / `ProviderService.findById` | `server/api/providers/[id].get.ts`, `composables/useProviders.ts`, `pages/providers/[id].vue` (`toInput` picks named fields) | One added field |
| `ProviderCategoryService.remove` | `server/api/provider-categories/[id].delete.ts` only | Signature unchanged; one more statement in the existing transaction |
| Test mocks | `tests/unit/services/project-service.test.ts` (`row()` fixture, prisma mock), `provider-category-service.test.ts` (prisma mock) | Updated in Task 3 |

Nothing matches on the text of an error this plan changes.

## Review Focus

Inputs and conditions the spec implies that are most likely to bite, each pinned by a test in the task that owns the code:

1. A project id or provider id from another household, or a removed provider: every service method returns 404 and writes nothing (Task 2 tests).
2. A phone number with an extension ("614-555-0101 x12") or letters: the tap-to-call link must not dial the extension as part of the number; an unusable number shows as plain text (Task 1 `telHref` tests).
3. A response from an older server build (mid-deploy) with no `providers`, `providerCategoryId`, `chosenProviderNames` or `projects`: treated as empty; nothing throws (Task 1 `chosenLine(undefined)` test; `?? []` guards in Tasks 5 and 6).
4. Two people linking the same provider at the same moment: the second gets the 409 message, not a 500 (Task 2 test "turns a unique-constraint race into 409").
5. A link row holding a status the code does not know (written by a later build): it sorts last and nothing throws (Task 1 `sortProviderLinks` test).

Known and accepted, not fixed here: a details save (title, notes) that was sent before a link change and returns after it replaces the page's project with a response that predates the change, so the list can show stale links until the next load. Slice 2 has the same gap for steps; it is logged in `docs/next-up.md`.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | 1 | `ProjectProvider` model, `Project.providerCategoryId`, relations |
| `prisma/migrations/20261004180000_add_project_providers/migration.sql` | 1 | Hand-written migration |
| `types/project.ts` | 1, 3 | Link statuses, cap, `ProjectProviderDto`; later the added response fields |
| `utils/project-providers.ts` | 1 | Labels, link order, card line, neighbor label, tel link, badge class |
| `server/utils/project-schemas.ts` | 1 | Link and status schemas, category on project update |
| `server/services/ProjectProviderService.ts` | 2 | list, link, setStatus, unlink |
| `server/services/ProjectService.ts` | 3 | Detail, list and update carry the new fields |
| `server/services/ProviderService.ts`, `types/provider.ts` | 3 | Provider detail carries linked projects |
| `server/services/ProviderCategoryService.ts` | 3 | Category delete moves projects |
| `server/api/projects/[id]/providers*.ts` | 4 | Routes |
| `composables/useProjects.ts` | 4 | Client calls |
| `components/projects/ProjectProviders.vue` | 5 | The section |
| `components/projects/ProjectProviderPicker.vue` | 5 | The picker |
| `pages/projects/[id].vue` | 5 | Mounts the section |
| `pages/projects/index.vue` | 6 | Card "Chosen:" line |
| `pages/providers/[id].vue` | 6 | Projects section |

Documentation is not a task: the controller runs the repo's `update-docs` skill after the final review.

---

### Task 1: Foundations (schema, migration, types, helpers, validation)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261004180000_add_project_providers/migration.sql`
- Modify: `types/project.ts`
- Create: `utils/project-providers.ts`
- Modify: `server/utils/project-schemas.ts`
- Test: `tests/unit/utils/project-providers.test.ts` (create), `tests/unit/utils/project-schemas.test.ts` (modify)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: Prisma model `ProjectProvider` (`prisma.projectProvider`), column `Project.providerCategoryId`; from `types/project.ts`: `PROJECT_PROVIDER_STATUSES`, `ProjectProviderStatus`, `MAX_PROJECT_PROVIDERS`, `ProjectProviderDto`, and `ProjectUpdateInput.providerCategoryId?: string | null`; from `utils/project-providers.ts`: `PROVIDER_LINK_STATUS_LABELS`, `sortProviderLinks`, `chosenLine`, `neighborLabel`, `telHref`, `linkStatusBadgeClass`; from `server/utils/project-schemas.ts`: `projectProviderLinkSchema`, `projectProviderStatusSchema`.

- [ ] **Step 1: Write the failing helper tests**

Create `tests/unit/utils/project-providers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  PROVIDER_LINK_STATUS_LABELS,
  chosenLine,
  neighborLabel,
  sortProviderLinks,
  telHref,
} from '@/utils/project-providers'
import { type ProjectProviderStatus } from '@/types/project'

const link = (id: string, status: string) => ({ id, status: status as ProjectProviderStatus })

describe('sortProviderLinks', () => {
  it('orders chosen, contacted, considering, passed', () => {
    const sorted = sortProviderLinks([link('a', 'passed'), link('b', 'considering'), link('c', 'chosen'), link('d', 'contacted')])
    expect(sorted.map((l) => l.id)).toEqual(['c', 'd', 'b', 'a'])
  })

  it('keeps the given order within a status', () => {
    const sorted = sortProviderLinks([link('old', 'considering'), link('x', 'chosen'), link('new', 'considering')])
    expect(sorted.map((l) => l.id)).toEqual(['x', 'old', 'new'])
  })

  it('puts an unknown status last without throwing', () => {
    const sorted = sortProviderLinks([link('odd', 'hired'), link('p', 'passed'), link('c', 'chosen')])
    expect(sorted.map((l) => l.id)).toEqual(['c', 'p', 'odd'])
  })

  it('does not change the array it was given', () => {
    const input = [link('a', 'passed'), link('b', 'chosen')]
    sortProviderLinks(input)
    expect(input.map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('chosenLine', () => {
  it('is null with no names, an empty list, or a missing list', () => {
    expect(chosenLine([])).toBeNull()
    expect(chosenLine(undefined)).toBeNull()
  })

  it('names a single chosen provider', () => {
    expect(chosenLine(['Acme Plumbing'])).toBe('Chosen: Acme Plumbing')
  })

  it('names the first and counts the rest', () => {
    expect(chosenLine(['Acme Plumbing', 'Tile Co'])).toBe('Chosen: Acme Plumbing +1')
    expect(chosenLine(['A', 'B', 'C'])).toBe('Chosen: A +2')
  })
})

describe('neighborLabel', () => {
  it('is null at zero', () => {
    expect(neighborLabel(0)).toBeNull()
  })

  it('uses the singular for one and the plural otherwise', () => {
    expect(neighborLabel(1)).toBe('1 neighbor')
    expect(neighborLabel(3)).toBe('3 neighbors')
  })
})

describe('telHref', () => {
  it('strips formatting', () => {
    expect(telHref('(614) 555-0101')).toBe('tel:6145550101')
    expect(telHref('+1 614.555.0101')).toBe('tel:+16145550101')
  })

  it('drops an extension instead of dialing it', () => {
    expect(telHref('614-555-0101 x12')).toBe('tel:6145550101')
    expect(telHref('614-555-0101 ext. 4')).toBe('tel:6145550101')
  })

  it('is null when there is no usable number', () => {
    expect(telHref(null)).toBeNull()
    expect(telHref('')).toBeNull()
    expect(telHref('call the office')).toBeNull()
    expect(telHref('555')).toBeNull()
  })
})

describe('PROVIDER_LINK_STATUS_LABELS', () => {
  it('has a label for each status', () => {
    expect(PROVIDER_LINK_STATUS_LABELS).toEqual({
      considering: 'Considering', contacted: 'Contacted', chosen: 'Chosen', passed: 'Passed',
    })
  })
})
```

- [ ] **Step 2: Write the failing schema tests**

In `tests/unit/utils/project-schemas.test.ts`, add `projectProviderLinkSchema` and `projectProviderStatusSchema` to the import from `@/server/utils/project-schemas`, and append:

```ts
describe('projectUpdateSchema provider category', () => {
  it('accepts a category id and null', () => {
    expect(projectUpdateSchema.parse({ providerCategoryId: 'c1' })).toEqual({ providerCategoryId: 'c1' })
    expect(projectUpdateSchema.parse({ providerCategoryId: null })).toEqual({ providerCategoryId: null })
  })

  it('leaves the category out when it is not sent', () => {
    expect('providerCategoryId' in projectUpdateSchema.parse({ status: 'active' })).toBe(false)
  })

  it('rejects an empty string and a non-string', () => {
    expect(projectUpdateSchema.safeParse({ providerCategoryId: '' }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({ providerCategoryId: 7 }).success).toBe(false)
  })
})

describe('projectProviderLinkSchema', () => {
  it('accepts a provider id', () => {
    expect(projectProviderLinkSchema.parse({ providerId: 'pr1' })).toEqual({ providerId: 'pr1' })
  })

  it('rejects a missing, empty or non-string provider id with the message', () => {
    for (const body of [{}, { providerId: '' }, { providerId: 5 }, null]) {
      const parsed = projectProviderLinkSchema.safeParse(body)
      expect(parsed.success).toBe(false)
    }
    const parsed = projectProviderLinkSchema.safeParse({})
    expect(parsed.success ? '' : parsed.error.issues[0].message).toBe('Provider is required')
  })
})

describe('projectProviderStatusSchema', () => {
  it('accepts each of the four statuses', () => {
    for (const status of ['considering', 'contacted', 'chosen', 'passed']) {
      expect(projectProviderStatusSchema.parse({ status })).toEqual({ status })
    }
  })

  it('rejects anything else with the message', () => {
    for (const body of [{ status: 'hired' }, { status: '' }, {}, { status: 3 }]) {
      const parsed = projectProviderStatusSchema.safeParse(body)
      expect(parsed.success ? '' : parsed.error.issues[0].message).toBe('Unknown status')
    }
  })
})
```

- [ ] **Step 3: Run both files and see them fail**

Run: `npx vitest run tests/unit/utils/project-providers.test.ts tests/unit/utils/project-schemas.test.ts`
Expected: FAIL. The first file cannot resolve `@/utils/project-providers`; the second fails on the missing exports.

- [ ] **Step 4: Add the types**

In `types/project.ts`, after the `MAX_STEP_ESTIMATE_MINUTES` line add:

```ts
export const PROJECT_PROVIDER_STATUSES = ['considering', 'contacted', 'chosen', 'passed'] as const;
export type ProjectProviderStatus = (typeof PROJECT_PROVIDER_STATUSES)[number];

export const MAX_PROJECT_PROVIDERS = 25;
```

After the `ProjectStepUpdateInput` interface add:

```ts
// A provider linked to a project. `status` is the link's own status, not the provider's household status.
export interface ProjectProviderDto {
  providerId: string;
  status: ProjectProviderStatus;
  provider: { id: string; name: string; phone: string | null; neighborCount: number };
}
```

In `ProjectUpdateInput` add the last line shown:

```ts
export interface ProjectUpdateInput {
  title?: string;
  location?: string | null;
  status?: ProjectStatus;
  path?: ProjectPath | null;
  notes?: string | null;
  providerCategoryId?: string | null;
}
```

Do not change `ProjectDetail` or `ProjectListItem` in this task; Task 3 does that together with the service.

- [ ] **Step 5: Add the helpers**

Create `utils/project-providers.ts`:

```ts
import { type ProjectProviderStatus } from '@/types/project';

export const PROVIDER_LINK_STATUS_LABELS: Record<ProjectProviderStatus, string> = {
  considering: 'Considering',
  contacted: 'Contacted',
  chosen: 'Chosen',
  passed: 'Passed',
};

const LINK_STATUS_ORDER: Record<ProjectProviderStatus, number> = { chosen: 0, contacted: 1, considering: 2, passed: 3 };

// A status this build does not know (written by a later one) sorts after the known ones.
const orderOf = (status: string): number => LINK_STATUS_ORDER[status as ProjectProviderStatus] ?? 99;

// Array.prototype.sort is stable, so links given oldest-first stay oldest-first within a status.
export const sortProviderLinks = <T extends { status: string }>(links: T[]): T[] =>
  [...links].sort((a, b) => orderOf(a.status) - orderOf(b.status));

// The line on a project card. `names` may be missing in a response from an older server build.
export const chosenLine = (names: string[] | undefined): string | null => {
  if (!names || names.length === 0) return null;
  return names.length === 1 ? `Chosen: ${names[0]}` : `Chosen: ${names[0]} +${names.length - 1}`;
};

export const neighborLabel = (count: number): string | null =>
  count > 0 ? `${count} neighbor${count === 1 ? '' : 's'}` : null;

// A tap-to-call link. Everything from the first letter on is dropped, so "x12" is never dialed as
// part of the number; a value with fewer than 7 digits is not treated as a phone number.
export const telHref = (phone: string | null): string | null => {
  if (!phone) return null;
  const dialable = phone.split(/[a-z]/i)[0].replace(/[^\d+]/g, '');
  return dialable.replace(/\D/g, '').length >= 7 ? `tel:${dialable}` : null;
};

export const linkStatusBadgeClass = (status: ProjectProviderStatus): string => {
  if (status === 'chosen') return 'bg-green-100 text-green-800';
  if (status === 'contacted') return 'bg-amber-100 text-amber-800';
  return 'bg-stone-100 text-stone-700';
};
```

- [ ] **Step 6: Add the validation**

In `server/utils/project-schemas.ts`, add `PROJECT_PROVIDER_STATUSES` to the import from `@/types/project`. Add `providerCategoryId` to `projectUpdateSchema` so it reads:

```ts
export const projectUpdateSchema = z.object({
  title: title.optional(),
  location,
  status: z.enum(PROJECT_STATUSES, { message: 'Unknown status' }).optional(),
  path: z.enum(PROJECT_PATHS, { message: 'Unknown path' }).nullable().optional(),
  notes,
  providerCategoryId: z
    .string({ invalid_type_error: 'Unknown provider category' })
    .min(1, 'Unknown provider category')
    .nullable()
    .optional(),
});
```

After `stepUpdateSchema` add:

```ts
export const projectProviderLinkSchema = z.object(
  {
    providerId: z
      .string({ required_error: 'Provider is required', invalid_type_error: 'Provider is required' })
      .min(1, 'Provider is required'),
  },
  { required_error: 'Provider is required', invalid_type_error: 'Provider is required' },
);

export const projectProviderStatusSchema = z.object({
  status: z.enum(PROJECT_PROVIDER_STATUSES, { message: 'Unknown status' }),
});
```

- [ ] **Step 7: Run both test files and see them pass**

Run: `npx vitest run tests/unit/utils/project-providers.test.ts tests/unit/utils/project-schemas.test.ts`
Expected: PASS. If the "Unknown status" message test fails for the `{}` body because Zod reports "Required" for a missing enum value, change the enum's options to `{ required_error: 'Unknown status', invalid_type_error: 'Unknown status', message: 'Unknown status' }` and say so in the report.

- [ ] **Step 8: Change the Prisma schema**

In `prisma/schema.prisma`:

In `model User`, directly under the line `projectSteps ProjectStep[] @relation("ProjectStepCreatedBy")`, add (align the columns with the neighbouring lines):

```prisma
  projectProviders       ProjectProvider[]       @relation("ProjectProviderCreatedBy")
```

In `model ProviderCategory`, under `providers Provider[]`, add:

```prisma
  projects    Project[]
```

In `model Provider`, under `tasks TaskProvider[]`, add:

```prisma
  projects           ProjectProvider[]
```

In `model Project`, under the `createdById String` line, add the first two lines, and under `steps ProjectStep[]` add the third:

```prisma
  providerCategory   ProviderCategory? @relation(fields: [providerCategoryId], references: [id], onDelete: SetNull)
  providerCategoryId String?           // the kind of provider this project needs; the picker starts here
```

```prisma
  providers   ProjectProvider[]
```

After `model ProjectStep { ... }` add:

```prisma
// A provider linked to a home project, with a per-project status
model ProjectProvider {
  id          String   @id @default(uuid())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String
  provider    Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  providerId  String
  status      String   @default("considering") // considering, contacted, chosen, passed
  createdBy   User     @relation("ProjectProviderCreatedBy", fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, providerId])
  @@index([providerId])
  @@map("project_providers")
}
```

- [ ] **Step 9: Write the migration by hand**

Create `prisma/migrations/20261004180000_add_project_providers/migration.sql`:

```sql
-- "projects" was unlocked by its own migration (20261003120000_add_projects); repeating it is harmless and makes this file safe on its own.
ALTER TABLE "projects" SET (schema_locked = false);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "providerCategoryId" STRING;

-- CreateTable
CREATE TABLE "project_providers" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "providerId" STRING NOT NULL,
    "status" STRING NOT NULL DEFAULT 'considering',
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_providers_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "project_providers" SET (schema_locked = false);

-- CreateIndex
CREATE INDEX "project_providers_providerId_idx" ON "project_providers"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "project_providers_projectId_providerId_key" ON "project_providers"("projectId", "providerId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_providerCategoryId_fkey" FOREIGN KEY ("providerCategoryId") REFERENCES "provider_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 10: Check the schema and the migration offline**

Run: `npx prisma validate` then `npx prisma generate`
Expected: both succeed.

Run: `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script 2>&1 | grep -n "project_providers\|providerCategoryId"`
Expected: the output contains the `project_providers` CREATE TABLE with the same seven columns, both indexes with the same names, the three `project_providers_*_fkey` constraints, the `"providerCategoryId" STRING` column on `projects`, and `projects_providerCategoryId_fkey` with `ON DELETE SET NULL`. Compare each against the hand-written file (names, column types, ON DELETE and ON UPDATE actions) and paste the grep output into the report. Any difference other than statement order, the `schema_locked` lines, and ADD COLUMN versus an inline column is a defect to fix.

- [ ] **Step 11: Measure the typecheck baseline and run the suite**

Run: `npx nuxi typecheck 2>&1 | tail -5` and record the error count in the report; confirm no error names a file this task touched (`grep -c "project-providers\|project-schemas\|types/project" ` on the output must be 0).

Run: `npx vitest run`
Expected: all files pass (725 previous tests plus the new ones).

- [ ] **Step 12: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261004180000_add_project_providers/migration.sql types/project.ts utils/project-providers.ts server/utils/project-schemas.ts tests/unit/utils/project-providers.test.ts tests/unit/utils/project-schemas.test.ts
git commit -m "feat: schema, migration, types and helpers for providers on a project"
```

(Append the trailer from `standing-rules.md` to the message.)

---

### Task 2: ProjectProviderService

**Files:**
- Create: `server/services/ProjectProviderService.ts`
- Test: `tests/unit/services/project-provider-service.test.ts` (create)

**Interfaces:**
- Consumes (Task 1): `prisma.projectProvider`; `MAX_PROJECT_PROVIDERS`, `PROJECT_PROVIDER_STATUSES`, `ProjectProviderDto`, `ProjectProviderStatus` from `@/types/project`; `sortProviderLinks` from `@/utils/project-providers`. Existing: `summarizeEvidence(evidence: { kind: string; sourceDate: Date | null }[])` from `@/server/utils/provider-evidence` (returns `{ mentionCount, neighborCount, lastSightingAt }`), `HttpError(message, statusCode)` from `@/server/utils/api-errors`.
- Produces: `visibleLinkWhere`, `linkOrder`, `linkSelect`, `toProviderLinks(rows): ProjectProviderDto[]`, and class `ProjectProviderService` with `listForProject(householdId, projectId)`, `link(householdId, userId, projectId, providerId)`, `setStatus(householdId, projectId, providerId, status)`, `unlink(householdId, projectId, providerId)`, each returning `Promise<ProjectProviderDto[]>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/services/project-provider-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    provider: { findFirst: vi.fn() },
    projectProvider: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectProviderService, toProviderLinks } from '@/server/services/ProjectProviderService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const linkRow = (providerId: string, status: string, overrides: Record<string, unknown> = {}) => ({
  providerId,
  status,
  provider: { id: providerId, name: `Provider ${providerId}`, phone: null, evidence: [], ...overrides },
})

describe('toProviderLinks', () => {
  it('maps a row, counting only neighbor recommendations', () => {
    const [dto] = toProviderLinks([
      linkRow('pr1', 'chosen', {
        phone: '614-555-0101',
        evidence: [
          { kind: 'third_party', sourceDate: null },
          { kind: 'third_party', sourceDate: null },
          { kind: 'self_promo', sourceDate: null },
          { kind: 'lead', sourceDate: null },
        ],
      }),
    ])
    expect(dto).toEqual({
      providerId: 'pr1',
      status: 'chosen',
      provider: { id: 'pr1', name: 'Provider pr1', phone: '614-555-0101', neighborCount: 2 },
    })
  })

  it('orders by status, keeping the given order within a status', () => {
    const dtos = toProviderLinks([
      linkRow('a', 'considering'), linkRow('b', 'passed'), linkRow('c', 'chosen'), linkRow('d', 'considering'), linkRow('e', 'contacted'),
    ])
    expect(dtos.map((d) => d.providerId)).toEqual(['c', 'e', 'a', 'd', 'b'])
  })

  it('returns an empty list for no rows', () => {
    expect(toProviderLinks([])).toEqual([])
  })
})

describe('ProjectProviderService', () => {
  let service: ProjectProviderService
  beforeEach(() => {
    service = new ProjectProviderService()
    vi.clearAllMocks()
    db.project.findFirst.mockResolvedValue({ id: 'p1' })
    db.provider.findFirst.mockResolvedValue({ id: 'pr1' })
    db.projectProvider.findMany.mockResolvedValue([])
    db.projectProvider.findFirst.mockResolvedValue({ id: 'l1' })
  })

  const expectProjectScoped = () =>
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })

  describe('listForProject', () => {
    it('returns 404 for a project in another household or a deleted one', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.listForProject('h1', 'p1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expectProjectScoped()
      expect(db.projectProvider.findMany).not.toHaveBeenCalled()
    })

    it('reads only links whose provider is not removed, oldest first', async () => {
      await service.listForProject('h1', 'p1')
      const args = db.projectProvider.findMany.mock.calls[0][0]
      expect(args.where).toEqual({ projectId: 'p1', provider: { metaStatus: 'active' } })
      expect(args.orderBy).toEqual({ createdAt: 'asc' })
    })

    it('returns the links sorted by status', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('a', 'passed'), linkRow('b', 'chosen')])
      const result = await service.listForProject('h1', 'p1')
      expect(result.map((l) => l.providerId)).toEqual(['b', 'a'])
    })
  })

  describe('link', () => {
    it('returns 404 and writes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('returns 404 and writes nothing for a provider in another household or a removed one', async () => {
      db.provider.findFirst.mockResolvedValue(null)
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({ statusCode: 404, message: 'Provider not found' })
      expect(db.provider.findFirst.mock.calls[0][0].where).toEqual({ id: 'pr1', householdId: 'h1', metaStatus: 'active' })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('rejects a provider that is already linked with 409 and writes nothing', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('pr1', 'passed')])
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 409, message: 'That provider is already on this project',
      })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('rejects the 26th link with 409 and writes nothing', async () => {
      db.projectProvider.findMany.mockResolvedValue(Array.from({ length: 25 }, (_, i) => linkRow(`other-${i}`, 'considering')))
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 409, message: 'This project already has 25 providers',
      })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('allows the 25th link', async () => {
      db.projectProvider.findMany.mockResolvedValue(Array.from({ length: 24 }, (_, i) => linkRow(`other-${i}`, 'considering')))
      await service.link('h1', 'u1', 'p1', 'pr1')
      expect(db.projectProvider.create).toHaveBeenCalledTimes(1)
    })

    it('counts only links whose provider is not removed toward the cap', async () => {
      await service.link('h1', 'u1', 'p1', 'pr1')
      expect(db.projectProvider.findMany.mock.calls[0][0].where).toEqual({ projectId: 'p1', provider: { metaStatus: 'active' } })
    })

    it('creates the link without a status, so the column default (considering) applies', async () => {
      await service.link('h1', 'u1', 'p1', 'pr1')
      expect(db.projectProvider.create.mock.calls[0][0].data).toEqual({ projectId: 'p1', providerId: 'pr1', createdById: 'u1' })
    })

    it('returns the full list read after the write', async () => {
      db.projectProvider.findMany
        .mockResolvedValueOnce([linkRow('a', 'chosen')])
        .mockResolvedValueOnce([linkRow('pr1', 'considering'), linkRow('a', 'chosen')])
      const result = await service.link('h1', 'u1', 'p1', 'pr1')
      expect(result.map((l) => l.providerId)).toEqual(['a', 'pr1'])
    })

    it('turns a unique-constraint race into 409', async () => {
      db.projectProvider.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 409, message: 'That provider is already on this project',
      })
    })

    it('rethrows any other create failure unchanged', async () => {
      const failure = new Error('connection lost')
      db.projectProvider.create.mockRejectedValue(failure)
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toBe(failure)
    })
  })

  describe('setStatus', () => {
    it('returns 404 and writes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.setStatus('h1', 'p1', 'pr1', 'chosen')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectProvider.update).not.toHaveBeenCalled()
    })

    it('returns 404 and writes nothing when the provider is not linked or has been removed', async () => {
      db.projectProvider.findFirst.mockResolvedValue(null)
      await expect(service.setStatus('h1', 'p1', 'pr1', 'chosen')).rejects.toMatchObject({
        statusCode: 404, message: 'That provider is not on this project',
      })
      expect(db.projectProvider.findFirst.mock.calls[0][0].where).toEqual({
        projectId: 'p1', providerId: 'pr1', provider: { metaStatus: 'active' },
      })
      expect(db.projectProvider.update).not.toHaveBeenCalled()
    })

    it('rejects an unknown status with 400 before reading anything', async () => {
      await expect(service.setStatus('h1', 'p1', 'pr1', 'hired' as never)).rejects.toMatchObject({ statusCode: 400, message: 'Unknown status' })
      expect(db.project.findFirst).not.toHaveBeenCalled()
      expect(db.projectProvider.update).not.toHaveBeenCalled()
    })

    it('updates the link by its id and returns the full list', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('pr1', 'chosen')])
      const result = await service.setStatus('h1', 'p1', 'pr1', 'chosen')
      expect(db.projectProvider.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { status: 'chosen' } })
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('chosen')
    })

    it('lets more than one provider be chosen (it changes only the named link)', async () => {
      await service.setStatus('h1', 'p1', 'pr1', 'chosen')
      expect(db.projectProvider.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('unlink', () => {
    it('returns 404 and deletes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.unlink('h1', 'p1', 'pr1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectProvider.delete).not.toHaveBeenCalled()
    })

    it('returns 404 and deletes nothing when the provider is not linked', async () => {
      db.projectProvider.findFirst.mockResolvedValue(null)
      await expect(service.unlink('h1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 404, message: 'That provider is not on this project',
      })
      expect(db.projectProvider.delete).not.toHaveBeenCalled()
    })

    it('deletes the link by its id and returns the remaining list', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('other', 'considering')])
      const result = await service.unlink('h1', 'p1', 'pr1')
      expect(db.projectProvider.delete).toHaveBeenCalledWith({ where: { id: 'l1' } })
      expect(result.map((l) => l.providerId)).toEqual(['other'])
    })
  })
})
```

- [ ] **Step 2: Run the file and see it fail**

Run: `npx vitest run tests/unit/services/project-provider-service.test.ts`
Expected: FAIL, cannot resolve `@/server/services/ProjectProviderService`.

- [ ] **Step 3: Write the service**

Create `server/services/ProjectProviderService.ts`:

```ts
import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { summarizeEvidence } from '@/server/utils/provider-evidence';
import {
  MAX_PROJECT_PROVIDERS,
  PROJECT_PROVIDER_STATUSES,
  type ProjectProviderDto,
  type ProjectProviderStatus,
} from '@/types/project';
import { sortProviderLinks } from '@/utils/project-providers';

// A link whose provider has been removed is kept, but never shown or counted.
export const visibleLinkWhere = { provider: { metaStatus: 'active' } } satisfies Prisma.ProjectProviderWhereInput;

export const linkOrder = { createdAt: 'asc' } satisfies Prisma.ProjectProviderOrderByWithRelationInput;

export const linkSelect = {
  providerId: true,
  status: true,
  provider: {
    select: { id: true, name: true, phone: true, evidence: { select: { kind: true, sourceDate: true } } },
  },
} satisfies Prisma.ProjectProviderSelect;

type LinkRow = Prisma.ProjectProviderGetPayload<{ select: typeof linkSelect }>;

const ALREADY_LINKED = 'That provider is already on this project';

// Rows must arrive oldest-first (linkOrder); the sort then groups them by status.
export const toProviderLinks = (rows: LinkRow[]): ProjectProviderDto[] =>
  sortProviderLinks(
    rows.map((row) => ({
      providerId: row.providerId,
      status: row.status as ProjectProviderStatus,
      provider: {
        id: row.provider.id,
        name: row.provider.name,
        phone: row.provider.phone,
        neighborCount: summarizeEvidence(row.provider.evidence).neighborCount,
      },
    })),
  );

export class ProjectProviderService {
  async listForProject(householdId: string, projectId: string): Promise<ProjectProviderDto[]> {
    await this.requireProject(householdId, projectId);
    return this.links(projectId);
  }

  async link(householdId: string, userId: string, projectId: string, providerId: string): Promise<ProjectProviderDto[]> {
    await this.requireProject(householdId, projectId);
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!provider) throw new HttpError('Provider not found', 404);

    // The provider is not removed, so a link to it, if there is one, is among the visible links.
    const existing = await this.links(projectId);
    if (existing.some((link) => link.providerId === providerId)) throw new HttpError(ALREADY_LINKED, 409);
    if (existing.length >= MAX_PROJECT_PROVIDERS) {
      throw new HttpError(`This project already has ${MAX_PROJECT_PROVIDERS} providers`, 409);
    }

    try {
      await prisma.projectProvider.create({ data: { projectId, providerId, createdById: userId } });
    } catch (error) {
      // Two people linking the same provider at once: the unique index stops the second.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new HttpError(ALREADY_LINKED, 409);
      }
      throw error;
    }
    return this.links(projectId);
  }

  async setStatus(
    householdId: string,
    projectId: string,
    providerId: string,
    status: ProjectProviderStatus,
  ): Promise<ProjectProviderDto[]> {
    if (!(PROJECT_PROVIDER_STATUSES as readonly string[]).includes(status)) throw new HttpError('Unknown status', 400);
    await this.requireProject(householdId, projectId);
    const link = await this.requireLink(projectId, providerId);
    await prisma.projectProvider.update({ where: { id: link.id }, data: { status } });
    return this.links(projectId);
  }

  async unlink(householdId: string, projectId: string, providerId: string): Promise<ProjectProviderDto[]> {
    await this.requireProject(householdId, projectId);
    const link = await this.requireLink(projectId, providerId);
    await prisma.projectProvider.delete({ where: { id: link.id } });
    return this.links(projectId);
  }

  private async links(projectId: string): Promise<ProjectProviderDto[]> {
    const rows = await prisma.projectProvider.findMany({
      where: { projectId, ...visibleLinkWhere },
      orderBy: linkOrder,
      select: linkSelect,
    });
    return toProviderLinks(rows);
  }

  private async requireProject(householdId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);
  }

  // The project has already been checked against the household, and a link can only be made to a
  // provider of the same household, so the project id is enough to scope this.
  private async requireLink(projectId: string, providerId: string): Promise<{ id: string }> {
    const link = await prisma.projectProvider.findFirst({
      where: { projectId, providerId, ...visibleLinkWhere },
      select: { id: true },
    });
    if (!link) throw new HttpError('That provider is not on this project', 404);
    return link;
  }
}
```

- [ ] **Step 4: Run the file and see it pass**

Run: `npx vitest run tests/unit/services/project-provider-service.test.ts`
Expected: PASS, every test.

- [ ] **Step 5: Run the full suite and commit**

Run: `npx vitest run`
Expected: all files pass.

```bash
git add server/services/ProjectProviderService.ts tests/unit/services/project-provider-service.test.ts
git commit -m "feat: ProjectProviderService"
```

---

### Task 3: The shared services (project detail, list and update; provider detail; category delete)

**Files:**
- Modify: `types/project.ts`, `types/provider.ts`
- Modify: `server/services/ProjectService.ts`, `server/services/ProviderService.ts`, `server/services/ProviderCategoryService.ts`
- Test (modify): `tests/unit/services/project-service.test.ts`, `tests/unit/services/provider-service.test.ts`, `tests/unit/services/provider-category-service.test.ts`

**Interfaces:**
- Consumes (Task 1): `ProjectProviderDto`, `ProjectProviderStatus`, `ProjectUpdateInput.providerCategoryId`. (Task 2): `visibleLinkWhere`, `linkOrder`, `linkSelect`, `toProviderLinks` from `@/server/services/ProjectProviderService`.
- Produces: `ProjectDetail.providerCategoryId: string | null`, `ProjectDetail.providers: ProjectProviderDto[]`, `ProjectListItem.chosenProviderNames: string[]`, `ProviderDetail.projects: { status: ProjectProviderStatus; project: { id: string; title: string; status: ProjectStatus } }[]`. `PUT /api/projects/[id]` now accepts `providerCategoryId` with no route change.

- [ ] **Step 1: Re-run the caller audit**

Run:

```bash
grep -rn "ProjectDetail\|ProjectListItem\|ProviderDetail\|ProjectUpdateInput\|projectUpdateSchema\|ProviderCategoryService\|findById(" --include="*.ts" --include="*.vue" . | grep -v node_modules | grep -v "^./.nuxt\|^./.output\|^./docs"
```

Compare the result with the "Caller audit" table at the top of this plan. If a caller appears that the table does not list, or any caller matches on the text of an error or the exact shape of one of these objects, stop and report NEEDS_CONTEXT with the lines. Paste the output into the report.

- [ ] **Step 2: Write the failing tests**

In `tests/unit/services/project-service.test.ts`:

Change the prisma mock to add `providerCategory`:

```ts
vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    providerCategory: { findFirst: vi.fn() },
  },
}))
```

In the `row()` fixture add two lines after `steps: [],`:

```ts
  providerCategoryId: null,
  providers: [],
```

Append these inside the top-level `describe('ProjectService', ...)`:

```ts
  describe('providers on a project', () => {
    const chosen = (name: string) => ({ provider: { name } })
    const linkRow = (providerId: string, status: string) => ({
      providerId, status, provider: { id: providerId, name: `Provider ${providerId}`, phone: null, evidence: [] },
    })

    it('list asks only for chosen links of providers that are not removed, oldest first', async () => {
      db.project.findMany.mockResolvedValue([])
      await service.list('h1', {})
      expect(db.project.findMany.mock.calls[0][0].include.providers).toEqual({
        where: { status: 'chosen', provider: { metaStatus: 'active' } },
        orderBy: { createdAt: 'asc' },
        select: { provider: { select: { name: true } } },
      })
    })

    it('list reports chosen provider names in order, and an empty list when there are none', async () => {
      db.project.findMany.mockResolvedValue([
        row({ providers: [chosen('Acme Plumbing'), chosen('Tile Co')] }),
        row({ id: 'p2' }),
      ])
      const [withChosen, without] = await service.list('h1', {})
      expect(withChosen.chosenProviderNames).toEqual(['Acme Plumbing', 'Tile Co'])
      expect(without.chosenProviderNames).toEqual([])
    })

    it('get asks only for links of providers that are not removed, oldest first', async () => {
      db.project.findFirst.mockResolvedValue(row())
      await service.get('h1', 'p1')
      const providers = db.project.findFirst.mock.calls[0][0].include.providers
      expect(providers.where).toEqual({ provider: { metaStatus: 'active' } })
      expect(providers.orderBy).toEqual({ createdAt: 'asc' })
    })

    it('get carries the saved category and the links sorted by status', async () => {
      db.project.findFirst.mockResolvedValue(row({
        providerCategoryId: 'c1',
        providers: [linkRow('a', 'considering'), linkRow('b', 'chosen')],
      }))
      const detail = await service.get('h1', 'p1')
      expect(detail.providerCategoryId).toBe('c1')
      expect(detail.providers.map((l) => l.providerId)).toEqual(['b', 'a'])
    })

    it('get reports no category and no links on a project that has neither', async () => {
      db.project.findFirst.mockResolvedValue(row())
      const detail = await service.get('h1', 'p1')
      expect(detail.providerCategoryId).toBeNull()
      expect(detail.providers).toEqual([])
    })

    it('update saves a category that belongs to the household', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.providerCategory.findFirst.mockResolvedValue({ id: 'c1' })
      db.project.update.mockResolvedValue(row({ providerCategoryId: 'c1' }))
      const detail = await service.update('h1', 'p1', { providerCategoryId: 'c1' })
      expect(db.providerCategory.findFirst.mock.calls[0][0].where).toEqual({ id: 'c1', householdId: 'h1' })
      expect(db.project.update.mock.calls[0][0].data).toEqual({ providerCategoryId: 'c1' })
      expect(detail.providerCategoryId).toBe('c1')
    })

    it('update rejects a category from another household with 400 and writes nothing', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.providerCategory.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'p1', { providerCategoryId: 'theirs' })).rejects.toMatchObject({
        statusCode: 400, message: 'Unknown provider category',
      })
      expect(db.project.update).not.toHaveBeenCalled()
    })

    it('update clears the category without looking one up', async () => {
      db.project.findFirst.mockResolvedValue(row({ providerCategoryId: 'c1' }))
      db.project.update.mockResolvedValue(row())
      await service.update('h1', 'p1', { providerCategoryId: null })
      expect(db.providerCategory.findFirst).not.toHaveBeenCalled()
      expect(db.project.update.mock.calls[0][0].data).toEqual({ providerCategoryId: null })
    })

    it('update leaves the category alone when it is not sent', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.project.update.mockResolvedValue(row({ title: 'New' }))
      await service.update('h1', 'p1', { title: 'New' })
      expect('providerCategoryId' in db.project.update.mock.calls[0][0].data).toBe(false)
    })
  })
```

In `tests/unit/services/provider-service.test.ts`, append at the end of the file:

```ts
describe('ProviderService.findById projects', () => {
  let service: ProviderService
  beforeEach(() => { service = new ProviderService(); vi.clearAllMocks() })

  const detailRow = (over: Record<string, unknown> = {}) => ({
    ...row({ id: 'pr1' }), contacts: [], comments: [], tasks: [], projects: [], ...over,
  })

  it('asks for links to projects that are not deleted, newest link first', async () => {
    db.provider.findFirst.mockResolvedValue(detailRow())
    await service.findById('h1', 'pr1')
    expect(db.provider.findFirst.mock.calls[0][0].include.projects).toEqual({
      where: { project: { metaStatus: 'active' } },
      orderBy: { createdAt: 'desc' },
      select: { status: true, project: { select: { id: true, title: true, status: true } } },
    })
  })

  it('returns the linked projects with each link status', async () => {
    const projects = [{ status: 'chosen', project: { id: 'p1', title: 'Deck', status: 'done' } }]
    db.provider.findFirst.mockResolvedValue(detailRow({ projects }))
    const detail = await service.findById('h1', 'pr1')
    expect(detail.projects).toEqual(projects)
  })

  it('still scopes the provider to the household and hides removed ones', async () => {
    db.provider.findFirst.mockResolvedValue(null)
    await expect(service.findById('h1', 'pr1')).rejects.toMatchObject({ statusCode: 404 })
    expect(db.provider.findFirst.mock.calls[0][0].where).toEqual({ id: 'pr1', householdId: 'h1', metaStatus: 'active' })
  })
})
```

In `tests/unit/services/provider-category-service.test.ts`, add `project: { updateMany: vi.fn() },` to the prisma mock (next to `provider`), add `project: Record<string, ReturnType<typeof vi.fn>>` to the `db` type, and add after the test "moves providers then deletes when moveToId is given":

```ts
  it('moves projects saved with the category to the replacement, before the delete', async () => {
    db.providerCategory.findFirst
      .mockResolvedValueOnce({ id: 'c1', householdId: 'h1' })
      .mockResolvedValueOnce({ id: 'c2', householdId: 'h1' })
    db.provider.count.mockResolvedValue(3)
    await service.remove('h1', 'c1', 'c2')
    expect(db.project.updateMany).toHaveBeenCalledWith({
      where: { householdId: 'h1', providerCategoryId: 'c1' },
      data: { providerCategoryId: 'c2' },
    })
    expect(db.project.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(db.providerCategory.delete.mock.invocationCallOrder[0])
  })

  it('does not touch projects when no provider uses the category (the foreign key clears them)', async () => {
    db.providerCategory.findFirst.mockResolvedValue({ id: 'c1', householdId: 'h1' })
    db.provider.count.mockResolvedValue(0)
    await service.remove('h1', 'c1')
    expect(db.project.updateMany).not.toHaveBeenCalled()
    expect(db.providerCategory.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })
```

- [ ] **Step 3: Run the three files and see the new tests fail**

Run: `npx vitest run tests/unit/services/project-service.test.ts tests/unit/services/provider-service.test.ts tests/unit/services/provider-category-service.test.ts`
Expected: the new tests FAIL (missing `include.providers`, `chosenProviderNames`, `include.projects`, `project.updateMany` not called); every pre-existing test still passes.

- [ ] **Step 4: Change the types**

In `types/project.ts`, `ProjectListItem` gains a last field and `ProjectDetail` gains two:

```ts
export interface ProjectListItem {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  photoCount: number;
  coverPhotoId: string | null;
  photoIds: string[];
  // names of the providers marked chosen on this project, in the order they were linked
  chosenProviderNames: string[];
}

export interface ProjectDetail {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  notes: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  // the kind of provider this project needs; null means not chosen yet
  providerCategoryId: string | null;
  photos: ProjectPhotoDto[];
  steps: ProjectStepDto[];
  providers: ProjectProviderDto[];
}
```

In `types/provider.ts`, add at the top `import { type ProjectProviderStatus, type ProjectStatus } from '@/types/project';` and in `ProviderDetail`, after the `tasks` line:

```ts
  projects: { status: ProjectProviderStatus; project: { id: string; title: string; status: ProjectStatus } }[];
```

- [ ] **Step 5: Change `ProjectService`**

In `server/services/ProjectService.ts`:

Add the import:

```ts
import { linkOrder, linkSelect, toProviderLinks, visibleLinkWhere } from '@/server/services/ProjectProviderService';
```

`detailInclude` becomes:

```ts
const detailInclude = {
  photos: {
    orderBy: { position: 'asc' },
    select: { id: true, width: true, height: true, position: true },
  },
  steps: { orderBy: stepOrder, select: stepSelect },
  providers: { where: visibleLinkWhere, orderBy: linkOrder, select: linkSelect },
} satisfies Prisma.ProjectInclude;
```

`toDetail` becomes:

```ts
const toDetail = (project: ProjectWithPhotos): ProjectDetail => ({
  id: project.id,
  title: project.title,
  location: project.location,
  status: project.status as ProjectStatus,
  path: project.path as ProjectPath | null,
  notes: project.notes,
  completedAt: project.completedAt,
  createdAt: project.createdAt,
  providerCategoryId: project.providerCategoryId,
  photos: project.photos,
  steps: project.steps,
  providers: toProviderLinks(project.providers),
});
```

In `list`, the `findMany` include becomes:

```ts
      include: {
        photos: { orderBy: { position: 'asc' }, select: { id: true } },
        providers: {
          where: { status: 'chosen', ...visibleLinkWhere },
          orderBy: linkOrder,
          select: { provider: { select: { name: true } } },
        },
      },
```

and the mapped object gains a last line:

```ts
        chosenProviderNames: project.providers.map((link) => link.provider.name),
```

In `update`, change the type of `data` to the unchecked input (every field it sets is a scalar column) and add the category block after the `notes` line:

```ts
    const data: Prisma.ProjectUncheckedUpdateInput = {};
```

```ts
    if (input.providerCategoryId !== undefined) {
      if (input.providerCategoryId !== null) {
        const category = await prisma.providerCategory.findFirst({
          where: { id: input.providerCategoryId, householdId },
          select: { id: true },
        });
        if (!category) throw new HttpError('Unknown provider category', 400);
      }
      data.providerCategoryId = input.providerCategoryId;
    }
```

- [ ] **Step 6: Change `ProviderService.findById`**

In `server/services/ProviderService.ts`, inside the `include` of `findById`, after the `tasks` line add:

```ts
        // Links to deleted projects are kept but not shown.
        projects: {
          where: { project: { metaStatus: 'active' } },
          orderBy: { createdAt: 'desc' },
          select: { status: true, project: { select: { id: true, title: true, status: true } } },
        },
```

- [ ] **Step 7: Change `ProviderCategoryService.remove`**

In `server/services/ProviderCategoryService.ts`, the doc comment and the transaction become:

```ts
  /**
   * Delete a category. If providers use it, moveToId must name another category
   * in the same household; providers, and projects saved with the category, are
   * reassigned first. A category no provider uses is simply deleted, and the
   * foreign key clears it from any project saved with it.
   */
```

```ts
      await prisma.$transaction([
        prisma.provider.updateMany({
          where: { householdId, categoryId: id },
          data: { categoryId: moveToId },
        }),
        prisma.project.updateMany({
          where: { householdId, providerCategoryId: id },
          data: { providerCategoryId: moveToId },
        }),
        prisma.providerCategory.delete({ where: { id } }),
      ]);
```

- [ ] **Step 8: Run the three files and see them pass**

Run: `npx vitest run tests/unit/services/project-service.test.ts tests/unit/services/provider-service.test.ts tests/unit/services/provider-category-service.test.ts`
Expected: PASS, every test.

- [ ] **Step 9: Typecheck the touched files, run the suite, commit**

Run: `npx nuxi typecheck 2>&1 | grep -c "ProjectService\|ProviderService\|ProviderCategoryService\|types/project\|types/provider\|pages/projects\|pages/providers"`
Expected: `0` beyond any of these that Task 1's baseline already listed (name them in the report if there are any).

Run: `npx vitest run`
Expected: all files pass.

```bash
git add types/project.ts types/provider.ts server/services/ProjectService.ts server/services/ProviderService.ts server/services/ProviderCategoryService.ts tests/unit/services/project-service.test.ts tests/unit/services/provider-service.test.ts tests/unit/services/provider-category-service.test.ts
git commit -m "feat: project and provider responses carry provider links; category delete moves projects"
```

---

### Task 4: Routes and client calls

**Files:**
- Create: `server/api/projects/[id]/providers.get.ts`, `server/api/projects/[id]/providers.post.ts`, `server/api/projects/[id]/providers/[providerId].put.ts`, `server/api/projects/[id]/providers/[providerId].delete.ts`
- Modify: `composables/useProjects.ts`
- Test: `tests/unit/api/project-provider-routes.test.ts` (create)

**Interfaces:**
- Consumes (Task 2): `ProjectProviderService` methods `listForProject(householdId, projectId)`, `link(householdId, userId, projectId, providerId)`, `setStatus(householdId, projectId, providerId, status)`, `unlink(householdId, projectId, providerId)`. (Task 1): `projectProviderLinkSchema`, `projectProviderStatusSchema`, `ProjectProviderDto`, `ProjectProviderStatus`. Existing: `defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => ...)` from `@/server/utils/auth` (`authUser.userId`), `HttpError`, `toHttpError(error, context)` from `@/server/utils/api-errors`.
- Produces, from `useProjects()`: `listProjectProviders(projectId): Promise<ProjectProviderDto[]>`, `linkProvider(projectId, providerId): Promise<ProjectProviderDto[]>`, `setProviderLinkStatus(projectId, providerId, status): Promise<ProjectProviderDto[]>`, `unlinkProvider(projectId, providerId): Promise<unknown>`.

- [ ] **Step 1: Write the failing route tests**

Create `tests/unit/api/project-provider-routes.test.ts`. The harness copies `tests/unit/api/household-admin-routes.test.ts` (dev-bypass sign-in so the real auth wrapper runs); the service is mocked, because Task 2 tests it.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const service = vi.hoisted(() => ({
  listForProject: vi.fn(),
  link: vi.fn(),
  setStatus: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('@/server/services/ProjectProviderService', () => ({
  ProjectProviderService: vi.fn(() => service),
}))

// Sign in through the dev bypass so the real auth wrapper runs.
vi.mock('@/server/utils/dev-auth', () => ({
  devAuthService: {
    isDevBypassEnabled: () => true,
    getUserById: vi.fn(),
  },
}))

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { devAuthService } from '@/server/utils/dev-auth'
import { HttpError } from '@/server/utils/api-errors'
import listRoute from '@/server/api/projects/[id]/providers.get'
import linkRoute from '@/server/api/projects/[id]/providers.post'
import statusRoute from '@/server/api/projects/[id]/providers/[providerId].put'
import unlinkRoute from '@/server/api/projects/[id]/providers/[providerId].delete'

type Handler = (event: unknown) => Promise<unknown>

const call = (handler: unknown, userId: string | null, params: Record<string, string> = {}) =>
  (handler as Handler)({
    node: { req: { headers: userId ? { 'x-dev-user-id': userId } : {} } },
    context: { params },
  })

const links = [{ providerId: 'pr1', status: 'considering', provider: { id: 'pr1', name: 'Acme', phone: null, neighborCount: 0 } }]

describe('project provider routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(devAuthService.getUserById).mockImplementation((async (id: string) => {
      if (id === 'u1') return { id: 'u1', name: 'u1', email: 'u1@example.com', householdId: 'h1' }
      if (id === 'loner') return { id: 'loner', name: 'loner', email: 'loner@example.com', householdId: null }
      return null
    }) as never)
    service.listForProject.mockResolvedValue(links)
    service.link.mockResolvedValue(links)
    service.setStatus.mockResolvedValue(links)
    service.unlink.mockResolvedValue([])
  })

  describe('GET /api/projects/:id/providers', () => {
    it('lists for the caller household', async () => {
      await expect(call(listRoute, 'u1', { id: 'p1' })).resolves.toEqual(links)
      expect(service.listForProject).toHaveBeenCalledWith('h1', 'p1')
    })

    it('rejects a caller who is not signed in with 401', async () => {
      await expect(call(listRoute, null, { id: 'p1' })).rejects.toMatchObject({ statusCode: 401 })
      expect(service.listForProject).not.toHaveBeenCalled()
    })

    it('rejects a caller with no household with 403', async () => {
      await expect(call(listRoute, 'loner', { id: 'p1' })).rejects.toMatchObject({ statusCode: 403 })
      expect(service.listForProject).not.toHaveBeenCalled()
    })

    it('passes a service 404 through with its message', async () => {
      service.listForProject.mockRejectedValue(new HttpError('Project not found', 404))
      await expect(call(listRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
    })
  })

  describe('POST /api/projects/:id/providers', () => {
    it('links with the caller household and user id, and returns the list', async () => {
      vi.mocked(readBody).mockResolvedValue({ providerId: 'pr1' })
      await expect(call(linkRoute, 'u1', { id: 'p1' })).resolves.toEqual(links)
      expect(service.link).toHaveBeenCalledWith('h1', 'u1', 'p1', 'pr1')
    })

    it('rejects a body with no provider id with 400 and does not call the service', async () => {
      for (const body of [{}, { providerId: '' }, null, undefined]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(linkRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 400, message: 'Provider is required' })
      }
      expect(service.link).not.toHaveBeenCalled()
    })

    it('passes a service 409 through with its message', async () => {
      vi.mocked(readBody).mockResolvedValue({ providerId: 'pr1' })
      service.link.mockRejectedValue(new HttpError('That provider is already on this project', 409))
      await expect(call(linkRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({
        statusCode: 409, message: 'That provider is already on this project',
      })
    })

    it('hides an unexpected failure behind a 500', async () => {
      vi.mocked(readBody).mockResolvedValue({ providerId: 'pr1' })
      service.link.mockRejectedValue(new Error('connection lost'))
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      await expect(call(linkRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 500, message: 'Server error' })
      logged.mockRestore()
    })
  })

  describe('PUT /api/projects/:id/providers/:providerId', () => {
    it('sets the status and returns the list', async () => {
      vi.mocked(readBody).mockResolvedValue({ status: 'chosen' })
      await expect(call(statusRoute, 'u1', { id: 'p1', providerId: 'pr1' })).resolves.toEqual(links)
      expect(service.setStatus).toHaveBeenCalledWith('h1', 'p1', 'pr1', 'chosen')
    })

    it('rejects an unknown or missing status with 400 and does not call the service', async () => {
      for (const body of [{ status: 'hired' }, {}, { status: '' }]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(statusRoute, 'u1', { id: 'p1', providerId: 'pr1' })).rejects.toMatchObject({ statusCode: 400, message: 'Unknown status' })
      }
      expect(service.setStatus).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/projects/:id/providers/:providerId', () => {
    it('unlinks and returns the remaining list', async () => {
      await expect(call(unlinkRoute, 'u1', { id: 'p1', providerId: 'pr1' })).resolves.toEqual([])
      expect(service.unlink).toHaveBeenCalledWith('h1', 'p1', 'pr1')
    })

    it('passes a service 404 through with its message', async () => {
      service.unlink.mockRejectedValue(new HttpError('That provider is not on this project', 404))
      await expect(call(unlinkRoute, 'u1', { id: 'p1', providerId: 'pr1' })).rejects.toMatchObject({
        statusCode: 404, message: 'That provider is not on this project',
      })
    })
  })
})
```

If the sign-in harness does not work as written (for example the auth wrapper needs something else mocked), make the smallest change that mirrors `household-admin-routes.test.ts`, keep every assertion, and describe the change in the report. If the 401 or 403 expectation is wrong for this codebase's wrapper, stop and report it; do not weaken the assertion.

- [ ] **Step 2: Run the file and see it fail**

Run: `npx vitest run tests/unit/api/project-provider-routes.test.ts`
Expected: FAIL, the four route modules cannot be resolved.

- [ ] **Step 3: Write the four routes**

`server/api/projects/[id]/providers.get.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProjectProviderService().listForProject(householdId, projectId);
  } catch (error) {
    return toHttpError(error, 'listing project providers');
  }
});
```

`server/api/projects/[id]/providers.post.ts`:

```ts
import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { projectProviderLinkSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = projectProviderLinkSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectProviderService().link(householdId, authUser.userId, projectId, parsed.data.providerId);
  } catch (error) {
    return toHttpError(error, 'linking provider to project');
  }
});
```

`server/api/projects/[id]/providers/[providerId].put.ts`:

```ts
import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { projectProviderStatusSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const providerId = event.context.params?.providerId;
    if (!projectId || !providerId) throw new HttpError('Project ID and provider ID are required', 400);
    const parsed = projectProviderStatusSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectProviderService().setStatus(householdId, projectId, providerId, parsed.data.status);
  } catch (error) {
    return toHttpError(error, 'updating project provider status');
  }
});
```

`server/api/projects/[id]/providers/[providerId].delete.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const providerId = event.context.params?.providerId;
    if (!projectId || !providerId) throw new HttpError('Project ID and provider ID are required', 400);
    return await new ProjectProviderService().unlink(householdId, projectId, providerId);
  } catch (error) {
    return toHttpError(error, 'unlinking provider from project');
  }
});
```

- [ ] **Step 4: Run the route tests and see them pass**

Run: `npx vitest run tests/unit/api/project-provider-routes.test.ts`
Expected: PASS, every test. If `projectProviderLinkSchema.safeParse(undefined)` or `(null)` gives a message other than "Provider is required", fix the schema in `server/utils/project-schemas.ts` (not the test) and re-run Task 1's schema tests too.

- [ ] **Step 5: Add the client calls**

In `composables/useProjects.ts`, add `type ProjectProviderDto` and `type ProjectProviderStatus` to the import from `@/types/project`, add after `deleteStep`:

```ts
  const listProjectProviders = (projectId: string) =>
    api.get<ProjectProviderDto[]>(`/api/projects/${projectId}/providers`);
  const linkProvider = (projectId: string, providerId: string) =>
    api.post<ProjectProviderDto[]>(`/api/projects/${projectId}/providers`, { providerId });
  const setProviderLinkStatus = (projectId: string, providerId: string, status: ProjectProviderStatus) =>
    api.put<ProjectProviderDto[]>(`/api/projects/${projectId}/providers/${providerId}`, { status });
  const unlinkProvider = (projectId: string, providerId: string) =>
    api.delete(`/api/projects/${projectId}/providers/${providerId}`);
```

and extend the returned object with a last line:

```ts
    listProjectProviders, linkProvider, setProviderLinkStatus, unlinkProvider,
```

- [ ] **Step 6: Run the suite and commit**

Run: `npx vitest run`
Expected: all files pass.

```bash
git add "server/api/projects/[id]/providers.get.ts" "server/api/projects/[id]/providers.post.ts" "server/api/projects/[id]/providers/[providerId].put.ts" "server/api/projects/[id]/providers/[providerId].delete.ts" composables/useProjects.ts tests/unit/api/project-provider-routes.test.ts
git commit -m "feat: project provider routes and client calls"
```

---

### Task 5: The Providers section and the picker on the project page

These screens cannot be run in this session. There are no component tests in this repo; the deliverable is the code plus a written hand trace.

**Files:**
- Create: `components/projects/ProjectProviderPicker.vue`, `components/projects/ProjectProviders.vue`
- Modify: `pages/projects/[id].vue`

**Interfaces:**
- Consumes (Task 4) from `useProjects()`: `listProjectProviders`, `linkProvider`, `setProviderLinkStatus`, `unlinkProvider`, and the existing `updateProject(id, input): Promise<ProjectDetail>`. (Task 3): `ProjectDetail.providerCategoryId`, `ProjectDetail.providers`. (Task 1): `MAX_PROJECT_PROVIDERS`, `PROJECT_PROVIDER_STATUSES`, `ProjectProviderDto`, `ProjectProviderStatus`; `PROVIDER_LINK_STATUS_LABELS`, `neighborLabel`, `telHref` from `@/utils/project-providers`. Existing from `useProviders()`: `listCategories(): Promise<ProviderCategoryDto[]>`, `listProviders(filters): Promise<ProviderListItem[]>` (filters `{ categoryId, includeHidden, sort }`). Existing: `hasApiStatus(error, status)` from `@/utils/api-error`.
- Produces: `<ProjectProviders :project-id :category-id :links @update:links @update:category />`.

- [ ] **Step 1: Write the picker**

Create `components/projects/ProjectProviderPicker.vue`:

```vue
<template>
  <div class="rounded-lg border border-stone-200 bg-stone-50 p-3">
    <label :for="`provider-picker-category-${projectId}`" class="block text-sm font-medium text-stone-700">
      {{ selected === '' ? 'What kind of provider?' : 'Category' }}
    </label>
    <select :id="`provider-picker-category-${projectId}`"
            v-model="selected"
            class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
            @change="onCategoryPicked">
      <option v-if="selected === ''" value="" disabled>Choose a category</option>
      <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
    </select>

    <p v-if="error" class="mt-2 text-sm text-red-700" aria-live="polite">{{ error }}</p>

    <template v-if="selected !== ''">
      <p v-if="loading" class="mt-3 text-sm text-stone-600">Loading providers...</p>
      <p v-else-if="loadFailed" class="mt-3 text-sm text-stone-600">
        <button type="button" class="font-medium text-amber-700 hover:text-amber-800" @click="load">Try again</button>
      </p>
      <p v-else-if="providers.length === 0" class="mt-3 text-sm text-stone-600">No providers in this category</p>
      <p v-else-if="available.length === 0" class="mt-3 text-sm text-stone-600">Every provider in this category is already linked</p>
      <ul v-else class="mt-3 divide-y divide-stone-200 max-h-80 overflow-y-auto rounded-md border border-stone-200 bg-white">
        <li v-for="provider in available" :key="provider.id">
          <button type="button"
                  class="w-full text-left px-3 py-2 hover:bg-amber-50 disabled:opacity-50"
                  :disabled="linkingId !== null"
                  @click="pick(provider)">
            <span class="block text-sm font-medium text-stone-900 break-words">{{ provider.name }}</span>
            <span class="flex flex-wrap items-center gap-2 mt-0.5">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="statusClass(provider.status.kind)">{{ provider.status.name }}</span>
              <span v-if="neighborLabel(provider.neighborCount)" class="text-xs text-stone-600">
                {{ neighborLabel(provider.neighborCount) }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <div class="mt-3 flex justify-end">
      <button type="button"
              class="text-sm font-medium text-stone-600 px-2 py-1 rounded-lg hover:bg-stone-100"
              @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { type ProjectProviderDto } from '@/types/project';
import { type ProviderCategoryDto, type ProviderListItem, type ProviderStatusKind } from '@/types/provider';
import { useProjects } from '@/composables/useProjects';
import { useProviders } from '@/composables/useProviders';
import { hasApiStatus } from '@/utils/api-error';
import { neighborLabel } from '@/utils/project-providers';

const props = defineProps<{
  projectId: string;
  categories: ProviderCategoryDto[];
  // the project's saved category; null means none chosen yet
  categoryId: string | null;
  linkedProviderIds: string[];
}>();

const emit = defineEmits<{
  // a provider was linked; carries the project's full list
  (e: 'linked', links: ProjectProviderDto[]): void;
  // the project had no category and one was just picked here, so the parent should save it
  (e: 'save-category', categoryId: string): void;
  // the link was refused because the list on screen is out of date
  (e: 'stale'): void;
  (e: 'cancel'): void;
}>();

const { linkProvider } = useProjects();
const { listProviders } = useProviders();

// A saved category that has since been deleted is treated as none.
const selected = ref<string>(
  props.categoryId && props.categories.some((category) => category.id === props.categoryId) ? props.categoryId : '',
);
const providers = ref<ProviderListItem[]>([]);
const loading = ref(false);
const loadFailed = ref(false);
const error = ref<string | null>(null);
const linkingId = ref<string | null>(null);

const available = computed(() => providers.value.filter((provider) => !props.linkedProviderIds.includes(provider.id)));

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

const statusClass = (kind: ProviderStatusKind): string => {
  if (kind === 'positive') return 'bg-green-100 text-green-800';
  if (kind === 'negative') return 'bg-red-50 text-red-700';
  return 'bg-stone-100 text-stone-700';
};

// Ignore a slow response that arrives after the category was switched again.
let latestRequestId = 0;

const load = async (): Promise<void> => {
  if (selected.value === '') return;
  const requestId = ++latestRequestId;
  loading.value = true;
  loadFailed.value = false;
  error.value = null;
  try {
    // Hidden statuses (Lead, out of the box) are included: most of the directory sits there.
    const result = await listProviders({ categoryId: selected.value, includeHidden: true, sort: 'mentions' });
    if (requestId !== latestRequestId) return;
    providers.value = result;
  } catch (e) {
    if (requestId !== latestRequestId) return;
    providers.value = [];
    loadFailed.value = true;
    error.value = messageOf(e, 'Could not load providers');
  } finally {
    if (requestId === latestRequestId) loading.value = false;
  }
};

const onCategoryPicked = (): void => {
  // Switching here never changes a category the project already has.
  if (props.categoryId === null && selected.value !== '') emit('save-category', selected.value);
  void load();
};

const pick = async (provider: ProviderListItem): Promise<void> => {
  if (linkingId.value !== null) return;
  linkingId.value = provider.id;
  error.value = null;
  try {
    emit('linked', await linkProvider(props.projectId, provider.id));
  } catch (e) {
    error.value = messageOf(e, 'Could not add the provider');
    // 409: someone else linked this provider, or the project is full. Ask the parent to reload.
    if (hasApiStatus(e, 409)) emit('stale');
  } finally {
    linkingId.value = null;
  }
};

onMounted(load);
</script>
```

- [ ] **Step 2: Write the section**

Create `components/projects/ProjectProviders.vue`:

```vue
<template>
  <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h2 class="text-lg font-medium text-stone-900">Providers</h2>
      <select v-if="categories.length > 0"
              :value="knownCategoryId ?? ''"
              aria-label="Provider category"
              :disabled="savingCategory"
              class="min-w-0 max-w-[60%] rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
              @change="changeCategory">
        <option value="">No category</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
    </div>

    <ul v-if="links.length > 0" class="divide-y divide-stone-100 mb-3">
      <li v-for="link in links" :key="link.providerId" class="py-2" :class="link.status === 'passed' ? 'opacity-60' : ''">
        <div class="flex items-center gap-3">
          <NuxtLink :to="`/providers/${link.providerId}`"
                    class="flex-1 min-w-0 text-sm font-medium text-stone-900 break-words hover:text-amber-700">
            {{ link.provider.name }}
          </NuxtLink>
          <select :value="link.status"
                  :aria-label="`Status for ${link.provider.name}`"
                  :disabled="busyIds.includes(link.providerId)"
                  class="shrink-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                  @change="changeStatus(link, $event)">
            <option v-for="status in PROJECT_PROVIDER_STATUSES" :key="status" :value="status">
              {{ PROVIDER_LINK_STATUS_LABELS[status] }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2 mt-1 text-xs text-stone-600">
          <a v-if="telHref(link.provider.phone)"
             :href="telHref(link.provider.phone) ?? undefined"
             class="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800">
            <Phone :size="12" />{{ link.provider.phone }}
          </a>
          <span v-else>{{ link.provider.phone || 'No phone on file' }}</span>
          <span v-if="neighborLabel(link.provider.neighborCount)">&middot; {{ neighborLabel(link.provider.neighborCount) }}</span>
          <span class="flex-1" />
          <button type="button"
                  class="text-sm font-medium text-red-700 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  :disabled="busyIds.includes(link.providerId)"
                  @click="remove(link)">
            Remove
          </button>
        </div>
      </li>
    </ul>

    <p v-if="error" class="text-sm text-red-700 mb-3" aria-live="polite">{{ error }}</p>

    <p v-if="categoriesFailed" class="text-sm text-stone-600">
      Could not load provider categories.
      <button type="button" class="font-medium text-amber-700 hover:text-amber-800" @click="loadCategories">Try again</button>
    </p>
    <p v-else-if="categoriesLoaded && categories.length === 0" class="text-sm text-stone-600">
      Add a provider category in Household &gt; Provider settings to link providers.
    </p>
    <template v-else-if="categoriesLoaded">
      <p v-if="links.length >= MAX_PROJECT_PROVIDERS" class="text-sm text-stone-600">
        That's the maximum of {{ MAX_PROJECT_PROVIDERS }} providers for a project.
      </p>
      <ProjectProviderPicker v-else-if="pickerOpen"
                             :project-id="projectId"
                             :categories="categories"
                             :category-id="knownCategoryId"
                             :linked-provider-ids="links.map((link) => link.providerId)"
                             @linked="onLinked"
                             @save-category="saveCategory"
                             @stale="reloadLinks"
                             @cancel="pickerOpen = false" />
      <button v-else
              type="button"
              class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
              @click="pickerOpen = true">
        <Plus :size="16" />Add provider
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Phone, Plus } from 'lucide-vue-next';
import {
  MAX_PROJECT_PROVIDERS,
  PROJECT_PROVIDER_STATUSES,
  type ProjectProviderDto,
  type ProjectProviderStatus,
} from '@/types/project';
import { type ProviderCategoryDto } from '@/types/provider';
import { useProjects } from '@/composables/useProjects';
import { useProviders } from '@/composables/useProviders';
import { PROVIDER_LINK_STATUS_LABELS, neighborLabel, telHref } from '@/utils/project-providers';
import ProjectProviderPicker from '@/components/projects/ProjectProviderPicker.vue';

const props = defineProps<{
  projectId: string;
  // the project's saved provider category; null means none
  categoryId: string | null;
  links: ProjectProviderDto[];
}>();

const emit = defineEmits<{
  (e: 'update:links', links: ProjectProviderDto[]): void;
  (e: 'update:category', categoryId: string | null): void;
}>();

const { updateProject, listProjectProviders, setProviderLinkStatus, unlinkProvider } = useProjects();
const { listCategories } = useProviders();

const categories = ref<ProviderCategoryDto[]>([]);
const categoriesLoaded = ref(false);
const categoriesFailed = ref(false);
const savingCategory = ref(false);
const error = ref<string | null>(null);
const busyIds = ref<string[]>([]);
const pickerOpen = ref(false);

// A saved category that is not in the household's list (deleted since) shows as "No category".
const knownCategoryId = computed<string | null>(() =>
  props.categoryId && categories.value.some((category) => category.id === props.categoryId) ? props.categoryId : null,
);

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

const setBusy = (providerId: string, busy: boolean): void => {
  busyIds.value = busy ? [...busyIds.value, providerId] : busyIds.value.filter((id) => id !== providerId);
};

const loadCategories = async (): Promise<void> => {
  categoriesFailed.value = false;
  try {
    categories.value = await listCategories();
    categoriesLoaded.value = true;
  } catch {
    categoriesFailed.value = true;
  }
};

// Returns whether the save worked, so the header dropdown can be put back when it did not.
const saveCategory = async (categoryId: string | null): Promise<boolean> => {
  savingCategory.value = true;
  error.value = null;
  try {
    const updated = await updateProject(props.projectId, { providerCategoryId: categoryId });
    emit('update:category', updated.providerCategoryId ?? null);
    return true;
  } catch (e) {
    error.value = messageOf(e, 'Could not save the category');
    return false;
  } finally {
    savingCategory.value = false;
  }
};

const changeCategory = async (event: Event): Promise<void> => {
  const select = event.target as HTMLSelectElement;
  const saved = await saveCategory(select.value === '' ? null : select.value);
  // The bound value did not change on a failure, so Vue will not reset the dropdown; put it back by hand.
  if (!saved) select.value = knownCategoryId.value ?? '';
};

const changeStatus = async (link: ProjectProviderDto, event: Event): Promise<void> => {
  const select = event.target as HTMLSelectElement;
  const status = select.value as ProjectProviderStatus;
  if (status === link.status) return;
  error.value = null;
  setBusy(link.providerId, true);
  try {
    emit('update:links', await setProviderLinkStatus(props.projectId, link.providerId, status));
  } catch (e) {
    // The bound value did not change, so Vue will not reset the dropdown; put it back by hand.
    select.value = link.status;
    error.value = messageOf(e, 'Could not save the status');
  } finally {
    setBusy(link.providerId, false);
  }
};

const remove = async (link: ProjectProviderDto): Promise<void> => {
  const question = `Remove ${link.provider.name} from this project? To keep a record that you considered them, set them to Passed instead.`;
  if (!window.confirm(question)) return;
  error.value = null;
  setBusy(link.providerId, true);
  try {
    await unlinkProvider(props.projectId, link.providerId);
    emit('update:links', props.links.filter((existing) => existing.providerId !== link.providerId));
  } catch (e) {
    error.value = messageOf(e, 'Could not remove the provider');
  } finally {
    setBusy(link.providerId, false);
  }
};

const onLinked = (links: ProjectProviderDto[]): void => {
  emit('update:links', links);
  pickerOpen.value = false;
};

// The picker was refused because this list is out of date; show what the server has now.
const reloadLinks = async (): Promise<void> => {
  try {
    emit('update:links', await listProjectProviders(props.projectId));
  } catch {
    // The picker already shows the server's message; a failed reload adds nothing to say.
  }
};

onMounted(loadCategories);
</script>
```

- [ ] **Step 3: Mount the section on the project page**

In `pages/projects/[id].vue`:

In the template, between the `<ProjectSteps ... />` element and the `<!-- Photos -->` comment, add:

```vue
      <!-- Providers -->
      <ProjectProviders :project-id="project.id"
                        :category-id="project.providerCategoryId ?? null"
                        :links="project.providers ?? []"
                        @update:links="onProviderLinksChange"
                        @update:category="onProviderCategoryChange" />

```

In the script, add `type ProjectProviderDto,` to the import from `@/types/project` (keep the list alphabetical), add the component import after the `ProjectSteps` import:

```ts
import ProjectProviders from '@/components/projects/ProjectProviders.vue';
```

and add after `onStepsChange`:

```ts
// As with steps, an older server build may send a project without `providers` or
// `providerCategoryId`; the template guards both reads, and every change replaces the value here.
const onProviderLinksChange = (links: ProjectProviderDto[]): void => {
  if (project.value) project.value.providers = links;
};

const onProviderCategoryChange = (categoryId: string | null): void => {
  if (project.value) project.value.providerCategoryId = categoryId;
};
```

- [ ] **Step 4: Check it compiles**

Run: `npx nuxi typecheck 2>&1 | grep -n "ProjectProviders\|ProjectProviderPicker\|pages/projects/\[id\]\|project-providers"`
Expected: no output. Any line is an error in a file this task owns; fix it.

Run: `npx vitest run`
Expected: all files pass.

- [ ] **Step 5: Write the hand trace in the report**

For each of these, write what the code does line by line, what the screen shows at each point, and whether it matches the Global Constraints copy. If a trace finds a fault, fix the code and re-trace.

1. Page load on a project with no category and no links, household has categories. Then tap Add provider, pick a category, tap a provider.
2. The same, but the category save fails (server 500) while the provider list loads fine. What category does the header show? What happens on the next category switch in the picker?
3. Change a link from Considering to Chosen: success (the row moves to the top; which element keeps focus is not required). Then the same with the save failing: the dropdown value and the error line.
4. Two quick taps on two different providers in the picker.
5. Tap a provider that another member linked a moment ago (server returns 409 "That provider is already on this project").
6. Remove with the confirm accepted, then with it cancelled, then with the server failing.
7. A project detail from an older server build with no `providers` and no `providerCategoryId`.
8. The household has no provider categories; and the category request fails, then Try again succeeds.
9. A project with exactly 25 links; then one is removed.
10. Width check at 375 px: for the longest plausible provider name (60 characters, no spaces in the first 30) and the longest status label ("Considering"), say which classes keep line 1 from overflowing (`min-w-0`, `break-words`, `shrink-0`) and confirm line 2 fits a phone number, "· 12 neighbors" and Remove.

- [ ] **Step 6: Commit**

```bash
git add components/projects/ProjectProviderPicker.vue components/projects/ProjectProviders.vue "pages/projects/[id].vue"
git commit -m "feat: providers on the project page with a category-first picker"
```

---

### Task 6: The card's "Chosen:" line and the provider page's Projects section

**Files:**
- Modify: `pages/projects/index.vue`, `pages/providers/[id].vue`

**Interfaces:**
- Consumes (Task 3): `ProjectListItem.chosenProviderNames`, `ProviderDetail.projects`. (Task 1): `chosenLine(names: string[] | undefined): string | null`, `PROVIDER_LINK_STATUS_LABELS`, `linkStatusBadgeClass(status)` from `@/utils/project-providers`.
- Produces: nothing other tasks use.

- [ ] **Step 1: Add the card line**

In `pages/projects/index.vue`, inside the card's `<div class="p-4">`, directly after the closing `</div>` of the badges row (`<div class="flex flex-wrap items-center gap-2 mt-3">`), add:

```vue
            <!-- chosenProviderNames may be missing in a response from an older server build; chosenLine handles that. -->
            <p v-if="chosenLine(project.chosenProviderNames)" class="text-sm text-stone-700 mt-2 truncate">
              {{ chosenLine(project.chosenProviderNames) }}
            </p>
```

In the script, add:

```ts
import { chosenLine } from '@/utils/project-providers';
```

- [ ] **Step 2: Add the Projects section to the provider page**

In `pages/providers/[id].vue`, directly after the closing `</section>` of the `<!-- Linked tasks -->` section and before `<!-- Comments -->`, add:

```vue
        <!-- Linked projects (read-only; links are managed on the project page) -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 class="text-lg font-semibold text-stone-900 font-heading mb-3">Projects</h2>
          <p v-if="linkedProjects.length === 0" class="text-sm text-stone-500">No projects linked.</p>
          <ul v-else class="space-y-2 text-sm">
            <li v-for="link in linkedProjects" :key="link.project.id" class="flex items-center justify-between gap-2">
              <NuxtLink :to="`/projects/${link.project.id}`" class="min-w-0 text-amber-700 hover:text-amber-800 break-words">{{ link.project.title }}</NuxtLink>
              <span class="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="linkStatusBadgeClass(link.status)">{{ PROVIDER_LINK_STATUS_LABELS[link.status] }}</span>
            </li>
          </ul>
        </section>

```

In the script, add the import:

```ts
import { PROVIDER_LINK_STATUS_LABELS, linkStatusBadgeClass } from '@/utils/project-providers';
```

and after the `provider` ref declaration add:

```ts
// An older server build (mid-deploy) may send a provider without `projects`.
const linkedProjects = computed(() => provider.value?.projects ?? []);
```

(`computed` is already imported in this file.)

- [ ] **Step 3: Check it compiles and nothing else broke**

Run: `npx nuxi typecheck 2>&1 | grep -n "pages/projects/index\|pages/providers/\[id\]"`
Expected: no lines beyond any that Task 1's baseline listed for `pages/providers/[id].vue` (name them in the report if there are any).

Run: `npx vitest run`
Expected: all files pass.

- [ ] **Step 4: Write the hand trace in the report**

1. A card for a project with no chosen provider, with one, with three, and from an older server response with no `chosenProviderNames`: what the card shows in each case.
2. A 50-character provider name on a 375 px card: which class keeps it to one line.
3. The provider page for a provider with no links, with two links (one on a Done project), and from an older server response with no `projects`.
4. Confirm the new section sits inside the same `v-if` block as "Linked tasks", so it is not shown on the new-provider form.

- [ ] **Step 5: Commit**

```bash
git add pages/projects/index.vue "pages/providers/[id].vue"
git commit -m "feat: chosen provider on project cards and linked projects on the provider page"
```

---

## After the tasks (controller, not subagents)

1. Final whole-branch Opus review of `main..feat/project-providers` against the spec, with the report written to a file, and a fix round if it finds anything above Minor.
2. Run the repo's `update-docs` skill: `docs/functionality/projects.md` and `providers.md` (product-level, no code names), `docs/functionality/changelog.md`, `docs/tech/architecture.md`, `docs/tech/api-endpoints.md`, `docs/next-up.md`, and the data-model list in `CLAUDE.md`.
3. Report to David: what was unit-tested (the helpers, the schemas, `ProjectProviderService`, the changed services, the four routes against a mocked service) and what was never run (the migration, every route against a real database, both new components, and the changes to the three pages).
4. Ask David before each of: `npx prisma migrate deploy` (the migration only adds a nullable column and a table, so it goes first and is safe with the old code), the merge to `main`, the push.
5. Give David the phone test steps below, adjusted for anything that changed during the build.
6. Remind David of the two open items: a sign-in with a never-used Google account, and Amanda opening Projects and the dashboard on her phone.
7. Update the memory file with the new state.

## Phone test steps (production, after the merge and deploy)

1. Open https://www.adulting.diy on your phone, sign in, tap **Projects** and open a project you plan to hire out. **Expect:** a **Providers** section between Steps and Photos, with a dropdown reading "No category" at its top right and an **Add provider** button.
2. Tap **Add provider**. **Expect:** a panel opens in place headed "What kind of provider?" with a dropdown reading "Choose a category".
3. Pick a category you know has providers (for example Plumber). **Expect:** the heading changes to "Category", a list of that category's providers appears with the most-mentioned first, each with a status badge, and the dropdown at the top right of the section now shows the same category.
4. Tap a provider. **Expect:** the panel closes and the provider appears as a row: name on the left, a dropdown reading "Considering" on the right, and beneath it the phone number (or "No phone on file"), a neighbor count if it has one, and Remove.
5. Tap **Add provider** again. **Expect:** the panel opens straight on the saved category, and the provider you just linked is not in the list.
6. In the panel, change the category to another one, tap a provider there. **Expect:** it is added as a second row. The dropdown at the top right of the section still shows the first category.
7. Change the first provider's dropdown to **Chosen**. **Expect:** it stays, or moves, to the top of the list.
8. Change the second provider's dropdown to **Passed**. **Expect:** it moves to the bottom and is greyed.
9. Tap the chosen provider's phone number. **Expect:** your phone offers to call that number. Cancel the call.
10. Tap the chosen provider's name. **Expect:** the provider's page, with a **Projects** section listing this project with a green "Chosen" badge. Tap the project's title. **Expect:** back on the project page.
11. Go to **Projects**. **Expect:** this project's card shows "Chosen: (provider name)" under its badges.
12. Open the project again, tap **Remove** on the passed provider. **Expect:** a question "Remove (name) from this project? To keep a record that you considered them, set them to Passed instead." Tap Cancel. **Expect:** nothing changes. Tap Remove again and confirm. **Expect:** the row is gone.
13. Reload the page. **Expect:** the chosen provider, the category and everything else are as you left them.
14. Set the chosen provider back to **Considering**, then go to **Projects**. **Expect:** the card no longer shows a "Chosen:" line.
15. Open the dashboard. **Expect:** it looks exactly as before; nothing about providers appears there.
