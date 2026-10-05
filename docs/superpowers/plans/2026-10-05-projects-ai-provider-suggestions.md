# AI Provider Suggestions (Slice 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inside the Find a provider window, one button splits the project into the trades it needs and shortlists up to three providers per trade from the household's own directory, each with a reason, using a model on Ollama Cloud.

**Architecture:** Two new tables (`project_suggestions`, `ai_request_logs`) behind a new `ProviderSuggestionService` and two new Nitro routes. The service makes two model calls (routing, then picking) through an injectable function, validates every reply with Zod, and enforces the limits in code: pools built by a fixed rules ranking, picks only from a pool. One new Vue component sits inside the existing Find a provider window.

**Tech Stack:** Nuxt 3 / Vue 3 `<script setup>` / TypeScript, Nitro (h3), Prisma 5 on CockroachDB, Zod 3, Tailwind, date-fns, Vitest with mocked Prisma. Ollama Cloud over plain `fetch`; no new npm dependency.

**Spec:** `docs/superpowers/specs/2026-10-05-projects-ai-provider-suggestions-design.md`. Read it before starting any task.

## Execution rules (set by David)

- Subagent-driven development: one implementer per task, an independent reviewer after each task, a fix round when the reviewer finds problems, and a final whole-branch review.
- Implementer subagents run on **Sonnet** (`model: "sonnet"`). Reviewer subagents, including the final whole-branch review and every re-review, run on **Opus** (`model: "opus"`). Every reviewer writes its full report to a file in `.superpowers/sdd/2026-10-05-provider-suggestions/` and replies with a short summary only. The controller checks each report file exists before reading the summary, and tells a reviewer plainly when an implementer left no report.
- Work in the main checkout on branch `feat/provider-suggestions` (the controller creates it from `main` before Task 1). Do **not** use git worktrees: a symlinked `node_modules` breaks this repo's Vitest setup. Tasks run one at a time.
- Never `git stash`. Never start the dev server.
- Commit with explicit paths only. Never `git add -A` or `git add .`; `.claude/settings.local.json` is modified locally and must not be committed.
- **Local dev uses the production database.** No task may run `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, `prisma migrate status`, a seed or db script, or the dev server. `npx prisma validate`, `npx prisma generate` and `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` are safe (they do not contact the database).
- **No subagent calls an external service.** No task calls Ollama; every test replaces the model call or stubs `fetch`. No subagent reads `.env`.
- These need David's explicit go-ahead and are done by the controller, never by a subagent: applying the migration, any `git push`, any merge, any post to an external service.
- The commit trailer is in the workspace's `standing-rules.md`, not here, because the session URL can change.
- Code style (CLAUDE.md): explicit TypeScript types, no `any`, arrow functions, `import { type X }`, camelCase and PascalCase. Match the comment density of neighbouring files. Markdown: never hard-wrap prose.
- The screens cannot be run. The implementer of Task 5 writes a hand trace in their report (what happens on each tap, in order, including a failed ask and two quick taps). The Opus reviewer of Task 5 compiles the real components against the repo's Vue version in a throwaway jsdom harness outside the repo and exercises them.
- When reporting, say plainly what was only unit-tested and what was not exercised at all.

## Global Constraints

- Limits, all exported from `types/suggestion.ts`: 4 parts, 3 picks per part, pool of 40 per part, 8 evidence rows per provider, 600 characters per snippet, 500 characters of extra text, 5 fallback providers, 20 asks per household per rolling 24 hours, 45 000 ms overall deadline.
- Default model `glm-5.3-flash`. Settings are read from `process.env` at call time: `OLLAMA_API_KEY`, `AI_SUGGESTIONS_MODEL`, `AI_SUGGESTIONS_HOUSEHOLD_IDS` (comma-separated). The feature is off for a household when the key is unset or the household is not listed.
- A provider with a negative-kind status, a deleted provider, or a provider already linked to the project is never in a pool. A pick outside its part's pool is dropped silently.
- Never sent to the model: phone, email, address, website, license number, Google Place ID, evidence `sourceUrl` and `sourceGroup`, extra contacts, comment authors, household or member names, database ids. Providers and categories go out under throwaway labels (`p1`, `c1`).
- The model never supplies a URL. Search links are `https://www.google.com/search?q=` plus the URL-encoded phrase, and every phrase ends in "near me".
- `ai_request_logs` holds no project or provider text. Nothing logged to the console contains prompt or reply text, or the key.
- A log row with outcome `started` is written before the first model call.
- Error messages: "Project not found" (404), "Suggestions are not available" (403), "Daily limit reached. Try again later." (429), "Anything to add must be 500 characters or fewer" (400).
- Screen copy: placeholder "Anything to add? (optional)"; buttons "Suggest providers", "Suggest again", "Try again", "Daily limit reached. Try again later."; waiting lines "Working out which trades this needs..." then "Choosing providers..."; "Suggested {MMM d}"; "No matching category in your directory"; "No one to suggest"; "No one stood out"; "Not enough to go on. Add a sentence about what's wrong or what you want done."; "Could not get suggestions."; fallback title "Top providers by your ratings and neighbor recommendations"; links "See all in {category}" and "Search Google"; "On this project"; button "Add".
- Add from a suggestion links the provider as Considering and keeps the window open. Add in the manual list still closes it.
- "See all" never saves a category to the project.
- Everything is laid out for a 375 px wide screen first.
- Baselines from the handoff brief, 2026-10-05 on `main`: `npx vitest run` is 49 files, 795 tests, all passing; `npx nuxi typecheck` reports 62 pre-existing errors. Task 1 re-measures both, and no typecheck error may mention a file this plan creates or changes.

## Deviations from the spec's wording (same behaviour unless noted)

- Settings are read from `process.env` at call time in `server/utils/ai-config.ts`, not through `runtimeConfig`. The existing `runtimeConfig` entries are baked in at build time, and a call-time read lets the model be switched in Vercel with a redeploy and is simple to test.
- The saved result gains `poolSize` on each part, so the screen can tell "No one to suggest" (empty pool) from "No one stood out" (the model picked nobody).
- The link reads "See all in Plumber", not "See all plumbers": category names are free text and cannot be pluralized safely.
- Two cuts the spec did not list, stated here so they are not buried: at most the 10 most recent household comments per provider, each cut to 600 characters, and the provider's notes cut to 1000 characters.
- `ProviderService.list` is not used for pools. A small exported mapper, `toProviderListItem`, is extracted from it so the pool query and the list share one mapping.
- The per-request time limit is set for every function to 60 seconds through `nitro.vercel.functions.maxDuration`. Nitro deploys this app as one function, so it cannot be set for one route. 60 seconds is allowed on every Vercel plan.

## Caller audit of shared code (done 2026-10-05 by grep; re-run in the task that touches each)

| Shared thing | Every caller | Why the change is safe |
|---|---|---|
| `FindProviderModal.vue` and its `linked` event | `components/projects/ProjectProviders.vue` only (also named in `docs/tech/architecture.md`) | The event gains an optional second argument; the one listener is updated in the same task |
| `ProviderService.list` | `server/api/providers/index.get.ts`; `tests/unit/services/provider-service.test.ts` | Internal refactor to a mapper with the same output; the existing tests must pass unchanged |
| `composables/useProjects.ts` | Nine components and pages | Two added functions; nothing existing changes |
| `utils/project-providers.ts` | `ProjectProviders.vue`, `FindProviderModal.vue`, `FindProviderDetails.vue`, pages, `ProjectProviderService.ts`, its test | One added export |
| `nuxt.config.ts` | Build only; `nuxt.config.test.ts` extends it | A new top-level `nitro` key; neither file has one today |
| `prisma/schema.prisma` | Everything | Two new models and three back-relations; no existing field changes |
| `Project`, `User`, `Household` Prisma models | All services | Back-relations only; no query selects them |

Nothing matches on the text of an error this plan changes.

## Review Focus

Inputs and conditions the spec implies that are most likely to bite, each pinned by a test in the task that owns the code:

1. The model wraps its JSON in a code fence, adds prose, or uses wrong field names: the reply is parsed leniently, validated, retried once, and a second bad reply ends in `failed` with the previous saved result kept (Task 2 `parseModelJson` tests; Task 3 "retries once" and "fails after two bad replies").
2. The model names a provider that is not in that part's pool, including one from another part's pool, or names the same one twice: dropped, nothing throws (Task 2 `checkPicks` tests).
3. A saved result points at a provider since deleted or moved to a negative status, or at a category since deleted: the pick is dropped, the category becomes null, nothing throws (Task 3 `readSuggestion` tests).
4. The `result` column holds JSON this build does not understand (written by a later build, or hand-edited): treated as no saved suggestion, not a 500 (Task 3 test "ignores a saved result it cannot read").
5. The ask is killed by the platform mid-call: it still counts toward the cap because the log row is written first (Task 3 test "writes the log row before calling the model").

Known and accepted, not fixed here: two members asking at once can pass the cap by one; closing the window mid-ask leaves no sign that an ask is running until it is reopened after the result is saved.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | 1 | `ProjectSuggestion`, `AiRequestLog`, back-relations |
| `prisma/migrations/20261005120000_add_project_suggestions/migration.sql` | 1 | Hand-written migration |
| `types/suggestion.ts` | 1 | Limits and DTOs |
| `utils/google-search.ts` | 1 | `withNearMe`, `googleSearchUrl` |
| `server/utils/provider-ranking.ts` | 1 | `rankProviders`, `fallbackProviders` |
| `server/utils/ai-config.ts` | 2 | `suggestionModel`, `suggestionsEnabledFor` |
| `server/utils/ollama.ts` | 2 | `callOllama`, the `ModelCall` type |
| `server/utils/suggestion-schemas.ts` | 2 | Zod schemas, `parseModelJson` |
| `server/utils/suggestion-prompts.ts` | 2 | The two prompts, labels, size cuts |
| `server/utils/suggestion-checks.ts` | 2 | `cleanParts`, `checkPicks` |
| `server/services/ProviderService.ts` | 3 | Extract `toProviderListItem` |
| `server/services/ProviderSuggestionService.ts` | 3 | Gate, flow, save, log, read, fallback |
| `server/api/projects/[id]/suggestions.get.ts`, `suggestions.post.ts` | 4 | Routes |
| `composables/useProjects.ts` | 4 | `getSuggestions`, `runSuggestions` |
| `nuxt.config.ts` | 4 | `nitro.vercel.functions.maxDuration` |
| `utils/project-providers.ts` | 5 | `providerStatusBadgeClass` |
| `components/projects/ProviderSuggestions.vue` | 5 | The panel |
| `components/projects/FindProviderModal.vue` | 5 | Mount the panel; add without closing; See all |
| `components/projects/ProjectProviders.vue` | 5 | Keep the window open for a suggestion add |

---

### Task 1: Foundations (schema, migration, types, ranking, search link)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261005120000_add_project_suggestions/migration.sql`
- Create: `types/suggestion.ts`
- Create: `utils/google-search.ts`
- Create: `server/utils/provider-ranking.ts`
- Test: `tests/unit/utils/provider-ranking.test.ts`, `tests/unit/utils/google-search.test.ts`

**Interfaces:**
- Consumes: `ProviderListItem`, `ProviderStatusKind` from `@/types/provider`.
- Produces: everything exported from `types/suggestion.ts` below; `rankProviders<T extends Rankable>(items: T[]): T[]`; `fallbackProviders<T extends Rankable>(items: T[]): T[]`; `withNearMe(phrase: string): string`; `googleSearchUrl(phrase: string): string`; Prisma models `projectSuggestion` and `aiRequestLog` on the generated client.

- [ ] **Step 1: Measure the baselines**

Run: `npx vitest run 2>&1 | tail -6` and `npx nuxi typecheck 2>&1 | grep -c "error TS"`
Expected: 49 files and 795 tests passing; 62 typecheck errors. Record the actual numbers in the report. If they differ, record them and carry on; they become the baseline.

- [ ] **Step 2: Write the failing tests**

`tests/unit/utils/provider-ranking.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rankProviders, fallbackProviders, type Rankable } from '@/server/utils/provider-ranking'

const p = (name: string, overrides: Partial<Omit<Rankable, 'status'>> & { kind?: 'neutral' | 'positive' | 'negative' } = {}): Rankable => {
  const { kind = 'neutral', ...rest } = overrides
  return { name, rating: null, neighborCount: 0, lastSightingAt: null, status: { kind }, ...rest }
}
const names = (items: Rankable[]): string[] => items.map((item) => item.name)

describe('rankProviders', () => {
  it('drops negative-kind statuses', () => {
    expect(names(rankProviders([p('Avoided', { kind: 'negative', rating: 5, neighborCount: 9 }), p('Kept')]))).toEqual(['Kept'])
  })

  it('puts positive-kind statuses before all others, whatever the evidence', () => {
    expect(names(rankProviders([p('Lead', { neighborCount: 8 }), p('Hired', { kind: 'positive', rating: 2 })]))).toEqual(['Hired', 'Lead'])
  })

  it('orders by rating within a tier, unrated after rated', () => {
    expect(names(rankProviders([p('Unrated', { neighborCount: 5 }), p('Three', { rating: 3 }), p('Five', { rating: 5 })]))).toEqual(['Five', 'Three', 'Unrated'])
  })

  it('then by neighbor count, then by most recent sighting, then by name', () => {
    const ranked = rankProviders([
      p('Zed', { neighborCount: 2, lastSightingAt: new Date('2026-01-01') }),
      p('Old', { neighborCount: 2, lastSightingAt: new Date('2024-01-01') }),
      p('Many', { neighborCount: 5 }),
      p('Beta'),
      p('Alpha'),
      p('New', { neighborCount: 2, lastSightingAt: '2026-06-01T00:00:00.000Z' }),
    ])
    expect(names(ranked)).toEqual(['Many', 'New', 'Zed', 'Old', 'Alpha', 'Beta'])
  })

  it('does not change the array it was given', () => {
    const input = [p('B'), p('A')]
    rankProviders(input)
    expect(names(input)).toEqual(['B', 'A'])
  })

  it('returns an empty list for no providers', () => {
    expect(rankProviders([])).toEqual([])
  })
})

describe('fallbackProviders', () => {
  it('leaves out a neutral provider with no neighbor recommendations and no rating', () => {
    const result = fallbackProviders([p('Bare'), p('Rated', { rating: 1 }), p('Vouched', { neighborCount: 1 }), p('Hired', { kind: 'positive' })])
    expect(names(result)).toEqual(['Hired', 'Rated', 'Vouched'])
  })

  it('keeps at most five', () => {
    const many = Array.from({ length: 8 }, (_, i) => p(`P${i}`, { neighborCount: 8 - i }))
    expect(fallbackProviders(many)).toHaveLength(5)
  })
})
```

`tests/unit/utils/google-search.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { withNearMe, googleSearchUrl } from '@/utils/google-search'

describe('withNearMe', () => {
  it('appends "near me" when it is missing', () => {
    expect(withNearMe('ceiling leak plumber')).toBe('ceiling leak plumber near me')
  })
  it('leaves a phrase that already ends with it, in any case', () => {
    expect(withNearMe('plumber Near Me')).toBe('plumber Near Me')
  })
  it('trims and collapses whitespace', () => {
    expect(withNearMe('  drywall   repair \n')).toBe('drywall repair near me')
  })
})

describe('googleSearchUrl', () => {
  it('builds a Google search URL with the phrase encoded', () => {
    expect(googleSearchUrl('plumber & drain near me')).toBe('https://www.google.com/search?q=plumber%20%26%20drain%20near%20me')
  })
  it('cannot be turned into another site by the phrase', () => {
    expect(googleSearchUrl('https://evil.example/?q=x')).toMatch(/^https:\/\/www\.google\.com\/search\?q=https%3A%2F%2Fevil/)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/utils/provider-ranking.test.ts tests/unit/utils/google-search.test.ts`
Expected: FAIL, the modules cannot be resolved.

- [ ] **Step 4: Write `types/suggestion.ts`**

```ts
import { type ProviderListItem } from '@/types/provider';

export const MAX_SUGGESTION_PARTS = 4;
export const MAX_PICKS_PER_PART = 3;
export const MAX_POOL_SIZE = 40;
export const MAX_EVIDENCE_PER_PROVIDER = 8;
export const MAX_COMMENTS_PER_PROVIDER = 10;
export const MAX_SNIPPET_LENGTH = 600;
export const MAX_PROVIDER_NOTES_LENGTH = 1000;
export const MAX_EXTRA_TEXT_LENGTH = 500;
export const MAX_FALLBACK_PROVIDERS = 5;
export const DAILY_SUGGESTION_LIMIT = 20;
export const SUGGESTION_DEADLINE_MS = 45_000;
export const DEFAULT_SUGGESTION_MODEL = 'glm-5.3-flash';
export const PROVIDER_SUGGESTIONS_FEATURE = 'provider_suggestions';

// What is stored in project_suggestions.result. Ids are real database ids.
export interface SavedSuggestionPick {
  providerId: string;
  reason: string;
}

export interface SavedSuggestionPart {
  name: string;
  why: string;
  // null when no household category fits this part
  categoryId: string | null;
  searchPhrase: string;
  // how many providers were offered to the model for this part; 0 means there was nobody to choose from
  poolSize: number;
  picks: SavedSuggestionPick[];
}

export interface SavedSuggestionResult {
  tooVague: boolean;
  parts: SavedSuggestionPart[];
}

// What the routes return. Provider fields are today's values; only the reason is from when it was written.
export interface SuggestionPickDto {
  provider: ProviderListItem;
  reason: string;
}

export interface SuggestionPartDto {
  name: string;
  why: string;
  // null when no category fit, or the category has since been deleted
  category: { id: string; name: string } | null;
  searchUrl: string;
  poolSize: number;
  picks: SuggestionPickDto[];
}

export interface ProjectSuggestionDto {
  tooVague: boolean;
  extraText: string | null;
  createdAt: Date | string;
  parts: SuggestionPartDto[];
}

export interface SuggestionFallbackDto {
  category: { id: string; name: string };
  providers: ProviderListItem[];
  searchUrl: string;
}

export interface SuggestionStateResponse {
  enabled: boolean;
  limitReached: boolean;
  suggestion: ProjectSuggestionDto | null;
}

export type SuggestionRunStatus = 'ok' | 'too_vague' | 'failed';

export interface SuggestionRunResponse {
  status: SuggestionRunStatus;
  limitReached: boolean;
  // on 'failed' this is the previously saved result, or null
  suggestion: ProjectSuggestionDto | null;
  // set only on 'failed', and only when the project has a saved provider category
  fallback: SuggestionFallbackDto | null;
}
```

- [ ] **Step 5: Write `utils/google-search.ts`**

```ts
// Search phrases come from a model; the link is always built here so it can only ever be a Google search.
export const withNearMe = (phrase: string): string => {
  const tidy = phrase.trim().replace(/\s+/g, ' ');
  return /near me$/i.test(tidy) ? tidy : `${tidy} near me`;
};

export const googleSearchUrl = (phrase: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(phrase.trim())}`;
```

- [ ] **Step 6: Write `server/utils/provider-ranking.ts`**

```ts
import { type ProviderStatusKind } from '@/types/provider';
import { MAX_FALLBACK_PROVIDERS } from '@/types/suggestion';

// The fields the fixed ranking reads. ProviderListItem satisfies this.
export interface Rankable {
  name: string;
  rating: number | null;
  neighborCount: number;
  lastSightingAt: Date | string | null;
  status: { kind: ProviderStatusKind };
}

const timeOf = (value: Date | string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const tierOf = (provider: Rankable): number => (provider.status.kind === 'positive' ? 0 : 1);

// The fixed rules ranking: the household's own positive statuses first, then rating, neighbor
// recommendations, recency and name. Negative statuses are excluded by kind, so renamed statuses keep working.
export const rankProviders = <T extends Rankable>(items: T[]): T[] =>
  items
    .filter((provider) => provider.status.kind !== 'negative')
    .sort(
      (a, b) =>
        tierOf(a) - tierOf(b) ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        b.neighborCount - a.neighborCount ||
        timeOf(b.lastSightingAt) - timeOf(a.lastSightingAt) ||
        a.name.localeCompare(b.name),
    );

// Shown when the model call fails. A provider nobody has vouched for is left out.
export const fallbackProviders = <T extends Rankable>(items: T[]): T[] =>
  rankProviders(items)
    .filter((provider) => provider.status.kind === 'positive' || provider.neighborCount > 0 || provider.rating !== null)
    .slice(0, MAX_FALLBACK_PROVIDERS);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/utils/provider-ranking.test.ts tests/unit/utils/google-search.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 8: Add the models to `prisma/schema.prisma`**

Add after the `ProjectProvider` model:

```prisma
// The latest AI provider suggestion for a project. "Suggest again" replaces it.
model ProjectSuggestion {
  id          String   @id @default(uuid())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String   @unique
  extraText   String?  // what was typed in "Anything to add?"
  result      Json     // SavedSuggestionResult in types/suggestion.ts
  model       String   // the model that produced it
  createdBy   User     @relation("ProjectSuggestionCreatedBy", fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())

  @@map("project_suggestions")
}

// One row per AI ask. Holds no project or provider text; the daily cap counts these rows.
model AiRequestLog {
  id           String    @id @default(uuid())
  household    Household @relation(fields: [householdId], references: [id])
  householdId  String
  userId       String
  feature      String    // provider_suggestions
  model        String
  outcome      String    // started, ok, too_vague, failed
  durationMs   Int?
  promptTokens Int?      // summed over the calls in the ask, when the service reports them
  outputTokens Int?
  createdAt    DateTime  @default(now())

  @@index([householdId, feature, createdAt])
  @@map("ai_request_logs")
}
```

Add one line to each of these existing models, beside their other relation fields:

- `Project`: `suggestion  ProjectSuggestion?`
- `User`: `projectSuggestions     ProjectSuggestion[]     @relation("ProjectSuggestionCreatedBy")`
- `Household`: `aiRequestLogs      AiRequestLog[]`

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema at prisma/schema.prisma is valid" and a generated client.

- [ ] **Step 9: Write the migration by hand**

Run: `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/full-schema.sql` (this does not contact the database). In its output find every statement that mentions `project_suggestions` or `ai_request_logs`. Those statements are the authority for column types and constraint names.

Create `prisma/migrations/20261005120000_add_project_suggestions/migration.sql` with those statements in this order, plus the two unlock lines. It should read as below; if the diff's text for any statement differs, use the diff's text and say so in the report.

```sql
-- CreateTable
CREATE TABLE "project_suggestions" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "extraText" STRING,
    "result" JSONB NOT NULL,
    "model" STRING NOT NULL,
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_suggestions_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "project_suggestions" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "feature" STRING NOT NULL,
    "model" STRING NOT NULL,
    "outcome" STRING NOT NULL,
    "durationMs" INT4,
    "promptTokens" INT4,
    "outputTokens" INT4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_request_logs" SET (schema_locked = false);

-- CreateIndex
CREATE UNIQUE INDEX "project_suggestions_projectId_key" ON "project_suggestions"("projectId");

-- CreateIndex
CREATE INDEX "ai_request_logs_householdId_feature_createdAt_idx" ON "ai_request_logs"("householdId", "feature", "createdAt");

-- AddForeignKey
ALTER TABLE "project_suggestions" ADD CONSTRAINT "project_suggestions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_suggestions" ADD CONSTRAINT "project_suggestions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Check: every statement in the diff that mentions either table appears in the migration, and the migration has nothing else except the two `schema_locked` lines and comments. Paste the relevant diff lines into the report. Do **not** run the migration.

- [ ] **Step 10: Run the full suite and the typecheck**

Run: `npx vitest run 2>&1 | tail -6` and `npx nuxi typecheck 2>&1 | grep -c "error TS"`
Expected: 51 files, 808 tests, all passing; the typecheck count equals the Step 1 baseline, and `npx nuxi typecheck 2>&1 | grep -E "suggestion|provider-ranking|google-search"` prints nothing.

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261005120000_add_project_suggestions/migration.sql types/suggestion.ts utils/google-search.ts server/utils/provider-ranking.ts tests/unit/utils/provider-ranking.test.ts tests/unit/utils/google-search.test.ts
git commit -m "feat: schema, migration, types and ranking for provider suggestions"
```

---

### Task 2: Model plumbing (settings, the Ollama call, prompts, reply checks)

**Files:**
- Create: `server/utils/ai-config.ts`, `server/utils/ollama.ts`, `server/utils/suggestion-schemas.ts`, `server/utils/suggestion-prompts.ts`, `server/utils/suggestion-checks.ts`
- Test: `tests/unit/utils/ai-config.test.ts`, `tests/unit/utils/ollama.test.ts`, `tests/unit/utils/suggestion-schemas.test.ts`, `tests/unit/utils/suggestion-prompts.test.ts`, `tests/unit/utils/suggestion-checks.test.ts`

**Interfaces:**
- Consumes: the constants and `SavedSuggestionPick` from `@/types/suggestion`; `withNearMe` from `@/utils/google-search`; `ProviderStatusKind` from `@/types/provider`.
- Produces:
  - `suggestionModel(): string`; `suggestionsEnabledFor(householdId: string): boolean`
  - `interface ModelCallInput { model: string; system: string; user: string; timeoutMs: number }`; `interface ModelCallResult { text: string; promptTokens: number | null; outputTokens: number | null }`; `type ModelCall = (input: ModelCallInput) => Promise<ModelCallResult>`; `callOllama: ModelCall`
  - `routingReplySchema`, `pickingReplySchema`, `savedResultSchema`, `suggestionRequestSchema`; `type RoutingReply`, `type PickingReply`; `parseModelJson(text: string): unknown`
  - `interface ProjectText { title: string; location: string | null; notes: string | null; extra: string | null }`; `interface PoolProvider { id: string; name: string; statusName: string; statusKind: ProviderStatusKind; rating: number | null; notes: string | null; comments: string[]; evidence: { kind: string; sourceDate: Date | null; snippet: string | null }[] }`; `interface PickingPart { partIndex: number; name: string; categoryName: string; pool: PoolProvider[] }`
  - `buildRoutingPrompt(project: ProjectText, categories: { id: string; name: string }[], today: string): { system: string; user: string; categoryIdByLabel: Map<string, string> }`
  - `buildPickingPrompt(project: ProjectText, parts: PickingPart[], today: string): { system: string; user: string; providerIdByLabel: Map<string, string>; labelsByPart: Map<number, Set<string>> }`
  - `interface CleanPart { name: string; why: string; categoryId: string | null; searchPhrase: string }`; `cleanParts(parts: RoutingReply['parts'], categoryIdByLabel: Map<string, string>): CleanPart[]`
  - `checkPicks(parts: PickingReply['parts'], providerIdByLabel: Map<string, string>, labelsByPart: Map<number, Set<string>>): Map<number, SavedSuggestionPick[]>`

No code in this task contacts Ollama. `fetch` is stubbed in the one test that exercises `callOllama`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/utils/ai-config.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { suggestionModel, suggestionsEnabledFor } from '@/server/utils/ai-config'

afterEach(() => vi.unstubAllEnvs())

describe('suggestionModel', () => {
  it('defaults to glm-5.3-flash', () => {
    vi.stubEnv('AI_SUGGESTIONS_MODEL', '')
    expect(suggestionModel()).toBe('glm-5.3-flash')
  })
  it('uses the setting when present', () => {
    vi.stubEnv('AI_SUGGESTIONS_MODEL', ' deepseek-v4.1-flash ')
    expect(suggestionModel()).toBe('deepseek-v4.1-flash')
  })
})

describe('suggestionsEnabledFor', () => {
  it('is on for a listed household when the key is set', () => {
    vi.stubEnv('OLLAMA_API_KEY', 'k')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1, h2')
    expect(suggestionsEnabledFor('h2')).toBe(true)
  })
  it('is off for a household that is not listed', () => {
    vi.stubEnv('OLLAMA_API_KEY', 'k')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
    expect(suggestionsEnabledFor('h9')).toBe(false)
  })
  it('is off when the list is empty or unset', () => {
    vi.stubEnv('OLLAMA_API_KEY', 'k')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', '')
    expect(suggestionsEnabledFor('h1')).toBe(false)
  })
  it('is off when the key is unset, even for a listed household', () => {
    vi.stubEnv('OLLAMA_API_KEY', '')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
    expect(suggestionsEnabledFor('h1')).toBe(false)
  })
})
```

`tests/unit/utils/ollama.test.ts`:

```ts
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { callOllama } from '@/server/utils/ollama'

const fetchMock = vi.fn()
const input = { model: 'glm-5.3-flash', system: 'sys', user: 'usr', timeoutMs: 5000 }
const respond = (body: unknown, ok = true, status = 200) => fetchMock.mockResolvedValue({ ok, status, json: async () => body })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('OLLAMA_API_KEY', 'secret-key')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  fetchMock.mockReset()
})

describe('callOllama', () => {
  it('posts one non-streaming chat request with the key as a bearer token', async () => {
    respond({ message: { content: '{"a":1}' }, prompt_eval_count: 12, eval_count: 34 })
    const result = await callOllama(input)
    expect(result).toEqual({ text: '{"a":1}', promptTokens: 12, outputTokens: 34 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ollama.com/api/chat')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer secret-key')
    expect(JSON.parse(init.body)).toEqual({
      model: 'glm-5.3-flash',
      stream: false,
      options: { temperature: 0 },
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'usr' }],
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('reports null token counts when the service does not send them', async () => {
    respond({ message: { content: 'x' } })
    expect(await callOllama(input)).toEqual({ text: 'x', promptTokens: null, outputTokens: null })
  })

  it('throws on a non-2xx response without echoing the body', async () => {
    respond({ error: 'the prompt was: secret text' }, false, 500)
    await expect(callOllama(input)).rejects.toThrow('Ollama returned HTTP 500')
  })

  it('throws when the reply has no content', async () => {
    respond({ message: { content: '   ' } })
    await expect(callOllama(input)).rejects.toThrow('Ollama returned no content')
  })

  it('throws before calling out when the key is unset', async () => {
    vi.stubEnv('OLLAMA_API_KEY', '')
    await expect(callOllama(input)).rejects.toThrow('OLLAMA_API_KEY is not set')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

`tests/unit/utils/suggestion-schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  parseModelJson, routingReplySchema, pickingReplySchema, savedResultSchema, suggestionRequestSchema,
} from '@/server/utils/suggestion-schemas'

describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 })
  })
  it('parses JSON wrapped in a code fence', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('parses JSON with prose before and after', () => {
    expect(parseModelJson('Here you go:\n{"a":{"b":2}}\nHope that helps.')).toEqual({ a: { b: 2 } })
  })
  it('throws on prose with no object', () => {
    expect(() => parseModelJson('## Part 0\n1. Miller Plumbing')).toThrow()
  })
  it('throws on a broken object', () => {
    expect(() => parseModelJson('{"a": 1,')).toThrow()
  })
})

describe('routingReplySchema', () => {
  const part = { name: 'Fix the leak', categoryId: 'c1', why: 'Because.', searchPhrase: 'leak plumber near me' }
  it('accepts a valid reply and a null category', () => {
    expect(routingReplySchema.safeParse({ tooVague: false, parts: [part, { ...part, categoryId: null }] }).success).toBe(true)
  })
  it('rejects renamed or missing fields', () => {
    expect(routingReplySchema.safeParse({ tooVague: false, parts: [{ name: 'x', why: 'y', search: 'z' }] }).success).toBe(false)
  })
  it('rejects an empty name', () => {
    expect(routingReplySchema.safeParse({ tooVague: false, parts: [{ ...part, name: '  ' }] }).success).toBe(false)
  })
  it('rejects a missing tooVague', () => {
    expect(routingReplySchema.safeParse({ parts: [] }).success).toBe(false)
  })
})

describe('pickingReplySchema', () => {
  it('accepts picks and empty picks', () => {
    const reply = { parts: [{ partIndex: 0, picks: [{ providerId: 'p1', reason: 'Good.' }] }, { partIndex: 1, picks: [] }] }
    expect(pickingReplySchema.safeParse(reply).success).toBe(true)
  })
  it('rejects a pick without a reason', () => {
    expect(pickingReplySchema.safeParse({ parts: [{ partIndex: 0, picks: [{ providerId: 'p1', reason: '' }] }] }).success).toBe(false)
  })
  it('rejects a non-integer part index', () => {
    expect(pickingReplySchema.safeParse({ parts: [{ partIndex: 'zero', picks: [] }] }).success).toBe(false)
  })
})

describe('savedResultSchema', () => {
  it('accepts what the service saves', () => {
    const saved = { tooVague: false, parts: [{ name: 'n', why: 'w', categoryId: null, searchPhrase: 's near me', poolSize: 0, picks: [] }] }
    expect(savedResultSchema.safeParse(saved).success).toBe(true)
  })
  it('rejects a shape it does not know', () => {
    expect(savedResultSchema.safeParse({ version: 2, trades: [] }).success).toBe(false)
  })
})

describe('suggestionRequestSchema', () => {
  it('trims the text and turns blank into null', () => {
    expect(suggestionRequestSchema.parse({ extraText: '  before Thanksgiving ' })).toEqual({ extraText: 'before Thanksgiving' })
    expect(suggestionRequestSchema.parse({ extraText: '   ' })).toEqual({ extraText: null })
    expect(suggestionRequestSchema.parse({})).toEqual({ extraText: null })
  })
  it('rejects more than 500 characters with the message', () => {
    const result = suggestionRequestSchema.safeParse({ extraText: 'x'.repeat(501) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Anything to add must be 500 characters or fewer')
  })
})
```

`tests/unit/utils/suggestion-prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildRoutingPrompt, buildPickingPrompt, type PoolProvider } from '@/server/utils/suggestion-prompts'

const project = { title: 'Water stain on ceiling', location: 'Dining room', notes: 'Under the upstairs bath.', extra: null }

const provider = (id: string, overrides: Partial<PoolProvider> = {}): PoolProvider => ({
  id, name: `Name ${id}`, statusName: 'Lead', statusKind: 'neutral', rating: null, notes: null, comments: [], evidence: [], ...overrides,
})

describe('buildRoutingPrompt', () => {
  const built = buildRoutingPrompt(project, [{ id: 'uuid-plumb', name: 'Plumber' }, { id: 'uuid-dry', name: 'Drywall' }], '2026-10-05')

  it('sends categories under labels and maps the labels back', () => {
    const sent = JSON.parse(built.user)
    expect(sent.categories).toEqual([{ id: 'c1', name: 'Plumber' }, { id: 'c2', name: 'Drywall' }])
    expect(built.categoryIdByLabel.get('c2')).toBe('uuid-dry')
  })
  it('sends the project text with blanks for missing fields', () => {
    expect(JSON.parse(built.user).project).toEqual({ title: 'Water stain on ceiling', location: 'Dining room', notes: 'Under the upstairs bath.', extra: '' })
  })
  it('never sends a database id', () => {
    expect(built.user).not.toContain('uuid-')
  })
  it('states the date and the JSON shape in the system prompt', () => {
    expect(built.system).toContain('Today is 2026-10-05.')
    expect(built.system).toContain('Reply with one JSON object and nothing else')
  })
})

describe('buildPickingPrompt', () => {
  const evidence = Array.from({ length: 10 }, (_, i) => ({
    kind: 'third_party', sourceDate: new Date(Date.UTC(2026, 0, i + 1)), snippet: `post ${i + 1} ${'x'.repeat(700)}`,
  }))
  const parts = [
    { partIndex: 0, name: 'Fix the leak', categoryName: 'Plumber', pool: [provider('uuid-a', { evidence, notes: 'n'.repeat(1200), comments: Array.from({ length: 12 }, (_, i) => `comment ${i}`) }), provider('uuid-b')] },
    { partIndex: 2, name: 'Repaint', categoryName: 'Painter', pool: [provider('uuid-c', { evidence: [{ kind: 'lead', sourceDate: null, snippet: null }] })] },
  ]
  const built = buildPickingPrompt(project, parts, '2026-10-05')
  const sent = JSON.parse(built.user)

  it('labels providers uniquely across the request and maps them back', () => {
    expect(sent.parts[0].pool.map((p: { id: string }) => p.id)).toEqual(['p1', 'p2'])
    expect(sent.parts[1].pool.map((p: { id: string }) => p.id)).toEqual(['p3'])
    expect(built.providerIdByLabel.get('p3')).toBe('uuid-c')
    expect([...built.labelsByPart.get(0)!]).toEqual(['p1', 'p2'])
    expect([...built.labelsByPart.get(2)!]).toEqual(['p3'])
  })
  it('keeps each part index as given', () => {
    expect(sent.parts.map((p: { partIndex: number }) => p.partIndex)).toEqual([0, 2])
  })
  it('sends the 8 most recent evidence rows, newest first, each cut to 600 characters', () => {
    const rows = sent.parts[0].pool[0].evidence
    expect(rows).toHaveLength(8)
    expect(rows[0].date).toBe('2026-01-10')
    expect(rows[7].date).toBe('2026-01-03')
    expect(rows[0].snippet).toHaveLength(600)
  })
  it('cuts notes to 1000 characters and comments to the first 10', () => {
    expect(sent.parts[0].pool[0].notes).toHaveLength(1000)
    expect(sent.parts[0].pool[0].comments).toHaveLength(10)
  })
  it('sends a null date and an empty snippet as they are', () => {
    expect(sent.parts[1].pool[0].evidence).toEqual([{ kind: 'lead', date: null, snippet: '' }])
  })
  it('sends exactly the agreed provider fields and no database id', () => {
    expect(Object.keys(sent.parts[0].pool[0]).sort()).toEqual(['comments', 'evidence', 'id', 'name', 'notes', 'rating', 'status', 'statusKind'])
    expect(built.user).not.toContain('uuid-')
  })
})
```

`tests/unit/utils/suggestion-checks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cleanParts, checkPicks } from '@/server/utils/suggestion-checks'

const labels = new Map([['c1', 'uuid-plumb'], ['c2', 'uuid-dry']])
const part = (name: string, categoryId: string | null, searchPhrase = 'find one') => ({ name, categoryId, why: 'why', searchPhrase })

describe('cleanParts', () => {
  it('maps labels to category ids and finishes the search phrase', () => {
    expect(cleanParts([part('Leak', 'c1', 'leak plumber')], labels)).toEqual([
      { name: 'Leak', why: 'why', categoryId: 'uuid-plumb', searchPhrase: 'leak plumber near me' },
    ])
  })
  it('turns an unknown or invented category into none', () => {
    expect(cleanParts([part('Masonry', 'c9'), part('Other', 'Masonry')], labels).map((p) => p.categoryId)).toEqual([null, null])
  })
  it('drops a later part that repeats a category, but keeps several parts with none', () => {
    const cleaned = cleanParts([part('A', 'c1'), part('B', 'c1'), part('C', null), part('D', null)], labels)
    expect(cleaned.map((p) => p.name)).toEqual(['A', 'C', 'D'])
  })
  it('keeps at most four parts', () => {
    const many = [part('1', null), part('2', null), part('3', null), part('4', null), part('5', null)]
    expect(cleanParts(many, labels)).toHaveLength(4)
  })
})

describe('checkPicks', () => {
  const ids = new Map([['p1', 'uuid-a'], ['p2', 'uuid-b'], ['p3', 'uuid-c']])
  const byPart = new Map([[0, new Set(['p1', 'p2'])], [1, new Set(['p3'])]])
  const pick = (providerId: string, reason = 'r') => ({ providerId, reason })

  it('maps labels back to provider ids, keeping order', () => {
    const result = checkPicks([{ partIndex: 0, picks: [pick('p2', 'second'), pick('p1', 'first')] }], ids, byPart)
    expect(result.get(0)).toEqual([{ providerId: 'uuid-b', reason: 'second' }, { providerId: 'uuid-a', reason: 'first' }])
  })
  it('drops a label that is not in the request at all', () => {
    expect(checkPicks([{ partIndex: 0, picks: [pick('p99'), pick('p1')] }], ids, byPart).get(0)).toEqual([{ providerId: 'uuid-a', reason: 'r' }])
  })
  it("drops a provider from another part's pool", () => {
    expect(checkPicks([{ partIndex: 0, picks: [pick('p3')] }], ids, byPart).get(0)).toEqual([])
  })
  it('drops a duplicate pick within a part', () => {
    expect(checkPicks([{ partIndex: 0, picks: [pick('p1'), pick('p1')] }], ids, byPart).get(0)).toHaveLength(1)
  })
  it('keeps at most three picks', () => {
    const wide = new Map([[0, new Set(['p1', 'p2', 'p3', 'p4'])]])
    const wideIds = new Map([['p1', 'a'], ['p2', 'b'], ['p3', 'c'], ['p4', 'd']])
    expect(checkPicks([{ partIndex: 0, picks: [pick('p1'), pick('p2'), pick('p3'), pick('p4')] }], wideIds, wide).get(0)).toHaveLength(3)
  })
  it('ignores a part index that was never sent, and a repeated part index', () => {
    const result = checkPicks([{ partIndex: 7, picks: [pick('p1')] }, { partIndex: 1, picks: [pick('p3')] }, { partIndex: 1, picks: [] }], ids, byPart)
    expect(result.has(7)).toBe(false)
    expect(result.get(1)).toEqual([{ providerId: 'uuid-c', reason: 'r' }])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/utils/ai-config.test.ts tests/unit/utils/ollama.test.ts tests/unit/utils/suggestion-schemas.test.ts tests/unit/utils/suggestion-prompts.test.ts tests/unit/utils/suggestion-checks.test.ts`
Expected: FAIL, the modules cannot be resolved.

- [ ] **Step 3: Write `server/utils/ai-config.ts`**

```ts
import { DEFAULT_SUGGESTION_MODEL } from '@/types/suggestion';

// Read at call time, not through runtimeConfig, so a changed setting takes effect on the next deploy without a code change.
export const suggestionModel = (): string => process.env.AI_SUGGESTIONS_MODEL?.trim() || DEFAULT_SUGGESTION_MODEL;

// Suggestions send household data to an outside model, so a household has to be listed by hand.
export const suggestionsEnabledFor = (householdId: string): boolean => {
  if (!process.env.OLLAMA_API_KEY) return false;
  const allowed = (process.env.AI_SUGGESTIONS_HOUSEHOLD_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes(householdId);
};
```

- [ ] **Step 4: Write `server/utils/ollama.ts`**

```ts
export interface ModelCallInput {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
}

export interface ModelCallResult {
  text: string;
  // null when the service does not report them
  promptTokens: number | null;
  outputTokens: number | null;
}

export type ModelCall = (input: ModelCallInput) => Promise<ModelCallResult>;

const OLLAMA_CHAT_URL = 'https://ollama.com/api/chat';

interface OllamaChatResponse {
  message?: { content?: unknown };
  prompt_eval_count?: unknown;
  eval_count?: unknown;
}

const countOf = (value: unknown): number | null => (typeof value === 'number' ? value : null);

// One non-streaming chat call. Errors carry a status or a fixed message only, never the prompt, the reply or the key.
export const callOllama: ModelCall = async ({ model, system, user, timeoutMs }) => {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error('OLLAMA_API_KEY is not set');

  const response = await fetch(OLLAMA_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);

  const body = (await response.json()) as OllamaChatResponse;
  const text = body.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Ollama returned no content');
  return { text, promptTokens: countOf(body.prompt_eval_count), outputTokens: countOf(body.eval_count) };
};
```

- [ ] **Step 5: Write `server/utils/suggestion-schemas.ts`**

```ts
import { z } from 'zod';
import { MAX_EXTRA_TEXT_LENGTH } from '@/types/suggestion';

// The service's own setting for forcing a reply shape was shown not to hold (bake-off, 2026-10-05), so every reply is parsed and validated here.
export const parseModelJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    // fall through: the reply may be wrapped in a code fence or have prose around it
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Reply is not JSON');
  return JSON.parse(text.slice(start, end + 1));
};

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const routingReplySchema = z.object({
  tooVague: z.boolean(),
  parts: z.array(
    z.object({
      name: shortText(100),
      categoryId: z.string().nullable(),
      why: shortText(500),
      searchPhrase: shortText(150),
    }),
  ),
});
export type RoutingReply = z.infer<typeof routingReplySchema>;

export const pickingReplySchema = z.object({
  parts: z.array(
    z.object({
      partIndex: z.number().int(),
      picks: z.array(z.object({ providerId: z.string(), reason: shortText(600) })),
    }),
  ),
});
export type PickingReply = z.infer<typeof pickingReplySchema>;

// What is stored in project_suggestions.result. A row this build cannot read is treated as no suggestion.
export const savedResultSchema = z.object({
  tooVague: z.boolean(),
  parts: z.array(
    z.object({
      name: z.string(),
      why: z.string(),
      categoryId: z.string().nullable(),
      searchPhrase: z.string(),
      poolSize: z.number().int(),
      picks: z.array(z.object({ providerId: z.string(), reason: z.string() })),
    }),
  ),
});

const TOO_LONG = `Anything to add must be ${MAX_EXTRA_TEXT_LENGTH} characters or fewer`;

export const suggestionRequestSchema = z.object({
  extraText: z
    .string({ invalid_type_error: TOO_LONG })
    .trim()
    .max(MAX_EXTRA_TEXT_LENGTH, TOO_LONG)
    .nullish()
    .transform((value) => (value ? value : null)),
});
```

- [ ] **Step 6: Write `server/utils/suggestion-prompts.ts`**

```ts
import { type ProviderStatusKind } from '@/types/provider';
import {
  MAX_COMMENTS_PER_PROVIDER,
  MAX_EVIDENCE_PER_PROVIDER,
  MAX_PROVIDER_NOTES_LENGTH,
  MAX_SNIPPET_LENGTH,
} from '@/types/suggestion';

export interface ProjectText {
  title: string;
  location: string | null;
  notes: string | null;
  // what was typed in "Anything to add?"
  extra: string | null;
}

// Everything about a provider that may be sent to the model. It has no contact details and no source links by construction.
export interface PoolProvider {
  id: string;
  name: string;
  statusName: string;
  statusKind: ProviderStatusKind;
  rating: number | null;
  notes: string | null;
  // newest first, text only
  comments: string[];
  evidence: { kind: string; sourceDate: Date | null; snippet: string | null }[];
}

export interface PickingPart {
  // index into the full list of parts, so the reply can be matched back
  partIndex: number;
  name: string;
  categoryName: string;
  pool: PoolProvider[];
}

const routingSystem = (today: string): string => `You help a household plan a home project by working out which kinds of contractor it needs.
Split the project into parts, one per trade, in the order the work would happen. Use at most 4 parts. A simple problem is one part.
Each part must use a categoryId from the household's category list, or null if no listed category fits. Never invent a category.
For each part give: a short name (under 40 characters), one sentence on why that trade is needed for this specific project, and a short Google search phrase for finding that kind of contractor for this specific problem, ending in "near me".
If the project text is too vague to tell what work is needed, set tooVague to true and return no parts.
Today is ${today}.

Reply with one JSON object and nothing else: no prose before or after, no markdown, no code fences. Use exactly these keys:
{"tooVague": false, "parts": [{"name": "...", "categoryId": "c1", "why": "...", "searchPhrase": "... near me"}]}
categoryId is one of the listed category ids, or null.`;

const pickingSystem = (today: string): string => `You help a household shortlist contractors for a home project. For each part of the project you are given a pool of providers from the household's own directory. Pick up to 3 providers per part, best first, and give a reason for each.

Rules:
- Only pick providers from that part's pool, by their id. Never pick anyone else.
- The household's own record (their status, their rating, their notes, their comments) outweighs neighbor posts.
- Evidence kinds: "third_party" is a neighbor's own words about the provider and may be positive or negative, so read it. "self_promo" is the business advertising itself and is never a reason to pick it. "lead" is an unverified mention or a question and is not a recommendation.
- Prefer evidence that matches this specific problem over general praise.
- Do not pad. If fewer than 3 providers have real grounds, pick fewer. If none do, pick none.
- Each reason is one or two plain sentences, written to the household ("You rated them 4..."). State only what the record says. If the evidence is thin or old, say so in the reason. Do not use the provider id in the reason.
Today is ${today}.

Reply with one JSON object and nothing else: no prose before or after, no markdown, no code fences, no list of providers you skipped. Use exactly these keys:
{"parts": [{"partIndex": 0, "picks": [{"providerId": "p1", "reason": "..."}]}]}
Include every part, in order. A part with no picks has "picks": [].`;

const projectPayload = (project: ProjectText) => ({
  title: project.title,
  location: project.location ?? '',
  notes: project.notes ?? '',
  extra: project.extra ?? '',
});

export const buildRoutingPrompt = (
  project: ProjectText,
  categories: { id: string; name: string }[],
  today: string,
): { system: string; user: string; categoryIdByLabel: Map<string, string> } => {
  const categoryIdByLabel = new Map<string, string>();
  const listed = categories.map((category, index) => {
    const label = `c${index + 1}`;
    categoryIdByLabel.set(label, category.id);
    return { id: label, name: category.name };
  });
  return {
    system: routingSystem(today),
    user: JSON.stringify({ project: projectPayload(project), categories: listed }, null, 1),
    categoryIdByLabel,
  };
};

const timeOf = (date: Date | null): number => (date ? date.getTime() : 0);

const evidencePayload = (evidence: PoolProvider['evidence']) =>
  [...evidence]
    .sort((a, b) => timeOf(b.sourceDate) - timeOf(a.sourceDate))
    .slice(0, MAX_EVIDENCE_PER_PROVIDER)
    .map((row) => ({
      kind: row.kind,
      date: row.sourceDate ? row.sourceDate.toISOString().slice(0, 10) : null,
      snippet: (row.snippet ?? '').slice(0, MAX_SNIPPET_LENGTH),
    }));

export const buildPickingPrompt = (
  project: ProjectText,
  parts: PickingPart[],
  today: string,
): { system: string; user: string; providerIdByLabel: Map<string, string>; labelsByPart: Map<number, Set<string>> } => {
  const providerIdByLabel = new Map<string, string>();
  const labelsByPart = new Map<number, Set<string>>();
  let next = 1;

  const listed = parts.map((part) => {
    const labels = new Set<string>();
    labelsByPart.set(part.partIndex, labels);
    return {
      partIndex: part.partIndex,
      name: part.name,
      category: part.categoryName,
      pool: part.pool.map((provider) => {
        const label = `p${next++}`;
        providerIdByLabel.set(label, provider.id);
        labels.add(label);
        return {
          id: label,
          name: provider.name,
          status: provider.statusName,
          statusKind: provider.statusKind,
          rating: provider.rating,
          notes: provider.notes ? provider.notes.slice(0, MAX_PROVIDER_NOTES_LENGTH) : null,
          comments: provider.comments.slice(0, MAX_COMMENTS_PER_PROVIDER).map((body) => body.slice(0, MAX_SNIPPET_LENGTH)),
          evidence: evidencePayload(provider.evidence),
        };
      }),
    };
  });

  return {
    system: pickingSystem(today),
    user: JSON.stringify({ project: projectPayload(project), parts: listed }, null, 1),
    providerIdByLabel,
    labelsByPart,
  };
};
```

- [ ] **Step 7: Write `server/utils/suggestion-checks.ts`**

```ts
import { type PickingReply, type RoutingReply } from '@/server/utils/suggestion-schemas';
import { MAX_PICKS_PER_PART, MAX_SUGGESTION_PARTS, type SavedSuggestionPick } from '@/types/suggestion';
import { withNearMe } from '@/utils/google-search';

export interface CleanPart {
  name: string;
  why: string;
  categoryId: string | null;
  searchPhrase: string;
}

// The limits on routing that the model cannot be trusted to keep: known categories only, one part per category, at most four parts.
export const cleanParts = (parts: RoutingReply['parts'], categoryIdByLabel: Map<string, string>): CleanPart[] => {
  const used = new Set<string>();
  const cleaned: CleanPart[] = [];
  for (const part of parts) {
    const categoryId = part.categoryId ? categoryIdByLabel.get(part.categoryId) ?? null : null;
    if (categoryId) {
      if (used.has(categoryId)) continue;
      used.add(categoryId);
    }
    cleaned.push({ name: part.name, why: part.why, categoryId, searchPhrase: withNearMe(part.searchPhrase) });
    if (cleaned.length === MAX_SUGGESTION_PARTS) break;
  }
  return cleaned;
};

// The limits on picking: only providers from that part's own pool, no repeats, at most three. Anything else is dropped without comment.
export const checkPicks = (
  parts: PickingReply['parts'],
  providerIdByLabel: Map<string, string>,
  labelsByPart: Map<number, Set<string>>,
): Map<number, SavedSuggestionPick[]> => {
  const checked = new Map<number, SavedSuggestionPick[]>();
  for (const part of parts) {
    const allowed = labelsByPart.get(part.partIndex);
    if (!allowed || checked.has(part.partIndex)) continue;
    const seen = new Set<string>();
    const picks: SavedSuggestionPick[] = [];
    for (const pick of part.picks) {
      const providerId = allowed.has(pick.providerId) ? providerIdByLabel.get(pick.providerId) : undefined;
      if (!providerId || seen.has(providerId)) continue;
      seen.add(providerId);
      picks.push({ providerId, reason: pick.reason });
      if (picks.length === MAX_PICKS_PER_PART) break;
    }
    checked.set(part.partIndex, picks);
  }
  return checked;
};
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: the command from Step 2.
Expected: PASS, 47 tests in 5 files.

- [ ] **Step 9: Run the full suite and the typecheck, then commit**

Run: `npx vitest run 2>&1 | tail -6` (expected: 56 files, 855 tests, all passing) and `npx nuxi typecheck 2>&1 | grep -E "ai-config|ollama|suggestion"` (expected: no output).

```bash
git add server/utils/ai-config.ts server/utils/ollama.ts server/utils/suggestion-schemas.ts server/utils/suggestion-prompts.ts server/utils/suggestion-checks.ts tests/unit/utils/ai-config.test.ts tests/unit/utils/ollama.test.ts tests/unit/utils/suggestion-schemas.test.ts tests/unit/utils/suggestion-prompts.test.ts tests/unit/utils/suggestion-checks.test.ts
git commit -m "feat: model call, prompts and reply checks for provider suggestions"
```

---

### Task 3: ProviderSuggestionService

**Files:**
- Modify: `server/services/ProviderService.ts` (extract `toProviderListItem`; lines 49-74 today)
- Create: `server/services/ProviderSuggestionService.ts`
- Test: `tests/unit/services/provider-suggestion-service.test.ts`

**Interfaces:**
- Consumes: everything Task 1 and Task 2 produce, with the exact signatures in their Interfaces blocks; `HttpError` from `@/server/utils/api-errors`; `summarizeEvidence` from `@/server/utils/provider-evidence`.
- Produces:
  - `toProviderListItem(row: ProviderListRow): ProviderListItem` exported from `ProviderService.ts`
  - `class ProviderSuggestionService { constructor(callModel?: ModelCall, now?: () => number); getState(householdId: string, projectId: string): Promise<SuggestionStateResponse>; run(householdId: string, userId: string, projectId: string, extraText: string | null): Promise<SuggestionRunResponse> }`

- [ ] **Step 1: Re-run the caller audit for `ProviderService.list`**

Run: `grep -rn "\.list(" server/api/providers server/services | grep -v node_modules` and `grep -rn "ProviderService" tests/unit/services/provider-service.test.ts | head -3`
Expected: one caller, `server/api/providers/index.get.ts`, and the existing test file. If there is another caller, stop and report it.

- [ ] **Step 2: Extract the mapper in `server/services/ProviderService.ts`**

Add above `export class ProviderService`:

```ts
// The fields a provider row needs to become a list item. A row with more (notes, snippets) also fits.
export interface ProviderListRow {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  rating: number | null;
  category: { id: string; name: string; sortOrder: number };
  status: { id: string; name: string; kind: string; hiddenByDefault: boolean; sortOrder: number };
  evidence: { kind: string; sourceDate: Date | null }[];
}

export const toProviderListItem = (row: ProviderListRow): ProviderListItem => ({
  id: row.id,
  name: row.name,
  company: row.company,
  phone: row.phone,
  rating: row.rating,
  category: { id: row.category.id, name: row.category.name, sortOrder: row.category.sortOrder },
  status: {
    id: row.status.id,
    name: row.status.name,
    kind: row.status.kind as ProviderStatusKind,
    hiddenByDefault: row.status.hiddenByDefault,
    sortOrder: row.status.sortOrder,
  },
  ...summarizeEvidence(row.evidence),
});
```

In `list`, replace the whole `const items: ProviderListItem[] = rows.map((row) => ({ ... }));` statement with:

```ts
    const items: ProviderListItem[] = rows.map(toProviderListItem);
```

Run: `npx vitest run tests/unit/services/provider-service.test.ts`
Expected: PASS with the same test count as before the change. No test in that file may be edited.

- [ ] **Step 3: Write the failing tests**

`tests/unit/services/provider-suggestion-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    providerCategory: { findMany: vi.fn(), findFirst: vi.fn() },
    provider: { findMany: vi.fn() },
    projectSuggestion: { findUnique: vi.fn(), upsert: vi.fn() },
    aiRequestLog: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderSuggestionService } from '@/server/services/ProviderSuggestionService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const PLUMB = { id: 'cat-plumb', name: 'Plumber' }
const DRY = { id: 'cat-dry', name: 'Drywall' }

const providerRow = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id, name, company: null, phone: '614-555-0101', email: 'owner@example.com', rating: null, notes: null,
  categoryId: PLUMB.id,
  category: { ...PLUMB, sortOrder: 0 },
  status: { id: 's-lead', name: 'Lead', kind: 'neutral', hiddenByDefault: true, sortOrder: 0 },
  evidence: [],
  comments: [],
  ...overrides,
})

const alpha = providerRow('prov-alpha', 'Alpha Plumbing', {
  evidence: [{ kind: 'third_party', sourceDate: new Date('2026-08-01'), snippet: 'Alpha fixed our leak.', sourceUrl: 'https://fb.example/post1', sourceGroup: 'Neighbors Group' }],
})
const beta = providerRow('prov-beta', 'Beta Plumbing')

const reply = (body: unknown) => ({ text: JSON.stringify(body), promptTokens: 100, outputTokens: 50 })
const routingOk = { tooVague: false, parts: [{ name: 'Fix the leak', categoryId: 'c1', why: 'It leaks.', searchPhrase: 'leak plumber' }] }
const pickingOk = { parts: [{ partIndex: 0, picks: [{ providerId: 'p1', reason: 'A neighbor says they fixed a leak.' }, { providerId: 'p9', reason: 'Not in the pool.' }] }] }

let model: ReturnType<typeof vi.fn>
let clock: number
let service: ProviderSuggestionService
let poolRows: unknown[]
let readRows: unknown[]
let fallbackRows: unknown[]

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('OLLAMA_API_KEY', 'k')
  vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
  vi.stubEnv('AI_SUGGESTIONS_MODEL', '')
  clock = Date.UTC(2026, 9, 5, 12)
  model = vi.fn()
  service = new ProviderSuggestionService(model, () => clock)
  poolRows = [beta, alpha]
  readRows = [alpha]
  fallbackRows = []
  db.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Water stain', location: 'Dining room', notes: 'Under the bath.', providerCategoryId: null })
  db.providerCategory.findMany.mockResolvedValue([PLUMB, DRY])
  db.providerCategory.findFirst.mockResolvedValue(PLUMB)
  // The three provider queries are told apart by their where clause.
  db.provider.findMany.mockImplementation(async (args: { where: { id?: unknown; categoryId?: unknown } }) => {
    if (args.where.id) return readRows
    if (typeof args.where.categoryId === 'string') return fallbackRows
    return poolRows
  })
  db.projectSuggestion.findUnique.mockResolvedValue(null)
  db.projectSuggestion.upsert.mockResolvedValue({})
  db.aiRequestLog.count.mockResolvedValue(0)
  db.aiRequestLog.create.mockResolvedValue({ id: 'log1' })
  db.aiRequestLog.update.mockResolvedValue({})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const savedArgs = () => db.projectSuggestion.upsert.mock.calls[0][0]

describe('getState', () => {
  it('returns 404 for a project in another household or a deleted one', async () => {
    db.project.findFirst.mockResolvedValue(null)
    await expect(service.getState('h1', 'p1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
  })

  it('reports not enabled for an unlisted household and looks nothing else up', async () => {
    expect(await service.getState('h9', 'p1')).toEqual({ enabled: false, limitReached: false, suggestion: null })
    expect(db.aiRequestLog.count).not.toHaveBeenCalled()
    expect(db.projectSuggestion.findUnique).not.toHaveBeenCalled()
  })

  it('reports enabled with no suggestion saved', async () => {
    expect(await service.getState('h1', 'p1')).toEqual({ enabled: true, limitReached: false, suggestion: null })
  })

  it('reports the limit reached at 20 asks in the last 24 hours', async () => {
    db.aiRequestLog.count.mockResolvedValue(20)
    expect((await service.getState('h1', 'p1')).limitReached).toBe(true)
    const where = db.aiRequestLog.count.mock.calls[0][0].where
    expect(where.householdId).toBe('h1')
    expect(where.feature).toBe('provider_suggestions')
    expect(where.createdAt.gte).toEqual(new Date(clock - 24 * 60 * 60 * 1000))
  })
})

describe('readSuggestion (through getState)', () => {
  const saved = (result: unknown) =>
    db.projectSuggestion.findUnique.mockResolvedValue({ extraText: 'soon', result, createdAt: new Date('2026-10-05T10:00:00Z') })
  const part = (overrides: Record<string, unknown> = {}) => ({
    name: 'Fix the leak', why: 'It leaks.', categoryId: PLUMB.id, searchPhrase: 'leak plumber near me', poolSize: 2,
    picks: [{ providerId: 'prov-alpha', reason: 'Good.' }, { providerId: 'prov-gone', reason: 'Was good.' }], ...overrides,
  })

  it('returns current provider fields, the saved reason, the category name and a Google link', async () => {
    saved({ tooVague: false, parts: [part()] })
    const { suggestion } = await service.getState('h1', 'p1')
    expect(suggestion).toMatchObject({ tooVague: false, extraText: 'soon', createdAt: new Date('2026-10-05T10:00:00Z') })
    expect(suggestion!.parts[0]).toMatchObject({
      name: 'Fix the leak', category: PLUMB, poolSize: 2,
      searchUrl: 'https://www.google.com/search?q=leak%20plumber%20near%20me',
    })
    expect(suggestion!.parts[0].picks).toHaveLength(1)
    expect(suggestion!.parts[0].picks[0]).toMatchObject({ reason: 'Good.', provider: { id: 'prov-alpha', name: 'Alpha Plumbing', neighborCount: 1 } })
  })

  it('drops a pick whose provider was deleted or now has a negative status, by asking only for eligible ones', async () => {
    saved({ tooVague: false, parts: [part()] })
    await service.getState('h1', 'p1')
    const where = db.provider.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ householdId: 'h1', metaStatus: 'active', status: { kind: { not: 'negative' } } })
    expect(where.id).toEqual({ in: ['prov-alpha', 'prov-gone'] })
  })

  it('shows no category when it has since been deleted', async () => {
    saved({ tooVague: false, parts: [part({ categoryId: 'cat-deleted' })] })
    const { suggestion } = await service.getState('h1', 'p1')
    expect(suggestion!.parts[0].category).toBeNull()
  })

  it('returns a too-vague result with no parts and makes no provider query', async () => {
    saved({ tooVague: true, parts: [] })
    const { suggestion } = await service.getState('h1', 'p1')
    expect(suggestion).toMatchObject({ tooVague: true, parts: [] })
    expect(db.provider.findMany).not.toHaveBeenCalled()
  })

  it('ignores a saved result it cannot read', async () => {
    saved({ version: 2, trades: ['plumber'] })
    expect((await service.getState('h1', 'p1')).suggestion).toBeNull()
  })
})

describe('run', () => {
  it('returns 404 for a project in another household', async () => {
    db.project.findFirst.mockResolvedValue(null)
    await expect(service.run('h1', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 403 for an unlisted household without logging or calling the model', async () => {
    await expect(service.run('h9', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 403, message: 'Suggestions are not available' })
    expect(db.aiRequestLog.create).not.toHaveBeenCalled()
    expect(model).not.toHaveBeenCalled()
  })

  it('returns 429 at the cap without logging or calling the model', async () => {
    db.aiRequestLog.count.mockResolvedValue(20)
    await expect(service.run('h1', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 429, message: 'Daily limit reached. Try again later.' })
    expect(db.aiRequestLog.create).not.toHaveBeenCalled()
    expect(model).not.toHaveBeenCalled()
  })

  it('routes, builds the pool, picks, checks, saves and logs', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    const response = await service.run('h1', 'u1', 'p1', 'before Thanksgiving')

    expect(response.status).toBe('ok')
    expect(response.fallback).toBeNull()
    expect(model).toHaveBeenCalledTimes(2)
    expect(model.mock.calls[0][0].model).toBe('glm-5.3-flash')

    // Alpha has a neighbor recommendation, so the fixed ranking puts it first: p1 is Alpha.
    expect(savedArgs().where).toEqual({ projectId: 'p1' })
    expect(savedArgs().create).toMatchObject({ projectId: 'p1', extraText: 'before Thanksgiving', model: 'glm-5.3-flash', createdById: 'u1' })
    expect(savedArgs().create.result).toEqual({
      tooVague: false,
      parts: [{
        name: 'Fix the leak', why: 'It leaks.', categoryId: PLUMB.id, searchPhrase: 'leak plumber near me', poolSize: 2,
        picks: [{ providerId: 'prov-alpha', reason: 'A neighbor says they fixed a leak.' }],
      }],
    })
    expect(savedArgs().update.result).toEqual(savedArgs().create.result)

    expect(db.aiRequestLog.update.mock.calls[0][0]).toEqual({
      where: { id: 'log1' },
      data: { outcome: 'ok', durationMs: 0, promptTokens: 200, outputTokens: 100 },
    })
  })

  it('builds the pool from eligible providers in the routed categories that are not on the project', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', null)
    expect(db.provider.findMany.mock.calls[0][0].where).toEqual({
      householdId: 'h1',
      metaStatus: 'active',
      status: { kind: { not: 'negative' } },
      categoryId: { in: [PLUMB.id] },
      projects: { none: { projectId: 'p1' } },
    })
  })

  it('sends no contact details, source links, group names or database ids to the model', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', 'extra words')
    const sent = model.mock.calls.map((call) => `${call[0].system}\n${call[0].user}`).join('\n')
    for (const secret of ['614-555-0101', 'owner@example.com', 'fb.example', 'Neighbors Group', 'prov-alpha', 'prov-beta', 'cat-plumb', 'h1"', 'u1"']) {
      expect(sent).not.toContain(secret)
    }
    expect(sent).toContain('Alpha fixed our leak.')
    expect(sent).toContain('extra words')
  })

  it('writes the log row before calling the model', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', null)
    expect(db.aiRequestLog.create.mock.calls[0][0].data).toEqual({
      householdId: 'h1', userId: 'u1', feature: 'provider_suggestions', model: 'glm-5.3-flash', outcome: 'started',
    })
    expect(db.aiRequestLog.create.mock.invocationCallOrder[0]).toBeLessThan(model.mock.invocationCallOrder[0])
  })

  it('reports the limit reached on the ask that uses the last one', async () => {
    db.aiRequestLog.count.mockResolvedValue(19)
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    expect((await service.run('h1', 'u1', 'p1', null)).limitReached).toBe(true)
  })

  it('saves a too-vague result and skips picking', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: true, parts: [] }))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('too_vague')
    expect(model).toHaveBeenCalledTimes(1)
    expect(savedArgs().create.result).toEqual({ tooVague: true, parts: [] })
    expect(db.aiRequestLog.update.mock.calls[0][0].data.outcome).toBe('too_vague')
  })

  it('treats a reply with no parts as too vague', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: false, parts: [] }))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('too_vague')
  })

  it('skips picking when every pool is empty, and keeps the part with a pool size of 0', async () => {
    poolRows = []
    model.mockResolvedValueOnce(reply(routingOk))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('ok')
    expect(model).toHaveBeenCalledTimes(1)
    expect(savedArgs().create.result.parts[0]).toMatchObject({ categoryId: PLUMB.id, poolSize: 0, picks: [] })
  })

  it('keeps a part with no matching category and does not query a pool for it', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: false, parts: [{ name: 'Rebuild the chimney', categoryId: null, why: 'Masonry.', searchPhrase: 'chimney mason near me' }] }))
    await service.run('h1', 'u1', 'p1', null)
    expect(savedArgs().create.result.parts[0]).toMatchObject({ categoryId: null, poolSize: 0, picks: [] })
    expect(db.provider.findMany).not.toHaveBeenCalled()
  })

  it('caps a pool at 40 by the fixed ranking', async () => {
    poolRows = Array.from({ length: 45 }, (_, i) => providerRow(`prov-${i}`, `Provider ${String(i).padStart(2, '0')}`))
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply({ parts: [{ partIndex: 0, picks: [] }] }))
    await service.run('h1', 'u1', 'p1', null)
    expect(JSON.parse(model.mock.calls[1][0].user).parts[0].pool).toHaveLength(40)
    expect(savedArgs().create.result.parts[0].poolSize).toBe(40)
  })

  it('retries once on a reply it cannot use', async () => {
    model
      .mockResolvedValueOnce({ text: '## Part 0\n1. Alpha Plumbing', promptTokens: 100, outputTokens: 50 })
      .mockResolvedValueOnce(reply(routingOk))
      .mockResolvedValueOnce(reply(pickingOk))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('ok')
    expect(model).toHaveBeenCalledTimes(3)
    expect(db.aiRequestLog.update.mock.calls[0][0].data).toMatchObject({ promptTokens: 300, outputTokens: 150 })
  })

  it('fails after two bad replies, saves nothing, and returns the previous result', async () => {
    db.projectSuggestion.findUnique.mockResolvedValue({ extraText: null, result: { tooVague: true, parts: [] }, createdAt: new Date('2026-10-01') })
    model.mockResolvedValue({ text: 'not json', promptTokens: null, outputTokens: null })
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(2)
    expect(db.projectSuggestion.upsert).not.toHaveBeenCalled()
    expect(response.suggestion).toMatchObject({ tooVague: true })
    expect(response.fallback).toBeNull()
    expect(db.aiRequestLog.update.mock.calls[0][0].data).toEqual({ outcome: 'failed', durationMs: 0, promptTokens: null, outputTokens: null })
  })

  it('fails when the model call throws, without retrying', async () => {
    model.mockRejectedValue(new Error('Ollama returned HTTP 500'))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(1)
  })

  it('does not start another call once the 45-second deadline has passed', async () => {
    model.mockImplementation(async () => {
      clock += 50_000
      return { text: 'not json', promptTokens: null, outputTokens: null }
    })
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(1)
    expect(model.mock.calls[0][0].timeoutMs).toBe(45_000)
    expect(db.aiRequestLog.update.mock.calls[0][0].data.durationMs).toBe(50_000)
  })

  it('returns the fallback list for the project category when the ask fails', async () => {
    db.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Water stain', location: null, notes: null, providerCategoryId: PLUMB.id })
    fallbackRows = [beta, alpha]
    model.mockRejectedValue(new Error('timeout'))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.fallback).toMatchObject({ category: PLUMB, searchUrl: 'https://www.google.com/search?q=Plumber%20near%20me' })
    // Beta has no rating and no neighbor recommendation, so the floor leaves it out.
    expect(response.fallback!.providers.map((p) => p.id)).toEqual(['prov-alpha'])
    const where = db.provider.findMany.mock.calls.at(-1)![0].where
    expect(where).toMatchObject({ categoryId: PLUMB.id, projects: { none: { projectId: 'p1' } } })
  })

  it('still answers when updating the log row fails', async () => {
    db.aiRequestLog.update.mockRejectedValue(new Error('db down'))
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('ok')
  })

  it('never logs prompt or reply text to the console', async () => {
    model.mockResolvedValue({ text: 'SECRET REPLY TEXT', promptTokens: null, outputTokens: null })
    await service.run('h1', 'u1', 'p1', 'SECRET EXTRA')
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).not.toContain('SECRET')
    expect(logged).not.toContain('Water stain')
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/services/provider-suggestion-service.test.ts`
Expected: FAIL, `ProviderSuggestionService` cannot be resolved.

- [ ] **Step 5: Write `server/services/ProviderSuggestionService.ts`**

```ts
import { type Prisma } from '@prisma/client';
import { type z } from 'zod';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { suggestionModel, suggestionsEnabledFor } from '@/server/utils/ai-config';
import { callOllama, type ModelCall } from '@/server/utils/ollama';
import { fallbackProviders, rankProviders } from '@/server/utils/provider-ranking';
import { checkPicks, cleanParts } from '@/server/utils/suggestion-checks';
import {
  buildPickingPrompt,
  buildRoutingPrompt,
  type PickingPart,
  type PoolProvider,
  type ProjectText,
} from '@/server/utils/suggestion-prompts';
import {
  parseModelJson,
  pickingReplySchema,
  routingReplySchema,
  savedResultSchema,
} from '@/server/utils/suggestion-schemas';
import { toProviderListItem } from '@/server/services/ProviderService';
import { type ProviderListItem, type ProviderStatusKind } from '@/types/provider';
import {
  DAILY_SUGGESTION_LIMIT,
  MAX_POOL_SIZE,
  PROVIDER_SUGGESTIONS_FEATURE,
  SUGGESTION_DEADLINE_MS,
  type ProjectSuggestionDto,
  type SavedSuggestionPick,
  type SavedSuggestionResult,
  type SuggestionFallbackDto,
  type SuggestionRunResponse,
  type SuggestionRunStatus,
  type SuggestionStateResponse,
} from '@/types/suggestion';
import { googleSearchUrl, withNearMe } from '@/utils/google-search';

const DAY_MS = 24 * 60 * 60 * 1000;
// A model call given less time than this cannot finish, so it is not started.
const MIN_CALL_MS = 2000;
const LIMIT_MESSAGE = 'Daily limit reached. Try again later.';

const projectSelect = {
  id: true,
  title: true,
  location: true,
  notes: true,
  providerCategoryId: true,
} satisfies Prisma.ProjectSelect;
type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

const listInclude = {
  category: true,
  status: true,
  evidence: { select: { kind: true, sourceDate: true } },
} satisfies Prisma.ProviderInclude;

// The only provider fields that may reach the model are read here: no phone, email, address or source links.
const poolInclude = {
  category: true,
  status: true,
  evidence: { select: { kind: true, sourceDate: true, snippet: true } },
  comments: { select: { body: true }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.ProviderInclude;
type PoolRow = Prisma.ProviderGetPayload<{ include: typeof poolInclude }>;

// A provider that may be suggested at all: in the household, not removed, not in a negative status.
const eligibleWhere = (householdId: string) =>
  ({ householdId, metaStatus: 'active', status: { kind: { not: 'negative' } } }) satisfies Prisma.ProviderWhereInput;

interface Usage {
  promptTokens: number;
  outputTokens: number;
  // false until the service reports a count at least once
  reported: boolean;
}

// An expected failure with a message that is safe to log: it never carries prompt or reply text.
class SuggestionError extends Error {}

const toPoolProvider = (row: PoolRow): PoolProvider => ({
  id: row.id,
  name: row.name,
  statusName: row.status.name,
  statusKind: row.status.kind as ProviderStatusKind,
  rating: row.rating,
  notes: row.notes,
  comments: row.comments.map((comment) => comment.body),
  evidence: row.evidence,
});

export class ProviderSuggestionService {
  constructor(
    private readonly callModel: ModelCall = callOllama,
    private readonly now: () => number = Date.now,
  ) {}

  async getState(householdId: string, projectId: string): Promise<SuggestionStateResponse> {
    await this.requireProject(householdId, projectId);
    if (!suggestionsEnabledFor(householdId)) return { enabled: false, limitReached: false, suggestion: null };
    const used = await this.usedInLastDay(householdId);
    return {
      enabled: true,
      limitReached: used >= DAILY_SUGGESTION_LIMIT,
      suggestion: await this.readSuggestion(householdId, projectId),
    };
  }

  async run(householdId: string, userId: string, projectId: string, extraText: string | null): Promise<SuggestionRunResponse> {
    const project = await this.requireProject(householdId, projectId);
    if (!suggestionsEnabledFor(householdId)) throw new HttpError('Suggestions are not available', 403);
    const used = await this.usedInLastDay(householdId);
    if (used >= DAILY_SUGGESTION_LIMIT) throw new HttpError(LIMIT_MESSAGE, 429);

    const model = suggestionModel();
    const startedAt = this.now();
    // Written before any model call, so an ask the platform kills mid-call still counts toward the cap.
    const log = await prisma.aiRequestLog.create({
      data: { householdId, userId, feature: PROVIDER_SUGGESTIONS_FEATURE, model, outcome: 'started' },
      select: { id: true },
    });

    const usage: Usage = { promptTokens: 0, outputTokens: 0, reported: false };
    let status: SuggestionRunStatus;
    try {
      const result = await this.generate(householdId, project, extraText, model, startedAt + SUGGESTION_DEADLINE_MS, usage);
      const data = { extraText, result: result as unknown as Prisma.InputJsonObject, model, createdById: userId };
      await prisma.projectSuggestion.upsert({
        where: { projectId },
        create: { projectId, ...data },
        update: { ...data, createdAt: new Date(this.now()) },
      });
      status = result.tooVague ? 'too_vague' : 'ok';
    } catch (error) {
      // Only the error's kind or our own fixed message is logged; a raw error could carry prompt text.
      const detail = error instanceof SuggestionError ? error.message : error instanceof Error ? error.name : 'unknown';
      console.error(`[suggestions] ask failed: ${detail}`);
      status = 'failed';
    }

    await this.finishLog(log.id, status, this.now() - startedAt, usage);
    return {
      status,
      limitReached: used + 1 >= DAILY_SUGGESTION_LIMIT,
      // On a failure nothing was saved, so this is the previous result, if there was one.
      suggestion: await this.readSuggestion(householdId, projectId),
      fallback: status === 'failed' ? await this.fallback(householdId, project) : null,
    };
  }

  private async generate(
    householdId: string,
    project: ProjectRow,
    extraText: string | null,
    model: string,
    deadline: number,
    usage: Usage,
  ): Promise<SavedSuggestionResult> {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    const text: ProjectText = { title: project.title, location: project.location, notes: project.notes, extra: extraText };
    const categories = await prisma.providerCategory.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });

    const routingPrompt = buildRoutingPrompt(text, categories, today);
    const routing = await this.askJson(routingPrompt, routingReplySchema, model, deadline, usage);
    const parts = cleanParts(routing.parts, routingPrompt.categoryIdByLabel);
    if (routing.tooVague || parts.length === 0) return { tooVague: true, parts: [] };

    const categoryIds = parts.flatMap((part) => (part.categoryId ? [part.categoryId] : []));
    const pools = await this.loadPools(householdId, project.id, categoryIds);
    const nameOf = new Map(categories.map((category) => [category.id, category.name]));
    const poolOf = (categoryId: string | null): PoolProvider[] => (categoryId ? pools.get(categoryId) ?? [] : []);

    const pickingParts: PickingPart[] = parts.flatMap((part, partIndex) => {
      const pool = poolOf(part.categoryId);
      if (pool.length === 0 || !part.categoryId) return [];
      return [{ partIndex, name: part.name, categoryName: nameOf.get(part.categoryId) ?? '', pool }];
    });

    let picks = new Map<number, SavedSuggestionPick[]>();
    if (pickingParts.length > 0) {
      const pickingPrompt = buildPickingPrompt(text, pickingParts, today);
      const picking = await this.askJson(pickingPrompt, pickingReplySchema, model, deadline, usage);
      picks = checkPicks(picking.parts, pickingPrompt.providerIdByLabel, pickingPrompt.labelsByPart);
    }

    return {
      tooVague: false,
      parts: parts.map((part, partIndex) => ({
        ...part,
        poolSize: poolOf(part.categoryId).length,
        picks: picks.get(partIndex) ?? [],
      })),
    };
  }

  // One call, validated; a reply that cannot be used is retried once if there is time left.
  private async askJson<T>(
    prompt: { system: string; user: string },
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    model: string,
    deadline: number,
    usage: Usage,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - this.now();
      if (remaining < MIN_CALL_MS) break;
      const reply = await this.callModel({ model, system: prompt.system, user: prompt.user, timeoutMs: remaining });
      if (reply.promptTokens !== null || reply.outputTokens !== null) usage.reported = true;
      usage.promptTokens += reply.promptTokens ?? 0;
      usage.outputTokens += reply.outputTokens ?? 0;

      let raw: unknown;
      try {
        raw = parseModelJson(reply.text);
      } catch {
        continue;
      }
      const parsed = schema.safeParse(raw);
      if (parsed.success) return parsed.data;
    }
    throw new SuggestionError('the model did not return a usable reply in time');
  }

  private async loadPools(householdId: string, projectId: string, categoryIds: string[]): Promise<Map<string, PoolProvider[]>> {
    const pools = new Map<string, PoolProvider[]>();
    if (categoryIds.length === 0) return pools;
    const rows = await prisma.provider.findMany({
      where: { ...eligibleWhere(householdId), categoryId: { in: categoryIds }, projects: { none: { projectId } } },
      include: poolInclude,
    });

    const byCategory = new Map<string, (ProviderListItem & { row: PoolRow })[]>();
    for (const row of rows) {
      const list = byCategory.get(row.categoryId) ?? [];
      list.push({ ...toProviderListItem(row), row });
      byCategory.set(row.categoryId, list);
    }
    for (const [categoryId, list] of byCategory) {
      pools.set(categoryId, rankProviders(list).slice(0, MAX_POOL_SIZE).map((entry) => toPoolProvider(entry.row)));
    }
    return pools;
  }

  // The saved result, refreshed against the directory as it is now.
  private async readSuggestion(householdId: string, projectId: string): Promise<ProjectSuggestionDto | null> {
    const row = await prisma.projectSuggestion.findUnique({
      where: { projectId },
      select: { extraText: true, result: true, createdAt: true },
    });
    if (!row) return null;
    const saved = savedResultSchema.safeParse(row.result);
    if (!saved.success) return null;

    const providerIds = [...new Set(saved.data.parts.flatMap((part) => part.picks.map((pick) => pick.providerId)))];
    const categoryIds = [...new Set(saved.data.parts.flatMap((part) => (part.categoryId ? [part.categoryId] : [])))];
    const [providers, categories] = await Promise.all([
      providerIds.length > 0
        ? prisma.provider.findMany({ where: { ...eligibleWhere(householdId), id: { in: providerIds } }, include: listInclude })
        : [],
      categoryIds.length > 0
        ? prisma.providerCategory.findMany({ where: { householdId, id: { in: categoryIds } }, select: { id: true, name: true } })
        : [],
    ]);
    const providerOf = new Map(providers.map((provider) => [provider.id, toProviderListItem(provider)]));
    const categoryOf = new Map(categories.map((category) => [category.id, category]));

    return {
      tooVague: saved.data.tooVague,
      extraText: row.extraText,
      createdAt: row.createdAt,
      parts: saved.data.parts.map((part) => ({
        name: part.name,
        why: part.why,
        category: (part.categoryId && categoryOf.get(part.categoryId)) || null,
        searchUrl: googleSearchUrl(part.searchPhrase),
        poolSize: part.poolSize,
        // A provider that was removed, or moved to a negative status, since the result was saved is left out.
        picks: part.picks.flatMap((pick) => {
          const provider = providerOf.get(pick.providerId);
          return provider ? [{ provider, reason: pick.reason }] : [];
        }),
      })),
    };
  }

  // What to show when the model could not answer: the fixed ranking for the project's own category.
  private async fallback(householdId: string, project: ProjectRow): Promise<SuggestionFallbackDto | null> {
    if (!project.providerCategoryId) return null;
    const category = await prisma.providerCategory.findFirst({
      where: { id: project.providerCategoryId, householdId },
      select: { id: true, name: true },
    });
    if (!category) return null;
    const rows = await prisma.provider.findMany({
      where: { ...eligibleWhere(householdId), categoryId: category.id, projects: { none: { projectId: project.id } } },
      include: listInclude,
    });
    return {
      category,
      providers: fallbackProviders(rows.map(toProviderListItem)),
      searchUrl: googleSearchUrl(withNearMe(category.name)),
    };
  }

  private usedInLastDay(householdId: string): Promise<number> {
    return prisma.aiRequestLog.count({
      where: { householdId, feature: PROVIDER_SUGGESTIONS_FEATURE, createdAt: { gte: new Date(this.now() - DAY_MS) } },
    });
  }

  private async finishLog(id: string, outcome: SuggestionRunStatus, durationMs: number, usage: Usage): Promise<void> {
    try {
      await prisma.aiRequestLog.update({
        where: { id },
        data: {
          outcome,
          durationMs,
          promptTokens: usage.reported ? usage.promptTokens : null,
          outputTokens: usage.reported ? usage.outputTokens : null,
        },
      });
    } catch {
      // The row stays "started" and still counts toward the cap; the ask itself is not failed over bookkeeping.
      console.error('[suggestions] could not update the request log');
    }
  }

  private async requireProject(householdId: string, projectId: string): Promise<ProjectRow> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: projectSelect,
    });
    if (!project) throw new HttpError('Project not found', 404);
    return project;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/services/provider-suggestion-service.test.ts tests/unit/services/provider-service.test.ts`
Expected: PASS. The new file has 29 tests. If a test fails because the code above does not do what the test says, fix the code, not the test, unless the test contradicts the spec; report any such case.

- [ ] **Step 7: Run the full suite and the typecheck, then commit**

Run: `npx vitest run 2>&1 | tail -6` (expected: 57 files, 884 tests, all passing) and `npx nuxi typecheck 2>&1 | grep -E "ProviderSuggestionService|ProviderService\.ts"` (expected: no output).

```bash
git add server/services/ProviderService.ts server/services/ProviderSuggestionService.ts tests/unit/services/provider-suggestion-service.test.ts
git commit -m "feat: ProviderSuggestionService"
```

---

### Task 4: Routes, client calls and the request time limit

**Files:**
- Create: `server/api/projects/[id]/suggestions.get.ts`, `server/api/projects/[id]/suggestions.post.ts`
- Modify: `composables/useProjects.ts`, `nuxt.config.ts`
- Test: `tests/unit/api/project-suggestion-routes.test.ts`

**Interfaces:**
- Consumes: `ProviderSuggestionService` with `getState(householdId, projectId)` and `run(householdId, userId, projectId, extraText)`; `suggestionRequestSchema`; `SuggestionStateResponse`, `SuggestionRunResponse`.
- Produces: `GET` and `POST /api/projects/[id]/suggestions`; from `useProjects()`: `getSuggestions(projectId: string): Promise<SuggestionStateResponse>` and `runSuggestions(projectId: string, extraText: string): Promise<SuggestionRunResponse>`.

- [ ] **Step 1: Confirm the Nitro option exists and nothing sets `nitro` today**

Run: `grep -n "maxDuration" node_modules/nitropack/dist/presets/vercel/types.d.ts` and `grep -n "nitro" nuxt.config.ts nuxt.config.test.ts`
Expected: one `maxDuration?: number;` line, and no `nitro` key in either config. If `nitro` is already set, merge into it and say so in the report.

- [ ] **Step 2: Write the failing tests**

`tests/unit/api/project-suggestion-routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const service = vi.hoisted(() => ({ getState: vi.fn(), run: vi.fn() }))

vi.mock('@/server/services/ProviderSuggestionService', () => ({
  ProviderSuggestionService: vi.fn(() => service),
}))

// Sign in through the dev bypass so the real auth wrapper runs.
vi.mock('@/server/utils/dev-auth', () => ({
  devAuthService: { isDevBypassEnabled: () => true, getUserById: vi.fn() },
}))

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { devAuthService } from '@/server/utils/dev-auth'
import { HttpError } from '@/server/utils/api-errors'
import getRoute from '@/server/api/projects/[id]/suggestions.get'
import postRoute from '@/server/api/projects/[id]/suggestions.post'

type Handler = (event: unknown) => Promise<unknown>

const call = (handler: unknown, userId: string | null, params: Record<string, string> = { id: 'p1' }) =>
  (handler as Handler)({
    node: { req: { headers: userId ? { 'x-dev-user-id': userId } : {} } },
    context: { params },
  })

const state = { enabled: true, limitReached: false, suggestion: null }
const ran = { status: 'ok', limitReached: false, suggestion: null, fallback: null }

describe('project suggestion routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(devAuthService.getUserById).mockImplementation((async (id: string) => {
      if (id === 'u1') return { id: 'u1', name: 'u1', email: 'u1@example.com', householdId: 'h1' }
      if (id === 'loner') return { id: 'loner', name: 'loner', email: 'loner@example.com', householdId: null }
      return null
    }) as never)
    service.getState.mockResolvedValue(state)
    service.run.mockResolvedValue(ran)
    vi.mocked(readBody).mockResolvedValue({})
  })

  it('GET returns the state for the caller household', async () => {
    expect(await call(getRoute, 'u1')).toEqual(state)
    expect(service.getState).toHaveBeenCalledWith('h1', 'p1')
  })

  it('GET passes a 404 from the service through', async () => {
    service.getState.mockRejectedValue(new HttpError('Project not found', 404))
    await expect(call(getRoute, 'u1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
  })

  it('both routes refuse a caller with no household', async () => {
    await expect(call(getRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    await expect(call(postRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    expect(service.run).not.toHaveBeenCalled()
  })

  it('POST runs with the trimmed text and the caller', async () => {
    vi.mocked(readBody).mockResolvedValue({ extraText: '  before Thanksgiving  ' })
    expect(await call(postRoute, 'u1')).toEqual(ran)
    expect(service.run).toHaveBeenCalledWith('h1', 'u1', 'p1', 'before Thanksgiving')
  })

  it('POST accepts no body at all', async () => {
    vi.mocked(readBody).mockResolvedValue(undefined)
    await call(postRoute, 'u1')
    expect(service.run).toHaveBeenCalledWith('h1', 'u1', 'p1', null)
  })

  it('POST rejects text over 500 characters without running', async () => {
    vi.mocked(readBody).mockResolvedValue({ extraText: 'x'.repeat(501) })
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: 'Anything to add must be 500 characters or fewer' })
    expect(service.run).not.toHaveBeenCalled()
  })

  it('POST passes 403 and 429 from the service through', async () => {
    service.run.mockRejectedValue(new HttpError('Suggestions are not available', 403))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 403 })
    service.run.mockRejectedValue(new HttpError('Daily limit reached. Try again later.', 429))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 429, message: 'Daily limit reached. Try again later.' })
  })
})
```

If `tests/unit/api/project-provider-routes.test.ts` asserts a different status code for a caller with no household, use the code that file asserts and say so in the report.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/api/project-suggestion-routes.test.ts`
Expected: FAIL, the route modules cannot be resolved.

- [ ] **Step 4: Write the routes**

`server/api/projects/[id]/suggestions.get.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProviderSuggestionService } from "@/server/services/ProviderSuggestionService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProviderSuggestionService().getState(householdId, projectId);
  } catch (error) {
    return toHttpError(error, 'reading provider suggestions');
  }
});
```

`server/api/projects/[id]/suggestions.post.ts`:

```ts
import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProviderSuggestionService } from "@/server/services/ProviderSuggestionService";
import { suggestionRequestSchema } from "@/server/utils/suggestion-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    // The box is optional, so the request may have no body.
    const parsed = suggestionRequestSchema.safeParse((await readBody(event)) ?? {});
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProviderSuggestionService().run(householdId, authUser.userId, projectId, parsed.data.extraText);
  } catch (error) {
    return toHttpError(error, 'suggesting providers');
  }
});
```

- [ ] **Step 5: Add the client calls to `composables/useProjects.ts`**

Add to the type imports at the top:

```ts
import { type SuggestionRunResponse, type SuggestionStateResponse } from '@/types/suggestion';
```

Add after `unlinkProvider`:

```ts
  const getSuggestions = (projectId: string) =>
    api.get<SuggestionStateResponse>(`/api/projects/${projectId}/suggestions`);
  // Takes around 15 seconds: the server makes two model calls before it answers.
  const runSuggestions = (projectId: string, extraText: string) =>
    api.post<SuggestionRunResponse>(`/api/projects/${projectId}/suggestions`, { extraText });
```

Add `getSuggestions, runSuggestions,` as a new last line inside the returned object.

- [ ] **Step 6: Set the request time limit in `nuxt.config.ts`**

Add this top-level key directly after the `runtimeConfig` block:

```ts
  // Provider suggestions make two model calls inside one request (up to 45 seconds). Nitro deploys the
  // server as a single function, so this applies to every route; 60 is allowed on every Vercel plan.
  nitro: {
    vercel: {
      functions: { maxDuration: 60 },
    },
  },
```

Run: `npx nuxi typecheck 2>&1 | grep -n "nuxt.config"`
Expected: no output. If the typecheck rejects the key, stop and report BLOCKED with the exact error; do not guess another spelling.

- [ ] **Step 7: Run the tests, the full suite and the typecheck, then commit**

Run: `npx vitest run tests/unit/api/project-suggestion-routes.test.ts` (expected: PASS, 7 tests), then `npx vitest run 2>&1 | tail -6` (expected: 58 files, 891 tests, all passing), then `npx nuxi typecheck 2>&1 | grep -E "suggestions\.(get|post)|useProjects"` (expected: no output).

```bash
git add "server/api/projects/[id]/suggestions.get.ts" "server/api/projects/[id]/suggestions.post.ts" composables/useProjects.ts nuxt.config.ts tests/unit/api/project-suggestion-routes.test.ts
git commit -m "feat: provider suggestion routes, client calls and a 60-second request limit"
```

---

### Task 5: The suggestions panel in the Find a provider window

**Files:**
- Modify: `utils/project-providers.ts` (add one export)
- Create: `components/projects/ProviderSuggestions.vue`
- Modify: `components/projects/FindProviderModal.vue`
- Modify: `components/projects/ProjectProviders.vue:214-217`
- Test: `tests/unit/utils/project-providers.test.ts` (add one `describe`)

**Interfaces:**
- Consumes: `getSuggestions`, `runSuggestions` from `useProjects()`; the DTOs in `@/types/suggestion`; `neighborLabel` from `@/utils/project-providers`; `hasApiStatus` from `@/utils/api-error`.
- Produces: `providerStatusBadgeClass(kind: ProviderStatusKind): string`; `ProviderSuggestions.vue` with props `{ projectId: string; linkedProviderIds: string[]; linking: boolean }` and events `add(providerId: string)`, `details(providerId: string)`, `see-all(categoryId: string)`; `FindProviderModal`'s `linked` event becomes `(links: ProjectProviderDto[], keepOpen: boolean)`.

There is no component test runner in this repo. This task's screens are never run by the implementer. Write the hand trace the last step asks for.

- [ ] **Step 1: Re-run the caller audit**

Run: `grep -rn "FindProviderModal" components pages` and `grep -rn "@linked\|'linked'" components pages`
Expected: `FindProviderModal` is used only by `components/projects/ProjectProviders.vue`, and `linked` is emitted only by the modal and handled only there. If anything else appears, stop and report it.

- [ ] **Step 2: Add the badge helper with a test**

Append to `tests/unit/utils/project-providers.test.ts` (add `providerStatusBadgeClass` to that file's existing import from `@/utils/project-providers`):

```ts
describe('providerStatusBadgeClass', () => {
  it('colors by status kind', () => {
    expect(providerStatusBadgeClass('positive')).toBe('bg-green-100 text-green-800')
    expect(providerStatusBadgeClass('negative')).toBe('bg-red-50 text-red-700')
    expect(providerStatusBadgeClass('neutral')).toBe('bg-stone-100 text-stone-700')
  })
})
```

Run: `npx vitest run tests/unit/utils/project-providers.test.ts` — expected: FAIL, `providerStatusBadgeClass` is not exported.

Append to `utils/project-providers.ts` and add `import { type ProviderStatusKind } from '@/types/provider';` to its imports:

```ts
// The badge for a provider's directory status, colored by the status's kind.
export const providerStatusBadgeClass = (kind: ProviderStatusKind): string => {
  if (kind === 'positive') return 'bg-green-100 text-green-800';
  if (kind === 'negative') return 'bg-red-50 text-red-700';
  return 'bg-stone-100 text-stone-700';
};
```

Run the test again — expected: PASS.

- [ ] **Step 3: Write `components/projects/ProviderSuggestions.vue`**

```vue
<template>
  <!-- Rendered only for a household that has suggestions turned on; everyone else sees the window as it was. -->
  <section v-if="enabled" class="border-b border-stone-200 bg-amber-50/50 px-3 py-3" aria-label="Suggested providers">
    <p v-if="error" class="mb-2 text-sm text-red-700" aria-live="polite">{{ error }}</p>

    <div class="flex flex-col gap-2 sm:flex-row">
      <input v-model="extraText"
             type="text"
             :maxlength="MAX_EXTRA_TEXT_LENGTH"
             :disabled="running"
             placeholder="Anything to add? (optional)"
             aria-label="Anything to add?"
             class="w-full min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm disabled:opacity-60"
             @keydown.enter.prevent="run">
      <button type="button"
              :disabled="running || limitReached"
              class="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              @click="run">
        {{ buttonLabel }}
      </button>
    </div>

    <p v-if="running" class="mt-2 text-sm text-stone-600" aria-live="polite">{{ waitingLine }}</p>
    <p v-else-if="suggestion" class="mt-1 text-xs text-stone-500">Suggested {{ formatDay(suggestion.createdAt) }}</p>

    <div v-if="fallback" class="mt-3">
      <h3 class="text-sm font-medium text-stone-900">Top providers by your ratings and neighbor recommendations</h3>
      <ul v-if="fallback.providers.length > 0" class="mt-1 divide-y divide-stone-100">
        <li v-for="provider in fallback.providers" :key="provider.id" class="flex items-start gap-2 py-2">
          <button type="button" class="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left hover:bg-amber-100" @click="emit('details', provider.id)">
            <span class="block text-sm font-medium text-stone-900 break-words">{{ provider.name }}</span>
            <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="providerStatusBadgeClass(provider.status.kind)">{{ provider.status.name }}</span>
              <span v-if="neighborLabel(provider.neighborCount)" class="text-xs text-stone-600">{{ neighborLabel(provider.neighborCount) }}</span>
              <span v-if="provider.rating" class="text-xs text-stone-600">{{ provider.rating }}/5</span>
            </span>
          </button>
          <span v-if="isLinked(provider.id)" class="shrink-0 pt-1 text-xs font-medium text-stone-500">On this project</span>
          <button v-else
                  type="button"
                  :aria-label="`Add ${provider.name} to project`"
                  :disabled="linking"
                  class="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                  @click="emit('add', provider.id)">
            Add
          </button>
        </li>
      </ul>
      <p class="mt-1 text-sm">
        <a :href="fallback.searchUrl" target="_blank" rel="noopener noreferrer" class="font-medium text-amber-700 hover:text-amber-800">Search Google</a>
      </p>
    </div>

    <template v-if="suggestion && !running">
      <p v-if="suggestion.tooVague" class="mt-2 text-sm text-stone-700">
        Not enough to go on. Add a sentence about what's wrong or what you want done.
      </p>
      <ol v-else class="mt-3 space-y-4">
        <li v-for="(part, index) in suggestion.parts" :key="index">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="min-w-0 text-sm font-medium text-stone-900 break-words">{{ index + 1 }}. {{ part.name }}</h3>
            <span v-if="part.category" class="shrink-0 text-xs text-stone-500">{{ part.category.name }}</span>
          </div>
          <p class="mt-0.5 text-sm text-stone-600">{{ part.why }}</p>

          <ul v-if="part.picks.length > 0" class="mt-1 divide-y divide-stone-100">
            <li v-for="pick in part.picks" :key="pick.provider.id" class="flex items-start gap-2 py-2">
              <button type="button" class="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left hover:bg-amber-100" @click="emit('details', pick.provider.id)">
                <span class="block text-sm font-medium text-stone-900 break-words">{{ pick.provider.name }}</span>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="providerStatusBadgeClass(pick.provider.status.kind)">{{ pick.provider.status.name }}</span>
                  <span v-if="neighborLabel(pick.provider.neighborCount)" class="text-xs text-stone-600">{{ neighborLabel(pick.provider.neighborCount) }}</span>
                  <span v-if="pick.provider.rating" class="text-xs text-stone-600">{{ pick.provider.rating }}/5</span>
                </span>
                <span class="mt-1 block text-sm text-stone-700">{{ pick.reason }}</span>
              </button>
              <span v-if="isLinked(pick.provider.id)" class="shrink-0 pt-1 text-xs font-medium text-stone-500">On this project</span>
              <button v-else
                      type="button"
                      :aria-label="`Add ${pick.provider.name} to project`"
                      :disabled="linking"
                      class="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                      @click="emit('add', pick.provider.id)">
                Add
              </button>
            </li>
          </ul>
          <p v-else class="mt-1 text-sm text-stone-500">{{ emptyNote(part) }}</p>

          <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button v-if="part.category"
                    type="button"
                    class="font-medium text-amber-700 hover:text-amber-800"
                    @click="emit('see-all', part.category.id)">
              See all in {{ part.category.name }}
            </button>
            <a :href="part.searchUrl" target="_blank" rel="noopener noreferrer" class="font-medium text-amber-700 hover:text-amber-800">Search Google</a>
          </p>
        </li>
      </ol>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { format } from 'date-fns';
import {
  MAX_EXTRA_TEXT_LENGTH,
  type ProjectSuggestionDto,
  type SuggestionFallbackDto,
  type SuggestionPartDto,
} from '@/types/suggestion';
import { useProjects } from '@/composables/useProjects';
import { hasApiStatus } from '@/utils/api-error';
import { neighborLabel, providerStatusBadgeClass } from '@/utils/project-providers';

const props = defineProps<{
  projectId: string;
  linkedProviderIds: string[];
  // a link request is in flight in the window
  linking: boolean;
}>();

const emit = defineEmits<{
  (e: 'add', providerId: string): void;
  (e: 'details', providerId: string): void;
  (e: 'see-all', categoryId: string): void;
}>();

const { getSuggestions, runSuggestions } = useProjects();

// Off until the server says this household has suggestions; a failed check leaves the panel hidden.
const enabled = ref(false);
const limitReached = ref(false);
const suggestion = ref<ProjectSuggestionDto | null>(null);
const fallback = ref<SuggestionFallbackDto | null>(null);
const extraText = ref('');
const running = ref(false);
const failed = ref(false);
const error = ref<string | null>(null);
const waitingLine = ref('');

const linkedSet = computed(() => new Set(props.linkedProviderIds));
const isLinked = (providerId: string): boolean => linkedSet.value.has(providerId);

const buttonLabel = computed((): string => {
  if (limitReached.value) return 'Daily limit reached. Try again later.';
  if (failed.value) return 'Try again';
  return suggestion.value ? 'Suggest again' : 'Suggest providers';
});

const emptyNote = (part: SuggestionPartDto): string => {
  if (!part.category) return 'No matching category in your directory';
  return part.poolSize === 0 ? 'No one to suggest' : 'No one stood out';
};

const formatDay = (value: string | Date): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'MMM d');
};

// The server does not report progress; the second line is shown on a timer, about when the first call usually ends.
let waitingTimer: ReturnType<typeof setTimeout> | undefined;
const startWaiting = (): void => {
  waitingLine.value = 'Working out which trades this needs...';
  waitingTimer = setTimeout(() => {
    waitingLine.value = 'Choosing providers...';
  }, 4000);
};
const stopWaiting = (): void => {
  clearTimeout(waitingTimer);
  waitingLine.value = '';
};

const run = async (): Promise<void> => {
  if (running.value || limitReached.value) return;
  running.value = true;
  failed.value = false;
  error.value = null;
  fallback.value = null;
  startWaiting();
  try {
    const response = await runSuggestions(props.projectId, extraText.value.trim());
    limitReached.value = response.limitReached === true;
    // On a failure this is the previous result, so what was on screen stays there under the error.
    suggestion.value = response.suggestion ?? null;
    if (response.status === 'failed') {
      failed.value = true;
      error.value = 'Could not get suggestions.';
      fallback.value = response.fallback ?? null;
    }
  } catch (e) {
    if (hasApiStatus(e, 429)) {
      limitReached.value = true;
    } else if (hasApiStatus(e, 403)) {
      enabled.value = false;
    } else {
      failed.value = true;
      error.value = 'Could not get suggestions.';
    }
  } finally {
    running.value = false;
    stopWaiting();
  }
};

onMounted(async () => {
  try {
    const state = await getSuggestions(props.projectId);
    enabled.value = state.enabled === true;
    limitReached.value = state.limitReached === true;
    suggestion.value = state.suggestion ?? null;
    extraText.value = state.suggestion?.extraText ?? '';
  } catch {
    // The window works without suggestions; say nothing.
  }
});

onBeforeUnmount(() => clearTimeout(waitingTimer));
</script>
```

- [ ] **Step 4: Change `components/projects/FindProviderModal.vue`**

(a) Replace the comment line `<!-- Slice 4 (AI suggestions) goes here, between the filter bar and the list. -->` and the opening tag of the list area that follows it, so the panel is the first thing inside the scrolling area:

```vue
        <!-- The suggestions panel is inside the scrolling area so it scrolls away with the list and never pins the list off a phone screen. -->
        <div ref="listArea" class="min-h-0 overflow-y-auto overscroll-contain">
          <ProviderSuggestions :project-id="projectId"
                               :linked-provider-ids="linkedProviderIds"
                               :linking="linking"
                               @add="addSuggested"
                               @details="openSuggestedDetails"
                               @see-all="seeAll" />
          <div ref="resultsTop"></div>
```

The rest of the list area (`<p v-if="loading" ...>` through the closing `</div>`) is unchanged.

(b) In the template, replace `:class="statusClass(provider.status.kind)"` with `:class="providerStatusBadgeClass(provider.status.kind)"`.

(c) In the script: add `import ProviderSuggestions from '@/components/projects/ProviderSuggestions.vue';` beside the `FindProviderDetails` import; change the `@/utils/project-providers` import to `import { neighborLabel, providerStatusBadgeClass } from '@/utils/project-providers';`; delete the local `statusClass` function; remove `type ProviderStatusKind` from the `@/types/provider` import if nothing else in the file uses it.

(d) Change the `linked` line of `defineEmits` to:

```ts
  // a provider was linked; carries the project's full list. keepOpen is true when the add came from a suggestion.
  (e: 'linked', links: ProjectProviderDto[], keepOpen: boolean): void;
```

(e) Add beside `const listArea`:

```ts
const resultsTop = ref<HTMLElement | null>(null);
// The details view was opened from a suggested row, so adding from it must not close the window.
const detailFromSuggestion = ref(false);
// "See all" changes the filter without that counting as the person choosing the project's category.
let categorySetBySuggestion = false;
```

(f) Replace the `watch(categoryId, ...)` block with:

```ts
watch(categoryId, (picked) => {
  clearTimeout(searchTimer);
  void load();
  const fromSuggestion = categorySetBySuggestion;
  categorySetBySuggestion = false;
  // Only a project with no category takes the first one picked here by hand; "See all" never saves one.
  if (picked !== '' && props.categoryId === null && !fromSuggestion) emit('save-category', picked);
});
```

(g) Replace `openDetails`, `addProvider` and `addDetailProvider` with:

```ts
const openDetails = (providerId: string): void => {
  listScrollTop = listArea.value?.scrollTop ?? 0;
  linkError.value = null;
  detailFromSuggestion.value = false;
  detailId.value = providerId;
};

const openSuggestedDetails = (providerId: string): void => {
  openDetails(providerId);
  detailFromSuggestion.value = true;
};

// Returns true when the provider was linked.
const addProvider = async (providerId: string, keepOpen = false): Promise<boolean> => {
  if (linking.value) return false;
  linking.value = true;
  linkError.value = null;
  try {
    emit('linked', await linkProvider(props.projectId, providerId), keepOpen);
    return true;
  } catch (e) {
    linkError.value = messageOf(e, 'Could not add the provider');
    // 409: someone else linked this provider, or the project is full. Ask the parent to reload.
    if (hasApiStatus(e, 409)) emit('stale');
    return false;
  } finally {
    linking.value = false;
  }
};

const addSuggested = (providerId: string): void => {
  void addProvider(providerId, true);
};

const addDetailProvider = async (): Promise<void> => {
  if (detailId.value === null) return;
  const keepOpen = detailFromSuggestion.value;
  const added = await addProvider(detailId.value, keepOpen);
  // From a suggestion the window stays open, so go back to the results the person came from.
  if (added && keepOpen) await closeDetails();
};

const seeAll = async (id: string): Promise<void> => {
  if (!props.categories.some((category) => category.id === id)) return;
  if (categoryId.value !== id) {
    categorySetBySuggestion = true;
    categoryId.value = id;
  }
  await nextTick();
  resultsTop.value?.scrollIntoView({ block: 'start' });
};
```

`closeDetails`, `requestClose`, `onKeydown`, `load` and the lifecycle hooks are unchanged. `closeDetails` already clears `linkError` and restores the scroll position, which now includes the panel's height because the panel is inside `listArea`.

- [ ] **Step 5: Change `components/projects/ProjectProviders.vue`**

Replace `onLinked` (lines 214-217 today) with:

```ts
// An add from a suggestion keeps the finder open so several can be added; at the cap it has nothing left to offer.
const onLinked = (links: ProjectProviderDto[], keepOpen = false): void => {
  emit('update:links', links);
  if (!keepOpen || links.length >= MAX_PROJECT_PROVIDERS) finderOpen.value = false;
};
```

`MAX_PROJECT_PROVIDERS` is already imported in this file. The template's `@linked="onLinked"` is unchanged; Vue passes both event arguments.

- [ ] **Step 6: Check the screen rules from the spec**

Read the finished template and confirm, in the report, each of these with the line that shows it:
- No two controls on the screen show the same value.
- Nothing changes data on a tap without an explicit button (a row tap opens details; only Add links).
- The error line is above the panel's content, not below a list.
- No `<select>` was added.
- Exactly one ask button is visible at a time, and its four labels are the ones in Global Constraints.

- [ ] **Step 7: Run the suite and the typecheck**

Run: `npx vitest run 2>&1 | tail -6` (expected: 58 files, 892 tests, all passing) and `npx nuxi typecheck 2>&1 | grep -E "ProviderSuggestions|FindProviderModal|ProjectProviders|project-providers"` (expected: no output), then `npx nuxi typecheck 2>&1 | grep -c "error TS"` (expected: the Task 1 baseline).

- [ ] **Step 8: Write the hand trace in the report**

For each of these, write what happens step by step, naming the refs that change and the events emitted: (1) opening the window for a household that is not enabled; (2) opening it with a saved result; (3) tapping "Suggest providers" and getting a result; (4) tapping it twice quickly; (5) a `failed` response with a fallback and a previous result; (6) a 429; (7) Add on a suggested row, then Add on a second one; (8) tapping a suggested row, then "Add to project" in details; (9) Add on a suggested row that makes the 25th link; (10) "See all" on a project with no saved category, then picking a different category by hand in the filter; (11) closing the window while an ask is running.

- [ ] **Step 9: Commit**

```bash
git add utils/project-providers.ts tests/unit/utils/project-providers.test.ts components/projects/ProviderSuggestions.vue components/projects/FindProviderModal.vue components/projects/ProjectProviders.vue
git commit -m "feat: provider suggestions panel in the Find a provider window"
```

**For the Opus reviewer of this task:** compile `ProviderSuggestions.vue` and the changed `FindProviderModal.vue` against this repo's Vue version in a throwaway jsdom harness outside the repo (the slice 3a review did this in `.superpowers/sdd/2026-10-05-find-provider-modal/`; its review file describes the setup). Stub `useProjects` and `useProviders`. Exercise at least: not enabled renders nothing; a saved result renders parts, picks and both links; the waiting state and the two lines; a `failed` response with fallback and previous result; a 429; Add from a suggestion emits `linked` with `true` and leaves the window mounted; details opened from a suggestion returns to results after Add; "See all" changes the filter and does **not** emit `save-category`, and a later manual category change on a no-category project **does**; the manual list's Add still emits `linked` with `false`. Say in the report which of these you ran and which you only read.

---

## After the tasks (controller, not subagents)

1. **Final whole-branch review** on Opus over `main..feat/provider-suggestions`, report to a file. Fix rounds and re-reviews as needed.
2. **Docs.** Run the repo's `update-docs` skill. It must cover: `docs/functionality/projects.md` (capability level, no code names), `docs/functionality/changelog.md`, `docs/tech/architecture.md`, `docs/tech/api-endpoints.md`, the three settings in `CLAUDE.md` Development Setup, and `docs/next-up.md`. Delete `docs/superpowers/specs/2026-10-05-projects-slice-4-brief.md` and point the `next-up.md` link at the spec. Log the two accepted gaps from Review Focus under "Projects - Deferred".
3. **Ask David to apply the migration**, with this in the ask:
   - Command: `npx prisma migrate deploy`
   - It adds two tables and touches no existing table.
   - If it fails partway (CockroachDB commits each statement on its own), recover with: `DROP TABLE IF EXISTS "project_suggestions";` then `DROP TABLE IF EXISTS "ai_request_logs";` then `npx prisma migrate resolve --rolled-back 20261005120000_add_project_suggestions`, and try again.
4. **Ask David to add the settings in Vercel** (Production): `OLLAMA_API_KEY`; `AI_SUGGESTIONS_HOUSEHOLD_IDS` set to his household id; `AI_SUGGESTIONS_MODEL` is optional and defaults to `glm-5.3-flash`. For local use he adds `AI_SUGGESTIONS_HOUSEHOLD_IDS` to `.env` as well. The session may not read production data, so David looks up the id himself in the CockroachDB console: `SELECT "householdId" FROM users WHERE email = '<his sign-in email>';`
5. **Ask David before the merge and before the push**, each named on its own. Order: migration applied, settings added, then merge, then push. Without the settings the panel stays hidden and nothing else changes. Without the migration, the suggestions routes fail for a listed household, so the migration always goes first.
6. Give David the phone test below, and say plainly: every model call in the build used canned replies; the real model has never been run against his real directory; no screen was run in a real browser.

## Phone test steps (production, after the merge and deploy)

1. Open a project that has notes describing a real problem, and tap **Find a provider**. Expected: above the provider list there is a box reading "Anything to add? (optional)" and a button "Suggest providers". The search box, filters and list look as they did before.
2. Scroll the list. Expected: the suggestions panel scrolls away with it; the search and filter bar stays put.
3. Tap **Suggest providers** without typing. Expected: the button greys out and a line reads "Working out which trades this needs...", then after a few seconds "Choosing providers...". Within about 20 seconds, numbered parts appear, each with a trade name, a category on the right, one line of why, and up to 3 providers with a status badge and a sentence or two of reason. The button now reads "Suggest again" and a line says "Suggested" with today's date.
4. Read one reason, then tap that provider's row. Expected: the provider's details open, with the neighbor posts. The reason should match what you can read there. Tap **Back to results**. Expected: the suggestions are still there, scrolled where you left them.
5. Tap **Add** on a suggested provider. Expected: the window stays open and that row now reads "On this project".
6. Tap a different suggested row, then **Add to project** in its details. Expected: you return to the results, the window stays open, and that row reads "On this project".
7. Tap **See all in {category}** under a part. Expected: the category filter changes to that category and the list below shows it. Close the window and check the project's saved category at the top of the Providers section. Expected: it has not changed.
8. Reopen **Find a provider**. Expected: the same suggestions appear at once with the same date, with no waiting line. The two providers you added read "On this project".
9. Tap **Search Google** under any part. Expected: a new tab opens with a Google search for that kind of contractor ending in "near me", showing results near you.
10. Back in the app, type a short extra detail in the box (for example "need it done this month") and tap **Suggest again**. Expected: the waiting lines again, then a fresh result. The box still shows what you typed.
11. Tap **Add** on any provider in the normal list below the suggestions. Expected: the window closes, as it did before this change.
12. Create a project titled only "Stuff" with no notes, open Find a provider, and tap **Suggest providers**. Expected: no parts; a line reads "Not enough to go on. Add a sentence about what's wrong or what you want done."
13. On a project whose problem needs a trade you have no category for (or have no providers in), tap **Suggest providers**. Expected: that part appears with "No matching category in your directory" or "No one to suggest", and a **Search Google** link.
14. On the project page, check the Providers section. Expected: the providers you added in steps 5 and 6 are listed as Considering.
15. Ask Amanda to open the same project's Find a provider window on her phone. Expected: she sees the same saved suggestions and date.

If step 3 shows "Could not get suggestions." with a "Try again" button, tap it once. If it fails again, stop and tell me what the screen shows; a list titled "Top providers by your ratings and neighbor recommendations" under the error is expected when the project has a saved category.
