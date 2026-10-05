# Home projects, slice 3a: providers on a project (design spec)

Amended 2026-10-05, after David used it in production: the in-place picker described below (decisions 2 to 5 and the section "The picker") was replaced by a "Find a provider" modal with search, category and status filters, sorting, a details view and an explicit Add button. The current behaviour is in `docs/functionality/projects.md`; the brief for the change is in the git-ignored `.superpowers/sdd/2026-10-05-find-provider-modal/brief.md`. The rest of this spec stands.

Status: design agreed in conversation on 2026-10-04, awaiting David's review of this written spec. No code is written until this spec and a written implementation plan are both approved.

This replaces the handoff `2026-10-04-projects-slice-3-brief.md`. Slices 1 and 2 are described in `2026-10-03-projects-design.md`, `2026-10-04-projects-steps-design.md` and `docs/functionality/projects.md`. The providers directory is described in `docs/functionality/providers.md`.

## Goal

Slices 1 and 2 let David and Amanda capture projects and see the next step for each. Slice 3a answers "who might do this one, and where do we stand with each of them?"

A project can have providers from the household directory linked to it, each link with its own status. Finding a provider starts from a category, so nobody has to face the full directory (about 352 providers in 38 categories), which is the wall that led to projects in the first place.

Success: on a real Hire project, David can link two or three providers, mark one chosen, see that on the project's card, and call them from the project page.

## Decisions made in the brainstorm

1. Slice 3 is split in two. This spec is 3a, links only. Quotes are 3b and get their own spec after 3a has been used on real projects.
2. Category first. A project has one optional provider category, saved on the project. The picker opens narrowed to it.
3. The picker has a category switcher, so a multi-trade project can pull providers from several categories. Switching in the picker does not change the project's saved category.
4. If the project has no category yet, the picker asks for one first and saves that choice to the project.
5. The picker shows providers of every status, including Leads and other hidden-by-default statuses, sorted by mentions (the directory's default sort). No search in 3a.
6. A link has one of four fixed statuses: considering, contacted, chosen, passed. A new link starts as considering. This is separate from the provider's household status (Lead, Recommended, Hired and so on).
7. "Chosen" has one visible effect: the chosen provider's name shows on the project's card in the list, and chosen providers sort to the top of the project's provider list. More than one provider can be chosen on a project.
8. Nothing changes automatically. Choosing a provider does not mark the others passed, does not change the provider's household status, and does not change the project's path or status.
9. The dashboard is not touched.
10. A provider's page gets a read-only Projects section listing the projects it is linked to, with each link's status. Done projects are included; deleted projects are not. The providers directory list is not changed.
11. Links are never deleted automatically. A link whose project is deleted or whose provider is removed is hidden with it, and the row is kept.
12. Unlinking by hand deletes the link for good, after a confirmation that suggests Passed as the way to keep a record.
13. When a provider category is deleted and its providers are moved to a replacement, projects saved with that category move to the same replacement. When a category that no provider uses is deleted, projects saved with it have their category cleared.
14. The providers section shows on every project, whatever its path.
15. A project can have at most 25 linked providers.

## Out of scope for 3a

- Quotes (slice 3b).
- Search in the picker.
- Notes, a date contacted, or any other field on a link.
- Reordering links.
- Any change to the dashboard or to the providers directory list.
- Any automatic status change, on the link, the provider or the project.
- A link between a step and a provider.
- AI help (slice 4).

## Data model

One new column and one new table.

`Project` gains:

```prisma
providerCategory   ProviderCategory? @relation(fields: [providerCategoryId], references: [id], onDelete: SetNull)
providerCategoryId String?
providers          ProjectProvider[]
```

`ProviderCategory` gains the back-relation `projects Project[]`. `Provider` gains `projects ProjectProvider[]`. `User` gains the back-relation for `createdBy`.

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

Status is a string checked in code, like `Project.status`. The cascades match `TaskProvider` and `ProjectStep`; because projects and providers are soft-deleted, they do not fire in normal use.

### Migration

Hand-written as `prisma/migrations/20261004180000_add_project_providers/migration.sql`, mirroring `20261004120000_add_project_steps`: create `project_providers`, then `ALTER TABLE "project_providers" SET (schema_locked = false);`, then the unique index, the index and the three foreign keys; and add `providerCategoryId` with its foreign key to `projects`. The plan must establish whether altering the existing `projects` table needs its own `schema_locked` handling, by reading how the earlier migrations left that table. A reviewer checks the SQL offline with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`. Never `prisma migrate dev`. It is applied with `npx prisma migrate deploy` only after David's explicit yes, and before the code that needs it is merged.

## Rules

- Link order on a project: chosen, contacted, considering, passed; within a status, oldest link first.
- A project's links, a card's chosen names and the 25-link cap consider only links whose provider is not removed (`metaStatus` active).
- A provider's Projects section considers only links whose project is not deleted. Order: newest link first.
- Chosen names on a card are in the order the links were made.
- The project's saved category must belong to the household. It can be cleared.

## API

All routes use `defineHouseholdProtectedEventHandler` and Zod validation, and return errors through `HttpError`.

| Route | Does | Returns |
|-------|------|---------|
| `GET /api/projects/[id]/providers` | List the project's links | `ProjectProviderDto[]`, in link order |
| `POST /api/projects/[id]/providers` | Link a provider. Body `{ providerId }` | the full list |
| `PUT /api/projects/[id]/providers/[providerId]` | Change the status. Body `{ status }` | the full list |
| `DELETE /api/projects/[id]/providers/[providerId]` | Unlink | the full list |

Every write returns the project's full, sorted list so the screen replaces its state in one step.

```ts
export const PROJECT_PROVIDER_STATUSES = ['considering', 'contacted', 'chosen', 'passed'] as const;
export type ProjectProviderStatus = (typeof PROJECT_PROVIDER_STATUSES)[number];
export const MAX_PROJECT_PROVIDERS = 25;

export interface ProjectProviderDto {
  providerId: string;
  status: ProjectProviderStatus;
  provider: { id: string; name: string; phone: string | null; neighborCount: number };
}
```

Errors:
- Project not found, deleted, or in another household: 404.
- Provider not found, removed, or in another household: 404.
- Provider already linked to the project: 409.
- The project already has 25 links: 409.
- Changing or removing a link that does not exist: 404.
- A status outside the four: 400.

Changes to existing responses and inputs:
- `ProjectDetail` gains `providerCategoryId: string | null` and `providers: ProjectProviderDto[]`.
- `ProjectUpdateInput` gains `providerCategoryId?: string | null`; `PUT /api/projects/[id]` returns 400 if the category is not the household's.
- `ProjectListItem` gains `chosenProviderNames: string[]`.
- `ProviderDetail` gains `projects: { status: ProjectProviderStatus; project: { id: string; title: string; status: ProjectStatus } }[]`.

The picker uses the existing `GET /api/providers` with `categoryId`, `sort=mentions` and hidden statuses included, and the existing `GET /api/provider-categories`. No new endpoint.

## Code shape

- New `server/services/ProjectProviderService.ts`: `listForProject`, `link`, `setStatus`, `unlink`. It owns the link order, the cap and the hidden-row filters, and exports the select and sort it uses so `ProjectService` can include links in the detail the way it includes steps. `neighborCount` is computed the way `ProviderService` already computes it; the plan must find that code and reuse it, not write a second version.
- New route files under `server/api/projects/[id]/providers`.
- `server/services/ProjectService.ts`: detail include and `toDetail` carry the category and links; `update` accepts the category; `list` adds chosen names.
- `server/services/ProviderService.ts`: detail carries the linked projects, through one more include beside the linked tasks.
- `server/services/ProviderCategoryService.ts`: `remove` moves projects along with providers inside the same transaction. The case with no providers needs no code, because the foreign key clears the column.
- `types/project.ts`, `types/provider.ts`, and the project Zod schemas.
- New `components/projects/ProjectProviders.vue` (the section) and `components/projects/ProjectProviderPicker.vue` (the picker). `TaskProviderPicker.vue` is not changed and not reused.
- `pages/projects/[id].vue`, `pages/projects/index.vue` (card line), `pages/providers/[id].vue` (Projects section), and the projects composable for the new calls.

Shared code changes here: the project detail, list and update shapes, the provider detail shape, and category delete. Before the plan changes any of them it must grep for every caller and for anything that depends on their output, and list what it found.

## Screens

Everything is designed for a 375 px wide phone first.

### Project page: "Providers"

Sits between Steps and Photos, on every project.

```
Providers                          Plumber ▾
┌─────────────────────────────────────────┐
│ Acme Plumbing              [ Chosen  ▾] │
│ 📞 614-555-0101 · 3 neighbors    Remove │
├─────────────────────────────────────────┤
│ Bob's Pipes                [Contacted▾] │
│ 📞 614-555-0199 · 1 neighbor     Remove │
├─────────────────────────────────────────┤
│ Drainmasters (greyed)      [ Passed  ▾] │
│ No phone on file                 Remove │
└─────────────────────────────────────────┘
[ + Add provider ]
```

- Header: the section title and the project's saved category as a native dropdown listing the household's categories plus "No category". Picking a value saves it to the project.
- Each row, line 1: the provider's name, linking to the provider's page, and the link's status as a native dropdown that saves on change.
- Each row, line 2: the phone number as a tap-to-call link, or "No phone on file"; the neighbor count when it is above zero ("3 neighbors", "1 neighbor"); and Remove at the right.
- Passed rows are greyed.
- Remove asks: "Remove <name> from this project? To keep a record that you considered them, set them to Passed instead." Confirming deletes the link.
- With no links, the section shows only the header and the Add provider button.
- At 25 links the Add provider button is replaced by a line saying the project has the maximum number of providers.
- A failed save shows the server's message above the list and puts the dropdown back to the saved value.

### The picker

Tapping Add provider opens the picker in place, under the list (not a pop-up).

- If the project has no category, it first shows "What kind of provider?" with the household's categories. Picking one saves it to the project and shows that category's providers.
- At the top, a category dropdown, starting on the project's saved category. Changing it reloads the list and does not change the saved category.
- The list: that category's providers, sorted by mentions, leaving out providers already linked to this project. Each row shows the name, the provider's household status badge, and the neighbor count when above zero.
- Tapping a provider links it as Considering, closes the picker and shows the new row in the list.
- An empty list says "No providers in this category" (or "Every provider in this category is already linked").
- A Cancel control closes the picker.
- If the household has no categories at all, the section says to add a provider category in Household > Provider settings, and there is no Add provider button.

### Projects list: the card

A project with at least one chosen provider shows a line "Chosen: Acme Plumbing". With more than one it shows the first name and "+1" (or "+2" and so on). Nothing else on the card changes.

### Provider page: "Projects"

A section beside "Linked tasks", built the same way: each linked project's title as a link to the project, with the link's status as a badge. With none it says "No projects linked." It is read-only.

## Behaviour notes

- Two household members can change the same link. The last write wins; the list the write returns is the truth the screen shows.
- Linking a provider that someone else linked a moment ago returns 409; the screen shows the message and reloads the list.
- A removed provider's row disappears from the project the next time the project loads. A project that loses its only chosen provider this way loses its "Chosen:" line. This is intended.

## Testing

Unit tests (Vitest, mocked Prisma, matching the slice 2 tests):
- `ProjectProviderService`: link, duplicate, cap, status change, bad status, unlink, link order, removed providers filtered from the list and the cap, deleted projects filtered from a provider's list, and household isolation on every method (a project or provider from another household behaves as not found).
- `ProjectService`: detail carries the category and links; update accepts, clears and rejects a category; list carries chosen names in order and leaves out removed providers.
- `ProviderService`: detail carries linked projects.
- `ProviderCategoryService.remove`: projects move with providers.
- Route tests for the four new routes and the changed project update.

Not run before David's phone test: every screen in this spec. Implementers and reviewers of the screens write hand traces (what happens on each tap, in order, including a failed save and two quick taps), because the dev server is never started from a session.

The plan ends with exact numbered phone test steps, each with the expected result, run in production after the merge.

## Delivery

- Branch `feat/project-providers` in the main checkout. No git worktrees.
- superpowers:subagent-driven-development: Sonnet implementers, Opus for every task review, the whole-branch review and any re-review. Each reviewer writes its full report to a file in the plan workspace and replies with a short summary. The commit trailer lives in the workspace's `standing-rules.md`.
- David is asked before the migration is applied, before the merge and before the push. Each yes covers only what he named.
- Local dev uses the production database, and sessions do not read production data.
- After the build, run the repo's `update-docs` skill: `docs/functionality/projects.md` and `providers.md` (product-level, no code names), the changelog, `docs/tech/architecture.md`, `docs/tech/api-endpoints.md`, `docs/next-up.md` and `CLAUDE.md`'s data model list.

## Later slices (not designed here)

- 3b: quotes, recorded as numbers, on a link. Open questions: one quote per link or several over time; amount only, or also a date, a note and what it covers. Lesson from the earlier app (`~/source/havemoneywantthingwhatdo`, `src/lib/db/schema.ts`): it kept `contractor_quote` separate from `contractor_engagement`. Borrow the shape, not the code.
- Slice 4: AI help. "Describe your problem" routing would fill in the project's provider category. The AI explains and routes; it never picks the contractor, and ranking stays deterministic.
- Possibly: a step that points at a provider, if two taps from the dashboard to a phone number proves annoying.

## Open items carried from the handoff brief

- A sign-in with a Google account that has never used the site is the only end-to-end check of the new-account path, which changed twice on 2026-10-04 (`66e35f5`, then `d022fb9`). Not done.
- Amanda opens Projects and the dashboard on her phone. Not done.
- `npx nuxi typecheck` reported 65 pre-existing errors when slice 2 was built; re-measure the baseline before relying on that number.
- Never run in a browser: the slice 1 cleanup's "Saved" text clearing after about 2 seconds, and the reworded maximum-photos message.
- Slice 2's known gaps are in `docs/next-up.md` under "Projects - Deferred", with detail in the git-ignored ledger `.superpowers/sdd/2026-10-04-projects-steps/`.

## Lessons carried from the slice 2 build

- The whole-branch review caught a planned change to shared code that would have broken new-user sign-up. Grep for every caller of a shared file, and for anything that matches on its output, before the plan changes it.
- Subagent reply text gets truncated in transit, so reviewers write full reports to files.
- UI written without being run had real timing faults that reviews found by tracing (uncontrolled inputs, overlapping saves). Ask for written hand traces.
- A row with four controls does not fit a phone. Two lines, native controls.
