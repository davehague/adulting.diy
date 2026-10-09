# Project and Task Ingest - Technical Reference

Home projects (see [functionality doc](../functionality/projects.md)) and tasks (see [functionality doc](../functionality/task-management.md)) can be created by machines with the same per-household API key the provider ingest uses. Key creation, hashing and revocation are in [provider-ingest.md](provider-ingest.md#api-keys). This is how lists kept elsewhere (Todoist, scripts) are moved into a household.

## Key Files

- `server/api/ingest/projects.post.ts`, `server/api/ingest/tasks.post.ts` - the endpoints
- `server/services/ProjectIngestService.ts`, `server/services/TaskIngestService.ts` - batch logic
- `server/utils/project-schemas.ts` (`projectIngestItemSchema`), `server/utils/task-schemas.ts` (`taskIngestItemSchema`) - item validation
- `ApiKeyService.requireOwnerInHousehold` - the attribution check below

## Shared Rules

- `Authorization: Bearer adk_...` scopes the request to the key's household; missing or invalid keys return 401.
- Everything created is attributed to the user who created the key (`createdById` on projects and steps, `createdByUserId` on tasks). If that user has since left the household, the whole request returns 403; create a new key as a current member.
- The body is an envelope with 1 to 100 items; anything else returns 400. Items are validated one at a time, so one bad item never fails the batch. The response is 200 even when some items error or are skipped, so callers must check `errors` and `skipped`. `index` is the item's position in the request.
- Re-running a batch is safe: an item that matches an existing record is skipped and reported with the existing `id`, and a repeat within the same batch is skipped the same way.

## `POST /api/ingest/projects`

```json
{
  "projects": [
    {
      "title": "Shed",
      "location": "Yard",
      "notes": "Check setbacks first",
      "status": "planning",
      "path": null,
      "steps": [{ "text": "Call Alum Creek Shed People" }, { "text": "Call the city", "estimateMinutes": 15 }]
    }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | 1-200 chars, trimmed |
| `location`, `notes` | no | Up to 100 and 5000 chars; blank becomes null |
| `status` | no | `planning` (default), `active`, `future`, `done`; `done` stamps `completedAt` |
| `path` | no | `diy`, `hire`, `unsure`, or null (default) |
| `steps` | no | Up to 100 `{ text (1-200 chars), estimateMinutes? (1-9999) }`, stored in the order given, all undone |

**Match rule:** a project is skipped when an undeleted, not-Done project in the household has the same title and location, ignoring case and surrounding spaces (a missing location only matches a missing location). A Done project never blocks a new one, so a finished chore can be filed again.

```json
{
  "created": [{ "index": 0, "id": "…", "title": "Shed", "steps": 2 }],
  "skipped": [{ "index": 1, "id": "…", "title": "Gutters", "reason": "A project with this title and location already exists" }],
  "errors": [{ "index": 2, "title": "", "message": "Title is required" }]
}
```

## `POST /api/ingest/tasks`

```json
{
  "tasks": [
    {
      "name": "Visit the cousins",
      "category": "Appointments and Errands",
      "description": "Optional",
      "scheduleConfig": { "type": "fixed_interval", "interval": 3, "intervalUnit": "month" },
      "firstDueDate": "2026-11-01"
    }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | 1-200 chars |
| `category` or `categoryId` | exactly one | A name from `taskCategories` in `GET /api/ingest/categories` (case-insensitive), or an id the household can see. When the household has its own category with the same name as a global default ("House", "Pets"), the household's own wins |
| `description` | no | Up to 5000 chars |
| `scheduleConfig` | yes | One of the shapes below, as defined in `types/task.ts`; `endCondition` is always `{ "type": "never" }` |
| `firstDueDate` | no | `YYYY-MM-DD` for the first occurrence of a recurring task; not allowed with `once` |

| `scheduleConfig.type` | Fields |
|------|--------|
| `once` | `dueDate` (`YYYY-MM-DD`) |
| `fixed_interval` | `interval` (1-365), `intervalUnit` (`day`, `week`, `month`, `year`) |
| `variable_interval` | `variableInterval: { interval, unit }` with the same limits |

The other recurrence patterns, reminders and default assignees are not accepted here; set them in the app afterward.

**First occurrence:** ingest always places the first occurrence itself, at noon UTC on a calendar date (the `parseDateOnly` convention): `dueDate` for `once`, `firstDueDate` when given, otherwise one interval from today in the household's timezone. The variable-interval default matters because the app's own create path gives a variable-interval task no occurrence until one is completed. `TaskService.create` takes the date as `options.firstDueDate` and passes it to `OccurrenceService.createInitialOccurrence`.

**Match rule:** a task is skipped when an active or paused task in the household has the same name, ignoring case and surrounding spaces. Soft-deleted tasks do not count. Near-duplicates ("Get Lana's nails cut" against "Get Lana's nails trimmed") are not caught, so check by hand before a one-off move.

**Side effects:** each created task goes through `TaskService.create`, so the household gets the usual "task created" notification, sent as if the key's owner had created it.

```json
{
  "created": [{ "index": 0, "id": "…", "name": "Visit the cousins", "firstDueDate": "2026-11-01" }],
  "skipped": [],
  "errors": [{ "index": 1, "name": "Other", "message": "Unknown category: Kids" }]
}
```

## Related

- [Provider ingest](provider-ingest.md) - API keys and the provider endpoint
- [API endpoints](api-endpoints.md)
- [Task scheduling](task-scheduling.md)
