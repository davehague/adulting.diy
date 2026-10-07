# API Endpoints Reference

This document provides an overview of all API endpoints in the Adulting.DIY application.

## Authentication

The API uses these authentication levels:
- **Public**: No authentication required
- **Identity**: Requires a valid Google ID token, but no user row yet (used during sign-in)
- **Protected**: Requires valid bearer token and a registered user
- **Household**: Requires valid bearer token + household membership
- **Household Admin**: Household membership plus the admin role
- **Household API Key**: Bearer token of the form `adk_...`, a per-household key created by an admin (see [provider-ingest.md](provider-ingest.md))

## Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/categories` | Protected | Get all categories (predefined + custom) |
| `POST` | `/api/categories/create` | Protected | Create custom category (admin only) |

## Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/dashboard` | Household | Get dashboard summary (pending occurrences, completed count, members) |

## Household Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/household/create` | Protected | Create new household, set user as admin |
| `GET` | `/api/household` | Household | Get household details |
| `PUT` | `/api/household` | Household | Update household settings (name, timezone; admin only) |
| `POST` | `/api/household/join` | Protected | Join household using invite code |
| `GET` | `/api/household/users` | Household | Get active members and former members |
| `POST` | `/api/household/leave` | Household | Leave current household |
| `DELETE` | `/api/household/users/[userId]` | Household | Remove user from household (admin only) |
| `PUT` | `/api/household/users/[userId]/admin` | Household | Promote or demote admin role (admin only) |
| `POST` | `/api/household/invite-code/regenerate` | Household | Regenerate invite code (admin only) |

## Task Definitions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tasks` | Household | Get all tasks with optional filtering/search |
| `POST` | `/api/tasks` | Household | Create new task definition |
| `GET` | `/api/tasks/[id]` | Household | Get specific task details |
| `PUT` | `/api/tasks/[id]` | Household | Update task definition |
| `DELETE` | `/api/tasks/[id]` | Household | Soft delete task |
| `POST` | `/api/tasks/[id]/pause` | Household | Pause task (stop generating occurrences) |
| `POST` | `/api/tasks/[id]/unpause` | Household | Resume paused task |
| `GET` | `/api/tasks/[id]/occurrences` | Household | Get all occurrences for specific task |
| `GET` | `/api/tasks/[id]/history` | Household | Get task-level history/timeline |
| `GET` | `/api/tasks/[id]/catch-up-preview` | Household | Preview catch-up: shows overdue count and calculated next date |
| `POST` | `/api/tasks/[id]/catch-up` | Household | Execute catch-up: bulk-skip overdue, generate next occurrence |

## Task Occurrences

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/occurrences` | Household | Get all occurrences with filtering/search |
| `GET` | `/api/occurrences/[id]` | Household | Get specific occurrence details |
| `PUT` | `/api/occurrences/[id]` | Household | Update occurrence (due date, assignees) |
| `POST` | `/api/occurrences/[id]/execute` | Household | Mark occurrence as completed |
| `POST` | `/api/occurrences/[id]/skip` | Household | Mark occurrence as skipped with reason |
| `POST` | `/api/occurrences/[id]/comments` | Household | Add comment to occurrence |
| `PUT` | `/api/occurrences/[id]/comments/[commentId]` | Household | Edit own comment (author only) |
| `GET` | `/api/occurrences/[id]/history` | Household | Get occurrence history/timeline |

## Providers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/providers` | Household | List providers (query: `search`, `categoryId`, `statusId`, `includeHidden`, `sort` = name, mentions, lastSighting, rating) |
| `POST` | `/api/providers` | Household | Create provider |
| `GET` | `/api/providers/[id]` | Household | Get provider with contacts, evidence, comments, linked tasks, and linked projects (`projects`: each link's `status` and the project's `id`, `title`, `status`; deleted projects left out) |
| `PUT` | `/api/providers/[id]` | Household | Update provider |
| `DELETE` | `/api/providers/[id]` | Household | Soft delete provider |
| `POST` | `/api/providers/[id]/comments` | Household | Add comment |
| `PUT` | `/api/providers/[id]/comments/[commentId]` | Household | Edit own comment (author only) |
| `DELETE` | `/api/providers/[id]/comments/[commentId]` | Household | Delete own comment (author only) |
| `POST` | `/api/providers/[id]/contacts` | Household | Add contact |
| `PUT` | `/api/providers/[id]/contacts/[contactId]` | Household | Update contact |
| `DELETE` | `/api/providers/[id]/contacts/[contactId]` | Household | Delete contact |
| `GET` | `/api/tasks/[id]/providers` | Household | List providers linked to a task |
| `POST` | `/api/tasks/[id]/providers` | Household | Link a provider to a task (`{ providerId }`) |
| `DELETE` | `/api/tasks/[id]/providers/[providerId]` | Household | Unlink a provider from a task |

## Projects

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/projects` | Household | List projects (query: `status` comma-separated, defaults to `planning,active`; `path` = `diy`, `hire`, `unsure`, or `none` for not set). Returns each project with its photo count, cover photo id, ordered photo ids, and `chosenProviderNames` (providers marked chosen, in link order), sorted Active first then Planning, Future, Done, newest first within each |
| `POST` | `/api/projects` | Household | Create project (`title` required, `location` and `notes` optional); status starts as `planning`, path as null |
| `GET` | `/api/projects/locations` | Household | Distinct locations already used by the household's non-deleted projects, for suggestions |
| `GET` | `/api/projects/next-steps` | Household | The dashboard list: `hasProjects` (any non-deleted project exists) and one item per Active project, newest first, each with `kind` = `step`, `noSteps` or `allDone` and, for `step`, the next undone step (id, text, estimate) |
| `GET` | `/api/projects/[id]` | Household | Get one project with its photos in order, its steps in order (position, then creation time), its saved `providerCategoryId`, and its linked providers (`providers`, ordered chosen, contacted, considering, passed, then oldest link first) |
| `PUT` | `/api/projects/[id]` | Household | Update any of title, location, status, path, notes, `providerCategoryId` (null clears it; 400 if the category is not the household's); moving to `done` sets `completedAt`, moving away clears it |
| `DELETE` | `/api/projects/[id]` | Household | Soft delete project |
| `POST` | `/api/projects/[id]/photos` | Household | Upload one photo; multipart form fields `full` and `thumb` (the JPEG files) plus `width` and `height` (the full image's pixel size) |
| `GET` | `/api/projects/[id]/photos/[photoId]` | Household | Stream a photo; query `variant` = `thumb` or `full` (default `full`) |
| `DELETE` | `/api/projects/[id]/photos/[photoId]` | Household | Remove a photo's row and both stored files |
| `POST` | `/api/projects/[id]/steps` | Household | Add a step (`text` required, 1 to 200 characters; `estimateMinutes` optional, whole number 1 to 9999); it goes last. 409 at 100 steps |
| `PUT` | `/api/projects/[id]/steps/[stepId]` | Household | Update any of `text`, `estimateMinutes` (null clears it), `done` (true sets the done time unless already set, false clears it) |
| `DELETE` | `/api/projects/[id]/steps/[stepId]` | Household | Remove a step for good |
| `GET` | `/api/projects/[id]/providers` | Household | List the project's linked providers, each with `providerId`, `status` and `provider` (`id`, `name`, `phone`, `neighborCount`). Links to removed providers are left out |
| `POST` | `/api/projects/[id]/providers` | Household | Link a provider (`providerId` required); the link starts as `considering`. 404 if the provider is not the household's or is removed, 409 if already linked or at 25 links. Returns the full list |
| `PUT` | `/api/projects/[id]/providers/[providerId]` | Household | Set the link's `status` (`considering`, `contacted`, `chosen`, `passed`). Returns the full list |
| `DELETE` | `/api/projects/[id]/providers/[providerId]` | Household | Remove the link for good. Returns the remaining list |
| `GET` | `/api/projects/[id]/suggestions` | Household | AI provider suggestions for the project: `{ enabled, limitReached, suggestion }`. `enabled` is false for a household not on the allowed list. `suggestion` is the saved result (parts with category, search URL, pool size and picks with current provider fields and the saved reason) or null |
| `POST` | `/api/projects/[id]/suggestions` | Household | Run an ask (`extraText` optional, up to 500 characters). Takes about 15 seconds; makes two model calls. 403 when not enabled, 429 at 20 asks in 24 hours. Otherwise 200 with `{ status, limitReached, suggestion, fallback }`, where `status` is `ok`, `too_vague` or `failed`; on `failed` the previous result is kept and `fallback` lists top providers in the project's category |
| `GET` | `/api/projects/[id]/plan` | Household | The AI DIY plan: `{ enabled, limitReached, hasSuggestions, plan }`. `plan` is the saved result (summary, safety, steps, tools, materials) with `extraText` and `createdAt`, or null |
| `POST` | `/api/projects/[id]/plan` | Household | Make a plan (`extraText` optional, up to 500 characters). One model call, about 20 seconds. 403 when not enabled, 429 at the shared cap of 20 asks in 24 hours. Otherwise 200 with `{ status, limitReached, hasSuggestions, plan }`; on `failed` the previous plan is kept |
| `POST` | `/api/projects/[id]/steps/batch` | Household | Append up to 30 steps (`steps: [{ text, estimateMinutes? }]`, each under the step rules) in order up to the cap of 100. Returns `{ steps, skipped }`: the whole checklist in order and how many were left out |

See [projects.md](../functionality/projects.md) for the product view.

## Provider Categories and Statuses

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/provider-categories` | Household | List provider categories |
| `POST` | `/api/provider-categories` | Household Admin | Create category |
| `PUT` | `/api/provider-categories/[id]` | Household Admin | Rename category |
| `DELETE` | `/api/provider-categories/[id]` | Household Admin | Delete category; 409 if providers use it unless `moveToId` is given, in which case providers and projects saved with the category move to it. Otherwise projects saved with it are left with no category |
| `PUT` | `/api/provider-categories/reorder` | Household Admin | Reorder categories (`{ orderedIds }`) |
| `GET` | `/api/provider-statuses` | Household | List statuses (seeds defaults on first call) |
| `POST` | `/api/provider-statuses` | Household Admin | Create status (name, kind, hiddenByDefault) |
| `PUT` | `/api/provider-statuses/[id]` | Household Admin | Update status |
| `DELETE` | `/api/provider-statuses/[id]` | Household Admin | Delete status; 409 if in use unless `moveToId` is given |
| `PUT` | `/api/provider-statuses/reorder` | Household Admin | Reorder statuses (`{ orderedIds }`) |

## API Keys and Provider Ingest

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/api-keys` | Household Admin | List keys (prefix, created, last used, revoked) |
| `POST` | `/api/api-keys` | Household Admin | Create key; plaintext key is returned once |
| `DELETE` | `/api/api-keys/[id]` | Household Admin | Revoke key |
| `POST` | `/api/ingest/providers` | Household API Key | Bulk upsert providers and evidence (max 500 per request) |
| `GET` | `/api/ingest/categories` | Household API Key | List the household's provider category names, so machine callers file finds under existing categories |

See [provider-ingest.md](provider-ingest.md) for the ingest contract.

## User Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/user/profile` | Identity | Get the caller's own user row (404 if they have not registered yet). An `email` query that differs from the token's email is rejected with 403 |
| `POST` | `/api/user/register` | Identity | Create (or touch) the user row for the token's email. An email in the body is ignored |
| `GET` | `/api/user/notifications` | Household | Get user notification preferences |
| `PUT` | `/api/user/notifications` | Household | Update notification preferences |

## System Scheduler

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET/POST` | `/api/scheduler/run` | API Key | Generate task occurrences (automated) |
| `GET/POST` | `/api/scheduler/reminders` | API Key | Send reminder notifications (automated) |

Scheduler endpoints are protected by `CRON_SECRET` via `Authorization: Bearer` token. This is used by Vercel Cron Jobs automatically and for any manual triggers.

These endpoints are called automatically by Vercel Cron Jobs (configured in `vercel.json`):
- `/api/scheduler/run` — daily at 06:00 UTC
- `/api/scheduler/reminders` — daily at 13:00 UTC

## Request/Response Patterns

### Filtering & Search
Many GET endpoints support query parameters:
- `status` - Filter by status
- `category` - Filter by category
- `assignee` - Filter by assignee
- `search` - Text search
- `startDate`/`endDate` - Date range filtering
- `sortBy`/`sortOrder` - Sorting options

### Error Responses
All endpoints return standardized error responses:
```json
{
  "statusCode": 400,
  "statusMessage": "Bad Request",
  "message": "Detailed error description"
}
```

### Authentication Headers
Protected endpoints require:
```
Authorization: Bearer <token>
```

## Data Models

Key data models handled by the API:
- **User**: Profile and authentication data
- **Household**: Group container for users and tasks
- **Category**: Task organization (predefined + custom)
- **TaskDefinition**: Task templates with scheduling rules
- **TaskOccurrence**: Specific instances of tasks to be completed
- **OccurrenceHistoryLog**: Audit trail for occurrence changes
- **FormerHouseholdMember**: Snapshot of departed users for historical display
- **Provider**, **ProviderCategory**, **ProviderStatus**, **ProviderContact**, **ProviderEvidence**, **ProviderComment**, **TaskProvider**, **ApiKey**: Provider directory and machine ingest (see [provider-ingest.md](provider-ingest.md))
- **Project**, **ProjectPhoto**, **ProjectStep**, **ProjectProvider**, **ProjectSuggestion**, **ProjectPlan**: Home project tracking with private photos, a checklist of steps, providers linked with a per-project status, the latest AI provider suggestion and the latest AI DIY plan (see [projects.md](../functionality/projects.md))
- **AiRequestLog**: One row per AI ask of any feature (outcome, timing, sizes; no text), used for the shared daily cap

## Rate Limiting

No rate limiting is currently implemented. Consider adding rate limiting for production deployment, especially for:
- User registration endpoints
- Scheduler endpoints
- Comment creation