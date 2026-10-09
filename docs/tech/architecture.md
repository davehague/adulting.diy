# Architecture - Technical Reference

The 30,000-foot view of how Adulting.DIY is put together. Subsystem detail lives in the other docs in this folder; this one is the map.

## System Overview

Adulting.DIY is a single Nuxt 3 application deployed on Vercel. The Vue front end and the Nitro server routes ship together; there is no separate back end.

```
Browser (Vue 3 pages, Pinia stores)
   │  fetch with Authorization: Bearer <Google ID token>
   ▼
Nitro server routes (server/api/**)
   │  auth wrapper → Zod validation → service class
   ▼
Service layer (server/services/**)
   ├─→ Prisma → CockroachDB            (all application data)
   ├─→ Vercel Blob, private store      (project photos)
   └─→ Mailjet / Slack webhooks        (notifications)

Vercel Cron ──→ /api/scheduler/run, /api/scheduler/reminders
Neighborhood watcher (external) ──→ /api/ingest/providers  (household API key)
```

## Directory Map

| Path | What lives there |
|------|------------------|
| `pages/` | File-based routes (see Pages below) |
| `components/` | Vue components, grouped by area: `tasks/`, `occurrences/`, `providers/`, `projects/` |
| `layouts/` | `default.vue` (signed-in shell with nav) and `landing.vue` (public) |
| `composables/` | `useProviders`, `useProjects` (API clients for those areas), `useToast`, `onClickOutside` |
| `stores/` | Pinia stores: `auth` (persisted), `tasks`, `dev-auth` |
| `middleware/auth.global.ts` | Client route guard: login redirect, household setup redirect |
| `plugins/` | `auth-ready.client.ts` (waits for the persisted auth store), `dev-auth.client.ts` |
| `utils/` | Shared client helpers: `api.ts` (authenticated fetch), `api-error.ts`, `image-resize.ts`, `project-labels.ts`, `project-steps.ts`, `project-providers.ts`, `chat-markdown.ts` (the chat's reply renderer), `google-search.ts` and `schedule-type.ts` (both shared with the server) |
| `types/` | Shared TypeScript types, one file per domain |
| `server/api/` | HTTP endpoints, one file per route and method |
| `server/services/` | Business logic and all database access, one class per domain |
| `server/utils/` | Auth wrappers, Zod schemas, scheduling maths, blob storage, the model calls and prompts for the AI features, error helpers, the Prisma client |
| `prisma/` | `schema.prisma` and migrations |
| `scripts/` | Database setup, seed, and maintenance scripts |
| `tests/` | Vitest suites (see [testing.md](testing.md)) |

## Request Flow

1. The client calls the API through `useApi()` in `utils/api.ts`, which attaches the Google ID token from the `auth` store as a bearer token. Failed calls surface as an `ApiError` carrying the HTTP status and the server's message.
2. The route file wraps its handler in one of the auth wrappers below, which resolves the user and household before the handler runs.
3. The handler validates input (Zod schemas in `server/utils/*-schemas.ts` and `server/utils/validation.ts`) and calls a service.
4. Services own the Prisma queries and always scope by `householdId`. They throw `HttpError` (`server/utils/api-errors.ts`) for expected failures; handlers pass anything caught through `toHttpError`.

## Authentication and Authorization

All wrappers are in `server/utils/auth.ts` unless noted.

| Wrapper | Requires | Used for |
|---------|----------|----------|
| `defineProtectedEventHandler` | Valid Google ID token and a matching `User` row | Household create and join, categories |
| `defineHouseholdProtectedEventHandler` | The above, plus the user belongs to a household | Almost everything |
| `defineHouseholdAdminEventHandler` | The above, plus the admin role | Household settings, invite code, member removal and admin promotion; provider categories and statuses; API keys |
| `defineSchedulerProtectedEventHandler` | Bearer token equal to `CRON_SECRET` | Cron endpoints and `sendEmail` |
| `defineApiKeyProtectedEventHandler` (`server/utils/api-key-auth.ts`) | A household API key (`adk_...`) | Provider ingest |

Google ID tokens are verified server-side with `google-auth-library` on every request. Two routes are called during sign-in before a user row is known to exist, `/api/user/profile` and `/api/user/register`; they use `verifyIdentity`, which checks the token and takes the email from it without requiring a `User` row. In development, the login bypass short-circuits token verification with a chosen user; see [dev-login-bypass.md](dev-login-bypass.md).

On the client, `middleware/auth.global.ts` sends signed-out visitors to `/login` (remembering where they were headed) and signed-in users without a household to `/setup-household`.

## Data Model

Defined in `prisma/schema.prisma`. Every household-owned model carries `householdId` directly or through its parent.

| Area | Models |
|------|--------|
| Identity | `User`, `Household`, `FormerHouseholdMember` |
| Tasks | `Category`, `TaskDefinition`, `TaskOccurrence`, `OccurrenceHistoryLog`, `TaskHistoryLog` |
| Providers | `Provider`, `ProviderCategory`, `ProviderStatus`, `ProviderContact`, `ProviderEvidence`, `ProviderComment`, `TaskProvider`, `ApiKey` |
| Projects | `Project`, `ProjectPhoto`, `ProjectStep`, `ProjectProvider`, `ProjectSuggestion`, `ProjectPlan` |
| AI usage | `AiRequestLog` |

Conventions:

- **Soft delete**: `TaskDefinition`, `Provider` and `Project` use a `metaStatus` field; queries filter on it.
- **JSON config**: `TaskDefinition.scheduleConfig` and `reminderConfig` hold the recurrence and reminder rules (types in `types/task.ts`).
- **Audit trail**: occurrence and task changes are written to the two history log models.
- **Time**: everything is stored in UTC; the household's timezone is applied when deciding "today" and when displaying.
- **CockroachDB** is treated as PostgreSQL. See [ADR-0001](../adrs/0001-defer-prisma-7-upgrade.md) for the Prisma version decision.

## Pages

| Route | Page |
|-------|------|
| `/` | Public landing page |
| `/login` | Google sign-in |
| `/setup-household` | Create or join a household |
| `/dashboard` | Stat cards, project next steps, coming-up feed |
| `/tasks`, `/tasks/create`, `/tasks/[id]`, `/tasks/[id]/edit` | Task list, create, detail, edit |
| `/occurrences`, `/occurrences/[id]` | Occurrence list and detail |
| `/providers`, `/providers/[id]` | Provider directory and detail |
| `/projects`, `/projects/new`, `/projects/[id]` | Project list, capture form, detail |
| `/projects/chat/[id]` | Project chat (sets the `hideFooter` page meta, which `layouts/default.vue` reads to drop its footer) |
| `/household`, `/household/providers-settings` | Household settings; provider categories, statuses and API keys |
| `/profile` | Profile and notification preferences |

The full endpoint list is in [api-endpoints.md](api-endpoints.md).

## Subsystems

| Subsystem | Entry points | Doc |
|-----------|--------------|-----|
| Task scheduling and occurrence generation | `server/utils/schedule.ts`, `TaskService`, `OccurrenceService`, `/api/scheduler/run` | [task-scheduling.md](task-scheduling.md) |
| Notifications and reminders | `NotificationService`, `server/services/notifications/*`, `/api/scheduler/reminders` | [notification-system.md](notification-system.md) |
| Provider directory and machine ingest | `Provider*Service`, `ApiKeyService`, `/api/ingest/providers` | [provider-ingest.md](provider-ingest.md) |
| Projects, photos, steps and provider links | `ProjectService`, `ProjectPhotoService`, `ProjectStepService`, `ProjectProviderService` | Below |
| AI help: provider suggestions, the DIY plan and the project chat | `ProviderSuggestionService`, `ProjectPlanService`, `ProjectChatService`, `/api/projects/[id]/suggestions`, `/api/projects/[id]/plan`, `/api/projects/[id]/chat`, `server/utils/ai-ask.ts`, `ollama.ts`, `suggestion-*.ts`, `plan-*.ts`, `chat-*.ts`, `provider-ranking.ts`, `utils/chat-markdown.ts` | Below |
| Dashboard | `DashboardService`, `/api/dashboard`, `/api/projects/next-steps` | Below |

### Projects and Photo Storage

- The browser shrinks each picked photo to two JPEGs before upload (`utils/image-resize.ts`): a full image and a thumbnail.
- `ProjectPhotoService` checks that both files are JPEGs within the size limits, writes them to the private Vercel Blob store under `households/{householdId}/projects/{projectId}/`, then creates the `ProjectPhoto` row. The per-project photo cap is checked before the write and again after the row exists, so concurrent uploads cannot exceed it.
- `server/utils/blob-storage.ts` is the only module that talks to Vercel Blob, which lets tests fake storage.
- Photos are never served from a public URL. The photo GET route streams the blob through the household auth wrapper, and `components/projects/AuthedImage.vue` fetches it with the bearer token.
- The "next step" rule (first undone step in order) lives in `utils/project-steps.ts` and is shared by the project page and the dashboard list.
- `ProjectProvider` links a provider to a project with a per-project status (`considering`, `contacted`, `chosen`, `passed`), unrelated to the provider's household `ProviderStatus` and to `TaskProvider`. `ProjectProviderService` owns the link rules (household checks, the 25-link cap, link order) and exports the select, filter and mapper that `ProjectService` reuses to put links on the project detail and chosen names on the list. Links are never deleted automatically: reads filter out links whose provider is removed or whose project is deleted.
- `Project.providerCategoryId` is the project's saved provider category. The "Find a provider" modal (`components/projects/FindProviderModal.vue`, with `FindProviderDetails.vue` for the details view) lists providers through the existing `GET /api/providers` (search, category, status, sort, hidden statuses included), starting on that category, and loads details through `GET /api/providers/[id]`; it adds no endpoints. `ProviderCategoryService.remove` moves projects along with providers when a replacement is given; otherwise the foreign key clears the column.
- Link order, labels, the card's "Chosen:" line and the tap-to-call link live in `utils/project-providers.ts`.

### AI Provider Suggestions

Design: [the slice 4a spec](../superpowers/specs/2026-10-05-projects-ai-provider-suggestions-design.md). The DIY plan below shares its plumbing.

- **Shared plumbing** lives in `server/utils/ai-ask.ts`: `askJson` (one validated model call, lenient JSON parse, one retry inside the deadline), `askChat` (a multi-turn call that runs the `web_search` tool calls the model asks for, at most three per reply, inside the deadline), `asksInLastDay` (the daily cap: one count per household over the features in `CAPPED_AI_FEATURES`, which are suggestions and plans; chat rows are logged but never counted), `describeError` (what a failure may log: only this code's own fixed messages, otherwise an error's name and code) and `AskError`. `server/utils/ollama.ts` holds the three HTTP calls: `callOllama` (single turn, JSON replies), `callOllamaChat` (messages and tools, may return tool calls) and `searchOllama` (`POST /api/web_search` on the same key). Each AI service keeps its own gate order, log row and save.

- **Flow.** `ProviderSuggestionService.run` checks the project, the allowed-household list and the daily cap, writes an `AiRequestLog` row as `started`, then makes two model calls: routing (project text and category names in; up to four parts out, each tied to a category or to none) and picking (the parts with their candidate pools in; up to three picks per part with reasons out). It saves the result as the project's single `ProjectSuggestion` row and finishes the log row. The whole ask has one 45-second deadline.
- **The model is injected.** The service takes a `ModelCall` function (default `callOllama` in `server/utils/ollama.ts`, a plain `fetch` to Ollama Cloud), so every test supplies canned replies. Nothing in the test suite calls a model.
- **Code sets the limits, not the model.** Pools are built in code: the part's category, no negative-kind status, not removed, not already on the project, capped at 40 by the fixed ranking in `server/utils/provider-ranking.ts` (positive-kind status, then rating, neighbor count, recency, name). `server/utils/suggestion-checks.ts` drops any pick outside its part's pool, unknown categories and repeats. The model never supplies a URL; `utils/google-search.ts` builds every search link.
- **Replies are never trusted to be well-formed.** Ollama's `format` setting was shown not to enforce a shape, so `server/utils/suggestion-schemas.ts` parses leniently, validates with Zod, and the service retries once.
- **What may leave the household is decided in one place.** `server/utils/suggestion-prompts.ts` builds both prompts from a `PoolProvider` shape that has no contact fields, sends providers and categories under throwaway labels (`p1`, `c1`), cuts long text, and masks phone numbers, emails and links in all free text.
- **Reading.** `getState` returns the saved result refreshed against the directory as it is now (picks for removed or negative-status providers dropped, current list fields attached). A failed ask keeps the previous result and returns a fallback list from the fixed ranking.
- **Logging.** `AiRequestLog` and the console hold outcome, timing, sizes and error type only, never prompt or reply text. The cap counts log rows from the last 24 hours.
- **Screen.** `components/projects/ProviderSuggestions.vue` sits inside the Find a provider modal's scrolling area. An add from a suggestion emits `linked` with `keepOpen` so `ProjectProviders.vue` leaves the window open. An ask still running when the window is closed is picked up again on reopen within the same tab.

### AI DIY Plan

Design: [the slice 4b spec](../superpowers/specs/2026-10-06-projects-ai-diy-plan-design.md).

- **Flow.** `ProjectPlanService.run` checks the project, the allowed-household list and the shared cap, writes an `AiRequestLog` row (`feature: diy_plan`) as `started`, makes one model call with `buildPlanPrompt` (project text plus the trade names from the project's saved `ProjectSuggestion`, never its whys or providers), validates and clamps the reply (`server/utils/plan-schemas.ts`: counts, number bounds, step text cut to the checklist's 200 characters, pro-step rules, `totalMinutes` recomputed from the steps), saves it as the project's single `ProjectPlan` row and finishes the log row. Same 45-second deadline as suggestions; the ask log's timing is the tripwire for a background version.
- **The checklist is never written by planning.** `POST /api/projects/[id]/steps/batch` (`ProjectStepService.addMany`) appends several steps under the cap of 100 and reports how many did not fit; `utils/project-steps.ts` `hasStepText` decides which plan steps are already present (trim, case-insensitive).
- **Screen.** `components/projects/ProjectPlan.vue` sits between Steps and Providers on the project page, re-attaches to a running ask on remount like the suggestions panel, emits `update:steps` for adds, `find-provider` (the page calls `ProjectProviders`' exposed `openFinder`), `set-path-hire` (the page's existing `save({ path: 'hire' })`) and `enabled` (the page shows the Chat button from it).

### AI Project Chat

Design: [the slice 5 spec](../superpowers/specs/2026-10-08-projects-ai-chat-design.md); the plan's "Deviations" section records the route path and the `failedAt` column.

- **Data.** `ProjectChatMessage` is one row per message (`role` user or assistant, `content`, `createdById`, `searches` JSON, `photoIds` JSON (the `ProjectPhoto` ids attached to a user row, in order), `failedAt` on a user row whose reply failed, timing and token counts on assistant rows). Never edited or deleted; cascades with the project.
- **Photos.** The composer uploads each picked photo through the existing `POST /api/projects/[id]/photos` (so it is a project photo at once) and sends the ids with the message. The service checks the ids against the project's photos (404 otherwise, de-duplicated), reads the attached photos' full images and every other project photo's thumbnail with `readPrivateBytes` in `server/utils/blob-storage.ts`, and `buildChatPrompt` puts them, base64, as `images` on the last user message only (thumbnails first, attached last, with a fixed "[Pictures: …]" prefix line; earlier rows carry "(with N photos)"). An unreadable blob is skipped and counted in the log line. The default chat model is `glm-5.3-flash` because `glm-5.3` refuses image input. The photo cap is 25 per project.
- **Flow.** `ProjectChatService.send` checks the project and the allowed-household list, refuses with 409 while the last row is a fresh unanswered user row (younger than `CHAT_PENDING_MS`, 75 s, which outlasts the 60 s ask deadline), saves the user row BEFORE the model call (or, on `{ retry: true }`, refreshes the last unanswered row's `createdAt` and clears `failedAt`), writes an `AiRequestLog` row (`feature: project_chat`), reads the context fresh (project, steps, saved plan, suggestion trades, linked providers by name/category/status) and the newest 200 rows, builds the prompt with `buildChatPrompt`, runs `askChat` with `callOllamaChat` and `searchOllama`, saves the assistant row (reply cut to 8,000 characters, the queries it searched), and finishes the log. A failure marks the user row `failedAt`, logs `failed` and answers 502; `getState` returns the newest 500 rows oldest first with `mine`, `failed` and `pending`.
- **What may leave the household is decided in one place.** `server/utils/chat-prompts.ts` renders the project block and the history and places the photo bytes (the service's `photos()` only chooses which stored files to read); every household-typed field goes through `redactContactDetails`, assistant rows go back verbatim, members are never named (the other member's rows are prefixed "(another household member)"), and the one tool is `web_search(query)`. Search queries are masked and cut before they reach Ollama. The thinking text is neither shown nor stored.
- **No cap.** Chat has no daily limit (the household's decision); the ask log is the tripwire, and the per-reply search cap and the deadline are enforced in code.
- **Screen.** `pages/projects/chat/[id].vue` owns the state: an optimistic row on send, a 1 s ticker for "Thinking… n s", polling every 3 s while the server says pending, Retry on a failed or expired row, rows matched by id (reactive arrays hand back proxies), a sequence counter and an unmount flag so a late poll or a navigation away cannot clobber the thread, a client timeout on the send, and a one-shot refetch when a send fails without a status so a question the server took is not shown as lost. `ChatThread.vue` renders replies through `utils/chat-markdown.ts` (escapes first; paragraphs, lists, bold, code, links only) with `v-html`; `ChatComposer.vue` grows with the text up to five lines and sends on Enter only with a fine pointer.
- **Tests.** Everything server-side is unit-tested with canned replies and searches. The page's state machine is exercised only in the reviewer's throwaway jsdom harness outside the repo; the repo has no component tests.

### Dashboard

`DashboardService` returns the stat counts, the coming-up feed and household members in one call. The project next-steps section is a separate call to `/api/projects/next-steps`.

## Integrations

| Service | Used for | Configured by |
|---------|----------|---------------|
| Google Sign-In | Authentication (ID token as bearer) | `NUXT_PUBLIC_GOOGLE_CLIENT_ID` |
| CockroachDB | All application data | `DATABASE_URL` |
| Vercel Blob (private store) | Project photos | On Vercel, the project's OIDC token (no variable). Locally, `BLOB_READ_WRITE_TOKEN`, which `server/utils/blob-storage.ts` passes to the SDK explicitly. Never set `BLOB_STORE_ID` locally: with a linked repo (`.vercel/`) it makes the SDK prefer a development OIDC token, which the store refuses with a 403 |
| Ollama Cloud | AI provider suggestions, the DIY plan and the project chat (chat also uses its `web_search` endpoint on the same key) | `OLLAMA_API_KEY`; `AI_SUGGESTIONS_MODEL` (optional, defaults to `glm-5.3-flash`; suggestions and plans); `AI_CHAT_MODEL` (optional, defaults to `glm-5.3-flash`, which reads images; the chat); `AI_SUGGESTIONS_HOUSEHOLD_IDS` (comma-separated household ids allowed to use all three; unset means nobody). Read from `process.env` at call time in `server/utils/ai-config.ts` |
| Mailjet | Email notifications | `MJ_APIKEY_PUBLIC`, `MJ_APIKEY_PRIVATE` |
| Slack incoming webhooks | Slack notifications | Per-user webhook URL stored in notification preferences |
| Vercel Cron | Daily occurrence generation and reminders | `vercel.json`, `CRON_SECRET` |

Other environment variables: `APP_URL` (base URL used in notification links; defaults to `https://adulting.diy`) and `DEV_LOGIN_BYPASS` (development only).

Local development and production share one blob store, so a local photo upload is a real upload.

`nuxt.config.ts` sets `nitro.vercel.functions.maxDuration` to 300 seconds (Fluid compute is on, which allows 300 on every plan) so a chat reply with searches (up to 60 s) or a plan (45 s) can finish. Nitro deploys the server as one function, so the limit applies to every route, including the scheduled jobs below.

## Scheduled Jobs

Configured in `vercel.json`; both call scheduler-protected endpoints.

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/scheduler/run` | Daily, 06:00 UTC | Backstop that makes sure every active recurring task has a pending occurrence |
| `/api/scheduler/reminders` | Daily, 13:00 UTC | Send due reminders |
