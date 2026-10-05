---
name: update-docs
description: Review recent changes and update high-level documentation — docs/functionality/, docs/tech/, the changelog, CLAUDE.md, and README.md — to stay in sync with the codebase. Run after completing feature work, before committing significant work, or when asked.
user_invocable: true
---

# Update Docs

Audit recent code changes and update high-level documentation so future agents and humans can orient without reading the whole codebase. Run before committing, or when asked. Do not commit — leave the changes staged for the user to review.

## Scope

| Location | Purpose | Detail level |
|----------|---------|--------------|
| `docs/functionality/` | Per-capability docs (what the system does and how, conceptually) | **Capability-level, no code** — describe behavior, not implementation |
| `docs/functionality/changelog.md` | What changed from a user/product perspective | User-impact framing, no jargon |
| `docs/tech/` | Architecture, subsystems, integrations, API reference, testing | 30,000-foot technical overview — code references OK |
| `CLAUDE.md` | AI agent signpost — conventions and pointers into docs | Concise reference, links not duplication |
| `README.md` | Public overview and onboarding | Link to deeper docs, don't duplicate them |

### Abstraction levels — the most important rule

**`docs/functionality/`** describes capabilities the way a product manager would. These docs answer: what can the household do, how does it behave, what are the limits?

- NO variable, function, component, composable, store or service names
- NO model, column or enum names, and no stored values (write "pending", not `created`/`assigned`)
- NO framework concepts (Nuxt, Vue, Pinia, Prisma, Zod, cron, localStorage)
- NO file paths, URL routes, API endpoints, JSON or code blocks
- YES: "Photos are private: only a signed-in member of the owning household can load one"
- NO: "`ProjectPhotoService` streams the blob through `defineHouseholdProtectedEventHandler`"

Name screens and controls by what the user sees ("the Projects page", "Household > Provider settings"), never by route or filename. A link to the matching tech doc in a Related section is fine.

**`docs/tech/`** is where code references, architecture, and service/route/schema tables live. It is still the 30k-foot view — how things interconnect and where the integration points are — not a line-by-line retelling. Let the code speak for itself.

**`docs/functionality/changelog.md`** describes changes in terms of what users experience:

- YES: "Checking off a project's last step asks whether to mark the project Done"
- NO: "Add ProjectStepService and the next-steps endpoint"
- Skip anything with no user-visible impact (refactors, dependency updates, test or docs changes)
- No commit SHAs, no conventional-commit prefixes

### Capability docs vs feature docs

`docs/functionality/` holds one file per overarching **capability**, not per feature, page, script or class.

Current capability docs:

- `task-management.md` — task definitions, scheduling patterns, occurrences, lifecycle, catch-up, list filters, the dashboard's stat cards and Coming Up feed
- `notifications-and-reminders.md` — notification events, preferences, channels, reminder rules
- `household-management.md` — households, roles, invite codes, former members, timezone, task categories
- `providers.md` — contractor directory, private fields, categories and statuses, neighbor evidence, task links
- `projects.md` — home projects, photos, steps, linked providers and their per-project status, next steps on the dashboard

Good boundaries: "Task Management", "Providers", "Projects". Too granular: "Dashboard" (a page; it is covered by the capabilities it surfaces), "Occurrence Detail Page", "Photo Carousel", "Mailjet Integration" (that last one is a tech detail).

### Capability doc template

Every capability doc follows this template. Subsections under How It Works are fine.

```markdown
# Capability Name

> One-line description of what this capability lets users do.

## What You Can Do
[Bullet list of user-facing actions — "you can..." statements]

## How It Works
[Plain-language explanation of system behavior. No code. Describe flows and decisions the way you'd explain them to a product manager.]

## Connections
[Which other capabilities this one talks to, and why]

## Where It Appears
[Which screens/pages/sections surface this — by user-visible name, not component filename]

## Current Limitations
[Known gaps, rough edges, things that don't work yet — user-facing language]
```

### Out of scope

Do not update these via this skill:

- `docs/specs/` — the original project specs, kept as written
- `docs/superpowers/` — design specs and implementation plans, managed by that workflow
- `docs/adrs/` — written when a decision is made, not as part of a docs sweep (but add a new ADR to the `CLAUDE.md` list)
- `docs/brand.md` — update only when the visual system itself changes
- `.env` files

## Procedure

### Step 0: Staleness check

```bash
git log -1 --format=%cs -- docs/functionality/changelog.md
git log --oneline --since="<that date>" -- . ':!docs'
```

If the changelog is more than ~2 weeks behind user-visible work, backfill it first.

### Step 1: Identify what changed

```bash
git diff --stat
git diff --cached --stat
git log --oneline -20
```

Read the changed files — don't guess from filenames.

### Step 2: Classify the changes

| Change type | Docs to check |
|-------------|---------------|
| Feature behavior change | The matching `docs/functionality/*.md`, `docs/functionality/changelog.md` |
| New/removed page or nav link | `docs/tech/architecture.md` (Pages table), the matching capability doc |
| New/changed/removed API endpoint | `docs/tech/api-endpoints.md` |
| New auth wrapper or change to who may call what | `docs/tech/architecture.md` (auth table), `docs/tech/api-endpoints.md`, `CLAUDE.md` (API Patterns) |
| New/changed Prisma model or field | `docs/tech/architecture.md` (Data Model), `docs/tech/api-endpoints.md` (Data Models), `CLAUDE.md` (Data Models); `docs/tech/provider-ingest.md` if it is a provider model |
| Recurrence, occurrence generation, catch-up or end-condition logic | `docs/tech/task-scheduling.md`, `docs/functionality/task-management.md` |
| Notification event, channel, preference or reminder logic | `docs/tech/notification-system.md`, `docs/functionality/notifications-and-reminders.md` |
| Provider ingest, matching, evidence or API keys | `docs/tech/provider-ingest.md`, `docs/functionality/providers.md` |
| Project photos, storage, steps or provider links | `docs/tech/architecture.md` (Projects and Photo Storage), `docs/functionality/projects.md` |
| Dashboard content | `docs/functionality/task-management.md` (stat cards, Coming Up) or `docs/functionality/projects.md` (next steps), `docs/tech/architecture.md` (Dashboard) |
| Roles, membership, invite codes, task categories | `docs/functionality/household-management.md` |
| New integration, env var or cron job | `docs/tech/architecture.md` (Integrations, Scheduled Jobs), `README.md` (Environment Variables), `CLAUDE.md` (Tech Stack, Development Setup) |
| New service, top-level directory or subsystem | `docs/tech/architecture.md` (Directory Map, Subsystems) |
| Test layout or commands | `docs/tech/testing.md`, `CLAUDE.md` (Testing), `README.md` |
| Dev login bypass | `docs/tech/dev-login-bypass.md` |
| Package added/removed | `README.md` and `CLAUDE.md` (Tech Stack) |
| Deferred or newly planned work | `docs/next-up.md`, the capability doc's "Not Yet" / limitations section |
| Colors, typography, component patterns | `docs/brand.md` |
| New ADR | `CLAUDE.md` (ADR list) |

### Step 3: Update affected docs

For each doc that needs updating:

1. Read the current doc first to pick up its structure and tone.
2. Make surgical edits — update what changed, don't rewrite sections that are still accurate.
3. Match the abstraction level for that surface (see above).
4. Cross-link related docs where it helps.

If a subsystem in `docs/tech/architecture.md` outgrows its section, give it its own `docs/tech/<subsystem>.md` and link it from the Subsystems table.

### Step 4: Update the changelog

If the change is user-visible, add to `docs/functionality/changelog.md` under today's date (newest first), grouped under a short descriptive heading:

```markdown
## YYYY-MM-DD

### Heading for the change
- One plain-language line per change, from the user's point of view
```

### Step 5: Check CLAUDE.md and README.md

Both are signposts. Verify, and fix what's wrong:

**CLAUDE.md**
- [ ] Documentation index lists every doc in `docs/functionality/` and `docs/tech/`, and every link resolves
- [ ] Tech stack, data model summary and ADR list still accurate
- [ ] Development setup, env var notes and test commands still accurate
- [ ] Nothing re-explains a subsystem that a doc already covers — link instead

Do not add feature descriptions, implementation detail or endpoint lists to `CLAUDE.md`; those belong in the docs it points to.

**README.md**
- [ ] Feature list and tech stack match reality
- [ ] Getting-started steps and environment variables still accurate
- [ ] Documentation index links resolve

### Step 6: Archive completed plans

If the work was guided by a plan in `docs/plans/`, move it to `docs/plans/completed/` with `git mv`.

### Step 7: Report

Stage the doc changes (`git add` the touched docs only) and print a summary:

```
=== Docs Update Summary ===

Changes detected:
  - [brief description of each change reviewed]

Docs updated:
  ✓ docs/functionality/projects.md — added step reordering
  ✓ docs/functionality/changelog.md — added 2 entries
  ✓ docs/tech/api-endpoints.md — added the reorder endpoint

Docs still accurate (no changes needed):
  — docs/tech/architecture.md
  — CLAUDE.md
  — README.md

Needs verification:
  - [anything you could not confirm from the code]
```

## New Capability Detection

Most changes update existing docs. Create a new `docs/functionality/` capability doc only when the change:

- introduces a **new user-facing system** that fits in no existing doc, or
- **cross-cuts 3+ existing capability docs**

If it is a feature within an existing capability, fold it into that doc. **When in doubt, fold in** — splitting later is easier than merging.

When you do create one: use the template above, add it to the list in this skill, the classification table, and the documentation indexes in `CLAUDE.md` and `README.md`, and add a changelog entry.

## Rules

- **Don't invent content.** Only document what you can verify from the code; flag uncertainty in the report.
- **Don't remove content you can't confirm is wrong.**
- **Keep code out of `docs/functionality/`.** Code-level detail goes in `docs/tech/`.
- **Keep the changelog user-focused.** Skip no-impact changes.
- **Current state only.** If something was removed, delete it from the doc; don't mark it removed or strike it through. (The changelog is the one place history lives.)
- **Keep docs lean.** A few hundred lines max per file; split if longer.
- **No hard-wrapped prose.** One paragraph per line.
- **Don't commit.** Leave changes staged for review.
