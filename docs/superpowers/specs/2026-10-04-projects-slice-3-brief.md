# Home projects: state after slice 2 and brief for slice 3 (not a spec)

Status: handoff written 2026-10-04 for a fresh session. Nothing in the slice 3 section is designed or approved. Replace this file with the real spec (`docs/superpowers/specs/<date>-projects-providers-design.md`) once the slice 3 design is approved.

## Where things stand

Slices 1 and 2 are live in production at https://www.adulting.diy. David ran the 15-step phone test for slice 2 on 2026-10-04 and every step passed.

What is live:
- Slice 1: `/projects` list with status and path filters, `/projects/new` capture with private photos (Vercel Blob), `/projects/:id` project page, swipeable photos.
- Slice 2: a checklist of steps on each project (table `project_steps`, `ProjectStepService`, routes under `/api/projects/[id]/steps`), and a "Project next steps" section on the dashboard (`components/projects/ProjectNextSteps.vue`, `GET /api/projects/next-steps`) showing each Active project's next undone step, checkable in place, with a "mark Done?" dialog (`components/projects/MarkDoneDialog.vue`).
- The shared client helper now throws `ApiError` with the HTTP status and the server's message (`utils/api-error.ts`; use `hasApiStatus(error, 404)` to branch on a status, never match on message text).

After slice 2 was pushed (`4117095`), another session landed four more commits on `main`: household admin check fix (`5eb654f`), verified identity on the user profile and register routes (`d022fb9`), scheduling and reminder fixes (`075e541`), and a docs restructure that added the `update-docs` skill and `docs/tech/architecture.md` (`382050a`). Read `git log --oneline -12` before assuming anything about those areas. The full suite was 725 passing on 2026-10-04.

Read for detail: `docs/functionality/projects.md` (what it does), `docs/tech/architecture.md` (how the pieces fit), `docs/tech/api-endpoints.md` (routes), `docs/superpowers/specs/2026-10-04-projects-steps-design.md` and `docs/superpowers/plans/2026-10-04-projects-steps.md` (slice 2 design and how it was built; the plan is a good model for the next one), `docs/next-up.md` (planned and deferred project work).

## Slice 3: providers on a project, then quotes

Decided so far (one line in the slice 1 and 2 specs, nothing more):
- A project can have providers linked to it, each link with a status: considering, contacted, chosen, passed.
- Then quotes, recorded as numbers.
- AI help is slice 4, not this slice. The AI will explain and route; it never picks the contractor, and ranking stays deterministic.

What already exists that slice 3 builds on:
- The providers directory: `Provider`, `ProviderCategory`, `ProviderStatus`, `ProviderContact`, `ProviderEvidence`, `ProviderComment` in `prisma/schema.prisma`; pages `pages/providers/index.vue` and `pages/providers/[id].vue`; services `server/services/Provider*Service.ts`. About 352 providers in 38 categories in David's household. See `docs/functionality/providers.md` and `docs/tech/provider-ingest.md`.
- A provider-to-chore-task link: `TaskProvider` (no status, no quotes), `TaskProviderService`, and the picker `components/providers/TaskProviderPicker.vue`. The picker pattern is reusable; the table is not, because a project link needs its own status and quotes.
- `ProviderStatus` is a per-household status on the provider itself (Lead, Recommended, Hired, Passed, Avoid). The project link's status (considering, contacted, chosen, passed) is a different thing: the same provider can be chosen on one project and passed on another.
- `docs/next-up.md` lists "Quotes and engagements per provider" as deferred providers work; slice 3 is where that lands.

Open design questions (ask David one at a time, with a recommendation each time, not a list of options):
1. Finding the provider. A plain picker over 352 providers is the wall David wanted to avoid (the provider list overwhelmed him; that is why projects exist). Does a project get a provider category first, so the picker starts narrowed? Or search-first?
2. Is this one slice or two? "Then quotes" suggests links first and quotes second. The slice 2 session's lean was two small slices.
3. Quotes. One per provider link or several over time? Just an amount, or also a date, a note, what it covers?
4. Does "chosen" do anything beyond a label? For example show the chosen provider on the project card, or change what a Hire project shows.
5. Does it touch the dashboard's next-step list? A Hire project's next step is often "call the plumber"; should the provider's phone number be reachable from there?
6. The reverse view: on a provider's page, which projects they are linked to.
7. What happens to links when a provider is deleted, or a project is deleted (soft delete).

Lessons to carry from the earlier app (`~/source/havemoneywantthingwhatdo`, design reference only): it had `contractor_engagement` with statuses contacted/chosen/passed and `contractor_quote`, plus per-task contractor shortlists, in `src/lib/db/schema.ts`. Borrow the shape, not the code.

## Lessons from the slice 2 build

- The whole-branch review caught what no task review could: a planned change to shared code (`utils/api.ts`) would have broken new-user sign-up, because `pages/login.vue` matched on error text. Before a plan changes any shared file, grep for every caller and for anything that matches on its output.
- Subagent reply text gets truncated in transit. Have each reviewer write its full report to a file in the plan workspace and reply with a short summary.
- UI code in the plan was written without being run. Reviews found real timing issues by tracing (uncontrolled inputs, overlapping saves, `validity.badInput` on number fields). Ask implementers and reviewers of unrunnable UI for written hand traces.
- A step row with a checkbox, text field, minutes field and remove button does not fit a phone; slice 2 used wrapping text that opens for editing on tap. Design for a 375 px width from the start.
- The plan's commit trailer went stale when the session URL changed. Put the trailer in the workspace's `standing-rules.md`, not only in the plan, and use the session's current attribution lines.

## Known gaps left in slice 2 (logged, not blocking)

Listed in `docs/next-up.md` under "Projects - Deferred". The fuller list with file and line references is in the git-ignored ledger `.superpowers/sdd/2026-10-04-projects-steps/progress.md` (deferred minors per task) and `final-review.md` in the same folder.

## Other open items

- A sign-in with a Google account that has never used the site is the only end-to-end check of the new-account path, which changed twice on 2026-10-04 (`66e35f5`, then `d022fb9`). Not done as far as this brief knows.
- `npx nuxi typecheck` reported 65 pre-existing errors in files unrelated to projects when slice 2 was built; re-measure the baseline before relying on that number.
- Never run in a browser: the slice 1 cleanup's "Saved" text clearing after about 2 seconds, and the reworded maximum-photos message.
- Worth doing once: Amanda opens Projects and the dashboard on her phone.
- Closed on 2026-10-04: the notification tests that failed after 8 pm Eastern (tests-only fault, fixed; real reminders were not affected by it), the Worthington watcher logged-out detector (David reports it done), and David's providers click-through ("fine enough for now").

## How David wants the work run

- Brainstorm first (superpowers:brainstorming, architectural path): questions one at a time with a recommendation, then a written spec he approves, then a written plan he approves. No code before both.
- Build with superpowers:subagent-driven-development: Sonnet implementers, Opus reviewers (every task review, the whole-branch review, and the re-review). One task at a time in the main checkout on a feature branch; git worktrees break this repo's Vitest setup.
- Local dev uses the production database, and this session type is not permitted to read production data. Write migrations by hand (never `prisma migrate dev`), mirror `prisma/migrations/20261004120000_add_project_steps/migration.sql`, and unlock each new table with `ALTER TABLE "x" SET (schema_locked = false);`. A reviewer can check a hand-written migration offline with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`. Vercel's build does not apply migrations; apply with `npx prisma migrate deploy` only after his explicit yes, and before the code that needs the tables is merged.
- Ask before every push, merge, migration, or post to an external service. Each yes covers only what he named.
- Never start the dev server from a subagent. Google sign-in does not work on Vercel preview URLs, so phone testing happens in production after a merge.
- Say plainly what was only unit-tested and what was never run. Give him exact numbered phone test steps with the expected result for each.
- After feature work, run the repo's `update-docs` skill. `docs/functionality/` is product-level only: no code names, routes or file paths.
- Responses: answer first, numbered steps, and close with Done / Needs you / Next.
