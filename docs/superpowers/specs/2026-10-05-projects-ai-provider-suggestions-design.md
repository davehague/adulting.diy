# Home projects, slice 4a: AI provider suggestions (design spec)

Status: written 2026-10-05 from the brainstorm with David. Awaiting his review. No code is written until he approves this spec and then a written implementation plan.

This is the first half of slice 4 (AI help). The second half, suggested steps and time estimates, is a later slice with its own spec. Quotes (slice 3b) stay on hold.

Supersedes the slice 4 section of the handoff brief (`2026-10-05-projects-slice-4-brief.md`, deleted once this spec was approved; it is in git history).

## Goal

Inside the Find a provider window, David taps one button and gets a short list of providers from his own directory for the project in front of him: the project split into the trades it needs, up to three providers for each, and a plain reason for every pick drawn from his own record and from what neighbors wrote. When the directory has nobody suitable, he gets a Google search link for that trade instead of a made-up answer.

Success is that David reads a suggestion, can check its reason against the provider's details in one tap, and adds a provider he would not have found by sorting the list.

## Decisions made in the brainstorm

1. **The AI picks and explains; code sets hard limits.** This reverses the brief's "the AI never picks the contractor". The reason: rules can count neighbor posts but cannot read them, and matching what a post says to the problem is the useful part. The limits the AI cannot cross are in "Rules" below.
2. **The fixed rules ranking survives** in two roles: it caps the candidate pool sent to the model, and it is the fallback list when the model call fails.
3. **Providers first, steps later.** The split into parts is a list of trades (usually one to four), not a step list. It is saved with the result so step suggestions can read it later.
4. **Trigger:** a "Suggest providers" button and an optional "Anything to add?" box. Nothing is sent until the button is tapped. It always reads the project's title, location and notes.
5. **Results:** up to 4 parts, up to 3 providers per part, shown above the normal list. Add from a suggestion keeps the window open. The project's saved provider category is never changed by suggestions.
6. **No good match is said plainly.** Nothing is invented; see "When there is no good answer".
7. **Google search link on every part**, built by code from a phrase the model writes, ending in "near me". No zip code is stored; none was found in the schema and Google locates from the device.
8. **Model:** `glm-5.3-flash` on Ollama Cloud, on David's existing Pro plan, so no new paid service. The model name is an environment setting. Chosen by a two-round bake-off on made-up data; see "Evidence from the bake-off".
9. **The call runs inside the web request** with a waiting state and a 45-second overall limit. No background-job mechanism is built in this slice.
10. **Text only is sent.** No photos, no provider contact details, no source links or group names, nothing identifying the household. Neighbor post text is sent. See "What is sent to the model".
11. **David's household only**, by a list of household ids in the environment.
12. **One saved result per project**, no expiry, refreshed against the current directory each time it is shown.
13. **20 asks per household per rolling 24 hours**, counted from a log that holds no project or provider text.

## Out of scope for this slice

- Sending photos to the model.
- Suggested steps and time estimates.
- Quotes.
- A household zip code or search-area setting.
- A history of past suggestions; only the latest is kept.
- Changing what Add does in the manual list (it still closes the window).
- Changing the project's saved provider category from a suggestion.
- A per-household on/off switch in the UI, or any settings screen.
- A background-job mechanism.
- Bringing a provider found on Google back into the directory automatically.

## The flow

When the button is tapped, the server does this in order:

1. **Gate.** The household must be on the allowed list and under the cap. A log row is written with outcome `started`.
2. **Routing call.** Send the project text and the household's provider category names. The reply is either "too vague" or up to 4 parts, each with a short name, one sentence of why, a category from the list or none, and a search phrase.
3. **Clean the parts.** Drop a part whose category was already used by an earlier part. Keep at most 4.
4. **Build a pool for each part that has a category.** Every provider in that category that is not deleted, does not have a negative-kind status, and is not already linked to this project; ranked by the fixed rules; the top 40 kept.
5. **Picking call**, skipped when every pool is empty. Send the project text and each part with its pool. The reply is up to 3 picks per part, each a provider label and a reason.
6. **Check the picks.** Drop any pick whose label is not in that part's pool, any duplicate within a part, and anything past the third.
7. **Save and return.** Replace the project's saved result, update the log row with the outcome, timing and sizes, and return the result in the same shape the read route returns.

Each model call is validated against a Zod schema. A reply that does not parse or does not match is retried once, if time remains. The whole flow has one 45-second deadline; each call is given the time remaining.

## Rules

### The fixed rules ranking

A pure function over the provider list items the directory already produces (status kind, rating, neighbor count, last sighting, name). Order:

1. Providers with a positive-kind status before all others.
2. Within a tier: higher rating first, unrated after rated.
3. Then more neighbor recommendations first (`neighborCount`; self-promotion and lead sightings do not count).
4. Then more recent last sighting first, none last.
5. Then name, so ties are stable.

Negative-kind statuses are excluded before ranking, by status kind, not status name, so renamed statuses keep working.

Two uses:

- **Pool cap:** the top 40 of a category's eligible providers go to the model. No floor is applied; the model may have grounds in notes or comments that the counts do not show.
- **Fallback list:** the top 5, with a floor: a neutral-status provider with zero neighbor recommendations and no rating is left out.

### Limits the model cannot cross

- A part's category must be one of the household's provider categories, or none. An unknown category id is treated as none.
- A pick must be a provider in that part's pool. Anything else is dropped without comment.
- A provider with a negative-kind status, or already on the project, is never in a pool and so can never be suggested.
- The model never supplies a URL. It supplies a search phrase; code builds `https://www.google.com/search?q=` plus the encoded phrase.
- At most 4 parts and 3 picks per part, enforced by code after the reply.

### Instructions to the model (not enforceable in code)

The household's own record outweighs neighbor posts. Self-promotion is never a reason to pick. A lead sighting is not a recommendation. Negative neighbor posts count against. Evidence that matches this problem beats general praise. Do not pad: fewer than 3, or none, when grounds are thin. A reason on thin or old evidence must say so. Reasons are one or two plain sentences addressed to the household and state only what the record says. The full prompts are in the appendix.

## What is sent to the model

Sent:

- The project's title, location and notes, and the "Anything to add?" text (up to 500 characters).
- The household's provider category names, each with a throwaway label.
- For each provider in a pool: a throwaway label (`p1`, `p2` and so on, unique within the request), name, status name and kind, rating, notes, the text of household comments without authors, and for each of the 8 most recent evidence rows its kind, date and snippet cut to 600 characters.

Never sent: photos; phone, email, address, website, license number, Google Place ID; evidence source links and source group names; extra contacts; household name, member names or emails; database ids.

The pool cap (40), the evidence cap (8) and the snippet cut (600 characters) drop content from the model's view on purpose, to keep a call fast. The details view still shows everything.

Ollama's privacy policy (last updated March 2026, read through a summarizer on 2026-10-05) says prompts and responses are not stored beyond the request and are not used for training, and that data may be processed in the United States. It lists model inference providers among its third parties without saying what they retain.

## When there is no good answer

| Case | What David sees |
|------|-----------------|
| A part with no matching category | The part, the note "No matching category in your directory", and the Google link |
| A part whose pool is empty | The part, "No one to suggest", "See all", and the Google link |
| A part where the model picked nobody | The part, "No one stood out", "See all", and the Google link |
| Project too vague | No parts. "Not enough to go on. Add a sentence about what's wrong or what you want done." beside the box. Saved like any result |
| The household has no provider categories | Routing still runs; every part has no category and shows the Google link |
| The model fails, times out, or returns a bad reply twice | "Could not get suggestions." and "Try again". Below it, when the project has a saved category, the fallback list titled "Top providers by your ratings and neighbor recommendations", with no reasons, plus a Google link that searches that category name "near me". The previously saved result, if any, is kept and not replaced |
| Cap reached | The button is disabled and reads "Daily limit reached. Try again later." The saved result and manual search still work |
| A DIY-looking project | Suggestions as normal; no comment on whether to hire |

## Data model

Two new tables.

```prisma
model ProjectSuggestion {
  id          String   @id @default(uuid())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String   @unique // one saved result per project; "Suggest again" replaces it
  extraText   String?  // what was typed in "Anything to add?"
  result      Json     // { tooVague, parts: [{ name, why, categoryId, searchPhrase, picks: [{ providerId, reason }] }] }
  model       String   // the model that produced it
  createdBy   User     @relation("ProjectSuggestionCreatedBy", fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())

  @@map("project_suggestions")
}

model AiRequestLog {
  id           String    @id @default(uuid())
  household    Household @relation(fields: [householdId], references: [id])
  householdId  String
  userId       String
  feature      String    // "provider_suggestions"; step suggestions will add its own value
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

`result` stores real provider and category ids. The throwaway labels exist only for the duration of a call.

`AiRequestLog` holds no project or provider text. A row is written as `started` before the first model call and updated at the end, so an ask that is killed by a platform timeout still counts toward the cap.

### Migration

One hand-written migration, mirroring `prisma/migrations/20261004180000_add_project_providers/migration.sql`: create both tables, unlock each with `ALTER TABLE "x" SET (schema_locked = false);`, then the indexes and foreign keys. Checked offline with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`. Applied with `npx prisma migrate deploy` only after David's explicit yes, before the code is merged, with the exact recovery statements in the ask (CockroachDB commits each DDL statement on its own).

## Settings

| Variable | Purpose |
|----------|---------|
| `OLLAMA_API_KEY` | Ollama Cloud key. Already in David's local `.env`; must be added in Vercel before the merge |
| `AI_SUGGESTIONS_MODEL` | Model name. Defaults to `glm-5.3-flash` when unset |
| `AI_SUGGESTIONS_HOUSEHOLD_IDS` | Comma-separated household ids allowed to use suggestions. Empty or unset means nobody |

The feature is off for a household when it is not on the list or when the key is unset. Read through Nuxt `runtimeConfig`, server-only.

## API

Both routes use `defineHouseholdProtectedEventHandler` and return 404 for a project that is deleted or belongs to another household.

**`GET /api/projects/[id]/suggestions`**: returns `{ enabled, limitReached, suggestion }`. `enabled` is false when the household is not allowed, and then nothing else is computed. `suggestion` is null when nothing is saved, otherwise the saved result refreshed against the current directory:

- each part carries its category as `{ id, name }` or null (null also when the category has since been deleted), the Google search URL, and its picks;
- each pick carries the provider's current list fields (name, status, rating, neighbor count, last sighting) and the saved reason;
- a pick is dropped when its provider has been deleted or now has a negative-kind status;
- whether a pick is already on the project is decided on the client from the links it already holds.

**`POST /api/projects/[id]/suggestions`**: body `{ extraText?: string }` (trimmed, up to 500 characters). Returns 403 when not enabled and 429 when the cap is reached. Otherwise always 200 with `{ status, suggestion, fallback }`:

- `status: "ok"` or `"too_vague"`: `suggestion` is the newly saved result in the GET shape;
- `status: "failed"`: `suggestion` is the previously saved result or null, and `fallback` is `{ category, providers, searchUrl }` when the project has a saved category, else null.

## Code shape

New files:

- `server/utils/provider-ranking.ts`: the fixed rules ranking and the fallback floor. Pure.
- `server/utils/ollama.ts`: one function that posts to `https://ollama.com/api/chat` with `fetch`, a bearer key, `stream: false`, `temperature: 0`, an abort signal, and returns the message text and token counts. No new npm dependency.
- `server/utils/suggestion-prompts.ts`: the two system prompts and the functions that build each user message, including labelling and the size cuts.
- `server/utils/suggestion-schemas.ts`: Zod schemas for the two model replies, the request body and the saved result.
- `server/services/ProviderSuggestionService.ts`: the gate, the flow, the save, the log, and the refresh for reading. Takes the model call as an injectable function so tests can supply canned replies.
- `server/api/projects/[id]/suggestions.get.ts` and `suggestions.post.ts`.
- `types/suggestion.ts`: the DTOs.
- `utils/google-search.ts`: builds the search URL from a phrase; used by server and client.
- `components/projects/ProviderSuggestions.vue`: the panel.

Changed files, each to be grepped for callers and for anything matching on its output before the plan touches it:

- `prisma/schema.prisma`: the two models and their back-relations on `Project`, `User` and `Household`.
- `nuxt.config.ts`: the three settings in `runtimeConfig`.
- `components/projects/FindProviderModal.vue`: mounts the panel inside the scrolling list area, above the list; a way to add a provider without closing; "See all" sets the category filter.
- `components/projects/ProjectProviders.vue`: today its `onLinked` handler closes the window on every add. It needs to keep the window open for an add that came from a suggestion.
- `composables/useProjects.ts`: two calls for the new routes.
- `server/services/ProviderService.ts`: only if the pool query cannot be built from what it already exposes; the pool needs notes, comments and evidence rows, which the list method does not return.

## Screens

### The suggestions panel

Inside the Find a provider window's scrolling area, above the provider list, so it scrolls away with the list and never pins the manual list off a phone screen. Hidden entirely when `enabled` is false, so other households see the window exactly as today. Hidden while a provider's details are open, like the rest of the results.

Before any result:

```
[ Anything to add? ......................... ]
[ Suggest providers ]
```

While waiting: the button is disabled and a line reads "Working out which trades this needs..." and after a few seconds "Choosing providers...". The two lines are timed on the client, not reported by the server. Search, filters, the list and the manual Add keep working during the wait. Closing the window during the wait does not cancel the ask; the result is saved and shows on the next open.

With a result:

```
[ Anything to add? ......................... ]
[ Suggest again ]              Suggested Oct 5

1. Find and fix the leak            Plumber
   The stain is under the upstairs bath, so
   start with the supply and drain lines.

   Miller Plumbing   Hired · 4/5 · 3 neighbors
   You rated them 4 and two neighbors
   mention fast leak repairs.        [ Add ]

   Ace Drain Co      Lead · 5 neighbors
   A neighbor says they fixed a ceiling leak
   from an upstairs tub drain.       [ Add ]

   See all plumbers ›   Search Google ›

2. Repair the ceiling               Drywall
   ...
```

- The box shows the text that was used for the saved result and stays editable for the next ask.
- A suggested row is laid out like a normal result row (name, status badge, neighbor label, rating) with the reason beneath. Tapping the row opens the existing details view. A provider already on the project shows "On this project" in place of Add.
- **Add** links the provider as Considering and keeps the window open. Add to project from details that were opened from a suggested row does the same and returns to the results. Add in the manual list is unchanged and still closes the window.
- **See all** sets the window's category filter to the part's category and scrolls the list into view. It never saves a category to the project, including on a project with no saved category, where picking a category in the filter by hand does save it today; the window has to tell the two apart. Hidden when the part has no category.
- **Search Google** opens the search in a new tab.
- Only one control shows the ask action at a time: "Suggest providers" before a result, "Suggest again" after.

### Checks carried from slice 3a

- No two controls on the screen show the same value.
- Nothing changes data on a tap without an explicit button.
- Errors appear above the panel content, not below a long list.
- No `<select>` is added. If one is, it binds to local state.

## Behaviour notes

- Any member of an allowed household can ask, and all members see the same saved result.
- Two members asking at once: both asks run, both count, the later save wins.
- A project in any status can get suggestions.
- "Suggest again" with a failed outcome keeps the previous result on screen under the error.
- The cap is checked before the model is called and counts every row in the log for that household and feature in the last 24 hours, whatever its outcome.

## Testing

Unit tests (Vitest, the model replaced by canned replies):

- The rules ranking: tiers, rating order, unrated after rated, neighbor count, recency, name tie-break, negative statuses excluded, the pool cap at 40, the fallback floor and top 5.
- Prompt building: labels are unique and map back; the 8-row and 600-character cuts; nothing from the never-sent list appears in the message (assert on the serialized text).
- Reply handling: a valid reply; a reply wrapped in a code fence or with prose around it (parsed leniently by taking the outermost braces, then validated); wrong field names; an unknown category becomes none; a duplicate category drops the later part; a pick outside the pool is dropped; a duplicate pick is dropped; more than 3 picks or 4 parts are trimmed; one retry on a bad reply; failure after the second bad reply.
- The service: not enabled; cap reached; too vague is saved; empty pools skip the picking call; a failure keeps the previous saved result and returns the fallback; the log row is written as `started` and updated; the deadline is honoured.
- Reading: a deleted provider and a now-negative provider are dropped; a deleted category becomes null.
- Routes: 403, 404, 429 and the body limit.

Review harness: the Opus reviewer compiles `ProviderSuggestions.vue` and the changed `FindProviderModal.vue` against the repo's Vue version in a throwaway jsdom harness outside the repo, and exercises the waiting state, a result, each no-answer case, Add keeping the window open, and details opened from a suggestion.

Never run before David uses it: the real model against the real directory, and the whole screen in a real browser. The first real run is his phone test in production. The plan gives exact numbered steps with the expected result for each, and the report says plainly which behaviours were only unit-tested.

## Evidence from the bake-off

Two rounds on 2026-10-05, made-up data only (one project, 18 categories, pools of 10, 4 and 3 providers with traps: a provider with six self-promotion posts, one with a no-show complaint, a Hired provider rated 2, a pool with only one weak recommendation). Each round: 1 routing call and 4 picking calls per model, for `glm-5.3`, `glm-5.3-flash` and `deepseek-v4.1-flash`.

- **Round one** relied on the service's `format` setting to force the reply shape. It did not: all 12 picking replies were formatted prose, and two of three routing replies were malformed. Judgment was sound in all of them: same top picks, every trap avoided, thin evidence stated.
- **Round two** added a plain instruction to reply as one JSON object and showed the exact keys. All 15 replies parsed and validated, with no pick outside a pool.
- **Timing in round two:** routing 2 to 3 seconds for all three. Picking: `glm-5.3-flash` 9 to 10 seconds on every run; `deepseek-v4.1-flash` 7 to 15; `glm-5.3` 8 to 50.
- **Padding:** `glm-5.3-flash` was the only model that did not add a painter praised only for exterior trim.

Consequences for this design: the prompt states the reply shape in words; code validates every reply and retries once; the model is `glm-5.3-flash`; the call fits in a request. Limits of the evidence: one invented project with tidy posts and five calls per model. Real posts are messier, which is why the model is a setting and the log records timing.

## Delivery

- A feature branch in the main checkout; no git worktrees.
- Built with subagent-driven development: Sonnet implementers, Opus for every review, each reviewer writing its full report to a file whose existence is checked.
- The migration is applied, after David's yes, before the merge. The three settings are added in Vercel before the merge.
- To verify in the plan before any code: the per-request time limit on David's Vercel account and how this Nuxt app sets it for one route. If it is under 45 seconds, stop and ask.
- Push and merge each need David's yes. Phone testing happens in production after the merge, because Google sign-in does not work on preview URLs.
- After the build, run the `update-docs` skill.

## Later (not designed here)

- Step suggestions and time estimates, which need a background-job mechanism and can read the saved parts.
- Photos as input.
- A household search-area setting, if "near me" proves wrong in use.
- Turning suggestions on for other households, with their agreement to the data flow.
- Recency rules in the ranking, if stale suggestions annoy.

## Open items carried from the handoff brief

- A sign-in with a Google account that has never used the site, to check the new-account path that changed twice on 2026-10-04.
- Amanda opening Projects and the dashboard on her phone.
- The project-card update in Linear for the providers-on-projects capability, offered and not yet answered.
- The step-by-step phone tests for 3a and the Find a provider window were not reported one by one.

## Appendix: the prompts

These are the prompts from round two of the bake-off, which produced the results above. `{today}` is the current date.

### Routing

```
You help a household plan a home project by working out which kinds of contractor it needs.
Split the project into parts, one per trade, in the order the work would happen. Use at most 4 parts. A simple problem is one part.
Each part must use a categoryId from the household's category list, or null if no listed category fits. Never invent a category.
For each part give: a short name (under 40 characters), one sentence on why that trade is needed for this specific project, and a short Google search phrase for finding that kind of contractor for this specific problem, ending in "near me".
If the project text is too vague to tell what work is needed, set tooVague to true and return no parts.
Today is {today}.

Reply with one JSON object and nothing else: no prose before or after, no markdown, no code fences. Use exactly these keys:
{"tooVague": false, "parts": [{"name": "...", "categoryId": "c1", "why": "...", "searchPhrase": "... near me"}]}
categoryId is one of the listed category ids, or null.
```

### Picking

```
You help a household shortlist contractors for a home project. For each part of the project you are given a pool of providers from the household's own directory. Pick up to 3 providers per part, best first, and give a reason for each.

Rules:
- Only pick providers from that part's pool, by their id. Never pick anyone else.
- The household's own record (their status, their rating, their notes, their comments) outweighs neighbor posts.
- Evidence kinds: "third_party" is a neighbor's own words about the provider and may be positive or negative, so read it. "self_promo" is the business advertising itself and is never a reason to pick it. "lead" is an unverified mention or a question and is not a recommendation.
- Prefer evidence that matches this specific problem over general praise.
- Do not pad. If fewer than 3 providers have real grounds, pick fewer. If none do, pick none.
- Each reason is one or two plain sentences, written to the household ("You rated them 4..."). State only what the record says. If the evidence is thin or old, say so in the reason. Do not use the provider id in the reason.
Today is {today}.

Reply with one JSON object and nothing else: no prose before or after, no markdown, no code fences, no list of providers you skipped. Use exactly these keys:
{"parts": [{"partIndex": 0, "picks": [{"providerId": "p1", "reason": "..."}]}]}
Include every part, in order. A part with no picks has "picks": [].
```

The evidence kind names in the picking prompt must match the values stored in the database; the plan confirms them against the ingest code before the prompt is finalized.
