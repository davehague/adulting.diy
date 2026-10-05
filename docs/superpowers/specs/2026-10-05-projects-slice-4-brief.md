# Home projects: state after slice 3a and brief for slice 4 (not a spec)

Status: handoff written 2026-10-05 for a fresh session. Nothing in the slice 4 section is designed or approved. Replace this file with the real spec (`docs/superpowers/specs/<date>-projects-ai-<topic>-design.md`) once the slice 4 design is approved.

## Where things stand

Slices 1, 2 and 3a are live in production at https://www.adulting.diy (`main` at `15e55bb` when this was written). David looked at 3a and the Find a provider window on his phone on 2026-10-05 and said it "looks pretty good"; he did not report results for the numbered test steps one by one.

What is live:
- Slice 1: `/projects` list, `/projects/new` capture with private photos (Vercel Blob), `/projects/:id` project page.
- Slice 2: a checklist of steps on each project, and "Project next steps" on the dashboard.
- Slice 3a: providers linked to a project, each link with its own status (considering, contacted, chosen, passed). Table `project_providers`, column `projects.providerCategoryId` (the project's saved provider category), `ProjectProviderService`, routes under `/api/projects/[id]/providers`, the Providers section `components/projects/ProjectProviders.vue`, a "Chosen:" line on project cards, and a read-only Projects section on the provider page. Migration `20261004180000_add_project_providers` is applied.
- The "Find a provider" modal (`components/projects/FindProviderModal.vue`, with `FindProviderDetails.vue`). It replaced the in-place picker one day after 3a shipped, because David found the picker confusing: two stacked category dropdowns read as "enter it twice", and tapping a row added the provider with no chance to learn about it. The modal has search, category and status filters, four sort orders, a details view (phone, notes, rating, neighbor mentions with source links, comments), and explicit Add buttons that link a provider as Considering. It uses only the existing `GET /api/providers` and `GET /api/providers/[id]`.
- A code comment in `FindProviderModal.vue` marks the spot between the filter bar and the list where slice 4's suggestions go.

The full suite was 49 files, 795 tests passing on 2026-10-05. `npx nuxi typecheck` reported 62 pre-existing errors in files unrelated to projects.

Read for detail: `docs/functionality/projects.md` and `docs/functionality/providers.md` (what it does), `docs/tech/architecture.md` (how the pieces fit), `docs/tech/api-endpoints.md` (routes), `docs/superpowers/specs/2026-10-04-projects-providers-design.md` and `docs/superpowers/plans/2026-10-04-projects-providers.md` (the 3a design and how it was built; the plan is a good model), `docs/next-up.md` (planned and deferred work).

## Slice 4: AI help

Decided so far:
- The AI explains and routes. It never picks the contractor, and ranking stays deterministic (rule-based, the same every time for the same data).
- Two halves, built as separate slices. David agreed on 2026-10-05 to start with **provider suggestions**; **step suggestions** follow.
- Provider suggestions appear inside the Find a provider modal: David described it as "a modal for Find a provider and then have a couple of suggestions". The modal's search, filters and details view stay as the manual path.
- "Describe your problem" routes to a provider category, with a reason for each shortlisted provider.
- For the later step-suggestions half: regenerating steps must keep the steps that already exist, and planning must not run inside a single web request.
- Slice 3b (quotes as numbers on a provider link) is on hold until a contractor actually sends David a quote. It is not part of slice 4.

What already exists that slice 4 builds on:
- A project has a title, location, notes, photos, steps and a saved provider category. The category is the field that routing would fill in.
- Each provider has a category, a household status (Lead, Recommended, Hired, Passed, Avoid), an optional private rating and notes, and neighbor evidence: each sighting has a kind (neighbor recommendation, self-promotion, lead), a date, a source group and a snippet. `summarizeEvidence` in `server/utils/provider-evidence.ts` gives mention count, neighbor count and last sighting. David's household has about 352 providers in 38 categories; most are Leads loaded by the watcher.
- The provider list already sorts by mentions, last sighting, rating and name. That is the only ranking there is today.
- There is no AI integration in this repo yet: no model SDK in `package.json`, no API key in the documented environment variables, and no background-job mechanism beyond the one daily Vercel cron (`/api/scheduler/run`).
- Project photos are private and stored in Vercel Blob; they are streamed through an authenticated route. Sending one to a model is a new data flow that needs a decision.

Open design questions (ask David one at a time, with a recommendation each time, not a list of options):
1. What does David type or tap to get suggestions? A free-text "describe the problem" box in the modal, or does it use the project's title, location and notes as they are, with no typing?
2. What is the deterministic ranking? For example neighbor recommendations first, then recency, with Avoid and Passed excluded and his own rating as a boost. This must be settled before anything about the AI, because the AI only explains the result.
3. What exactly does the AI produce? Candidates: the category for the problem; a one-line reason per suggested provider, written from that provider's evidence snippets; both.
4. How many suggestions, and what does a suggestion row look like next to the normal results?
5. What happens when there is no good match: an empty category, no evidence, or a problem that fits two trades?
6. Which model and where does the call run? In the request (simple, but slow and it fails on a timeout) or as a short background job with a "thinking" state. The step-suggestions half must not run in a request, so a choice here should work for both halves.
7. What is sent to the model? Project text only, or photos too? Provider snippets are scraped from neighborhood posts and include other people's words; is that acceptable to send?
8. Cost and limits: a cap per household per day, and whether the result is cached on the project so reopening the modal does not call the model again.
9. Does routing save the category to the project automatically, or suggest it for David to accept?
10. Who can use it? Every household, or David's only at first (a key in the environment, a per-household switch)?

Lessons to carry from the earlier app (`~/source/havemoneywantthingwhatdo`, design reference only): its "Deterministic-Backbone" staged-agent pattern keeps ranking and state in code and uses the model only for bounded steps with a written contract (`spine/`, `prompts/`, `workflow/`); it ran model work asynchronously, not inside a request; it kept per-task contractor shortlists as snapshots; and its tasks were rows that a re-analysis reconciled and never wiped. Read its `CLAUDE.md`, `docs/plans/2026-08-31-ai-first-pm-vision.md` and `src/lib/db/schema.ts`. Borrow the shape, not the code.

## Lessons from the slice 3a build

- David's first real use overturned two brainstorm decisions within a day (in-place picker, no search). For slice 4, prefer the smallest version that he can put his hands on, and expect to revise it.
- Two stacked controls that show the same value read as "do it twice". Check each screen for duplicated controls.
- An action on tap with no preview surprised him. Anything that changes data should be an explicit button.
- A Vue `<select>` bound with `:value` to a prop snaps back to the old value when a busy flag re-renders it during a save. Bind to local state, or hold a pending value. An Opus reviewer caught this by compiling the real component against the repo's Vue version in a throwaway jsdom harness outside the repo. Ask reviewers of unrunnable UI to do that; it found what two hand traces missed.
- The whole-branch review is worth its cost: it caught an error message placed below a long list (off screen) and a Cancel that dropped an in-flight result.
- Subagent reply text is truncated in transit, and one implementer could not write its report file at all. Have each subagent write its report to a file, check the file exists, and tell the reviewer plainly when there is no implementer trace.
- One implementer ran `git stash` against the rules. The standing rules now say so in the dispatch prompt as well as the rules file.
- Sonnet implementers sign commits "Co-Authored-By: Claude Sonnet 5.5" whatever the rules file says. That is accurate; it was left as is.
- CockroachDB commits each DDL statement on its own, so a migration that fails partway leaves every earlier statement applied. Put the exact recovery statements in the ask to apply a migration. The 3a migration applied cleanly on the first try.
- A migration must be applied before the code that needs it is merged; the new build fails without it.

## Known gaps left in slice 3a (logged, not blocking)

Listed in `docs/next-up.md` under "Projects - Deferred". The fuller lists, with file and line references and each reviewer's report, are in the git-ignored folders `.superpowers/sdd/2026-10-04-projects-providers/` (ledger `progress.md`, `final-review.md`) and `.superpowers/sdd/2026-10-05-find-provider-modal/` (`brief.md`, `review.md`).

## Other open items

- A sign-in with a Google account that has never used the site is the only end-to-end check of the new-account path, which changed twice on 2026-10-04 (`66e35f5`, then `d022fb9`). Not done.
- Amanda opens Projects and the dashboard on her phone. Not done.
- The numbered phone tests for 3a (in the plan) and for the modal were not reported step by step. The one behaviour nobody could verify in advance: change a linked provider's status, then immediately reopen the same dropdown on an iPhone.
- A project-card update in Linear (the `projects` skill, which replaced `project-status`) was offered twice for the new capability and not answered. Draft status: slices 1 to 3a live; providers link to projects with a per-project status through a Find a provider window; next is slice 4, AI provider suggestions.
- Never run in a browser: the slice 1 cleanup's "Saved" text clearing after about 2 seconds, and the reworded maximum-photos message.

## How David wants the work run

- Brainstorm first (superpowers:brainstorming, architectural path): questions one at a time with a recommendation, then a written spec he approves, then a written plan he approves. No code before both. For the 3a build he pre-approved the build after the plan was written; do not assume that again.
- Build with superpowers:subagent-driven-development: Sonnet implementers, Opus for every review (each task, the whole-branch review, every re-review), each reviewer writing its full report to a file. One task at a time in the main checkout on a feature branch; git worktrees break this repo's Vitest setup.
- Local dev uses the production database, and sessions are not permitted to read production data. Write migrations by hand (never `prisma migrate dev`), mirror `prisma/migrations/20261004180000_add_project_providers/migration.sql`, and unlock each new table with `ALTER TABLE "x" SET (schema_locked = false);`. Check a hand-written migration offline with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`. Apply with `npx prisma migrate deploy` only after his explicit yes.
- Ask before every push, merge, migration, or post to an external service. Each yes covers only what he named. A new paid external service (a model API) is itself a decision to put to him, with the expected cost.
- Never start the dev server. Google sign-in does not work on Vercel preview URLs, so phone testing happens in production after a merge.
- Before a plan changes any shared file, grep for every caller and for anything that matches on its output.
- Say plainly what was only unit-tested and what was never run. Give him exact numbered phone test steps with the expected result for each.
- After feature work, run the repo's `update-docs` skill. `docs/functionality/` is product-level only: no code names, routes or file paths.
- Responses: answer first, numbered steps, and close with Done / Needs you / Next.
