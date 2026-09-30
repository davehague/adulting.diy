# API Endpoints Reference

This document provides an overview of all API endpoints in the Adulting.DIY application.

## Authentication

The API uses these authentication levels:
- **Public**: No authentication required
- **Protected**: Requires valid bearer token
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
| `GET` | `/api/providers/[id]` | Household | Get provider with contacts, evidence, comments, linked tasks |
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

## Provider Categories and Statuses

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/provider-categories` | Household | List provider categories |
| `POST` | `/api/provider-categories` | Household Admin | Create category |
| `PUT` | `/api/provider-categories/[id]` | Household Admin | Rename category |
| `DELETE` | `/api/provider-categories/[id]` | Household Admin | Delete category; 409 if in use unless `moveToId` is given |
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
| `GET` | `/api/user/profile` | Public | Get user profile by email query |
| `POST` | `/api/user/register` | Public | Register new user from Google OAuth |
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

## Rate Limiting

No rate limiting is currently implemented. Consider adding rate limiting for production deployment, especially for:
- User registration endpoints
- Scheduler endpoints
- Comment creation