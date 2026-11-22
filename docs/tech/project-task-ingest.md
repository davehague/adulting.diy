# Project and Task Ingest - Technical Reference

Home projects (see [functionality doc](../functionality/projects.md)) and tasks (see [functionality doc](../functionality/task-management.md)) can be created by machines with the same per-household API key the provider ingest uses, and documents and photos can be attached to projects. Key creation, hashing and revocation are in [provider-ingest.md](provider-ingest.md#api-keys). This is how lists kept elsewhere (Todoist, scripts) are moved into a household.

## Key Files

- `server/api/ingest/projects.post.ts`, `server/api/ingest/tasks.post.ts` - the endpoints
- `server/services/ProjectIngestService.ts`, `server/services/TaskIngestService.ts` - batch logic
- `server/utils/project-schemas.ts` (`projectIngestItemSchema`), `server/utils/task-schemas.ts` (`taskIngestItemSchema`) - item validation
- `ApiKeyService.requireOwnerInHousehold` - the attribution check below
- `server/api/ingest/projects.get.ts`, `server/api/ingest/projects/[id]/documents/upload-url.post.ts`, `server/api/ingest/projects/[id]/documents.post.ts`, `server/api/ingest/projects/[id]/photos.post.ts` - project files
- `server/services/ProjectFileIngestService.ts` - the ingest-only steps; every file rule stays in `ProjectDocumentService` and `ProjectPhotoService`
- `server/api/ingest/projects/[id].get.ts`, `[id].patch.ts`, `[id].delete.ts` - project detail, update and delete; `ProjectIngestService.getDetail`, `update`, `remove`; `ingestProjectUpdateSchema` in `server/utils/project-schemas.ts`
- `server/utils/ingest-project-dto.ts` - maps the services' step, document, photo and provider shapes to the ingest contract (`IngestProject*Dto` in `types/project.ts`)
- `server/utils/blob-storage.ts` (`presignPrivatePut`, `findPrivateBlob`, `BLOB_API_VERSION`), `server/utils/photo-upload.ts` (the photo form, shared with the browser route)
- `server/api/ingest/projects/[id]/steps.post.ts`, `server/api/ingest/projects/[id]/steps/[stepId].patch.ts`, `server/api/ingest/projects/[id]/steps/[stepId].delete.ts` - steps on an existing project
- `server/services/ProjectStepIngestService.ts` - owner check, the undone-text match and the batch envelope; the cap, positions and `doneAt` rules stay in `ProjectStepService` (`append`, `update`, `remove`)

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

## Project Files

Call `https://www.adulting.diy`. The bare `adulting.diy` answers with a redirect to `www`, which curl does not follow without `-L` and which makes most HTTP libraries drop the `Authorization` header, so the call comes back 401.

The project and task batch rules above do not apply here: these routes take one file per call. Writes are attributed to the key's owner and refused with 403 if that person has left the household; a deleted project or one in another household answers 404. Files added this way appear on the project page on its next load, exactly as if added there.

### `GET /api/ingest/projects`

`{ "projects": [{ "id", "title", "location", "status", "path", "createdAt" }] }`: every project that is not deleted, Done included, newest first. Use it to find the id to attach a file to.

### Documents: three calls

PDF, Word (`.docx`), Excel (`.xlsx`), JPEG or PNG, up to 25 MB, 30 per project. The file goes straight to storage, so large scans work.

```bash
KEY="adk_..."; P="<project id>"; F="Owens quote.pdf"; API=https://www.adulting.diy/api/ingest/projects/$P
# 1. Ask for an upload URL (checks type, the 30 cap and the project; valid 10 minutes)
R=$(curl -sf -X POST "$API/documents/upload-url" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d "$(jq -n --arg f "$F" '{fileName: $f}')")
# R = { "documentId", "fileName": "Owens-quote.pdf", "uploadUrl", "method": "PUT",
#       "headers": { "x-api-version": "12" }, "maxBytes": 26214400, "expiresAt" }
DOC=$(jq -r .documentId <<<"$R"); UPLOAD_URL=$(jq -r .uploadUrl <<<"$R")

# 2. PUT the file with every header from R.headers (read them; don't hardcode the version)
HEADERS=(); while IFS= read -r h; do HEADERS+=(-H "$h"); done < <(jq -r '.headers | to_entries[] | "\(.key): \(.value)"' <<<"$R")
curl -sf -X PUT "${HEADERS[@]}" --data-binary @"$F" "$UPLOAD_URL"

# 3. Register it (name and note optional)
curl -sf -X POST "$API/documents" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d "$(jq -n --arg d "$DOC" '{documentId: $d, note: "Owens quote, Nov 2026"}')"
```

- Send every header in `headers` with the PUT, read from the response rather than copied, since the version can change with an SDK upgrade. Without `x-api-version` the file is stored as a download, so a PDF will not open in the browser. The value mirrors the SDK's own `BLOB_API_VERSION`; a unit test fails if an SDK upgrade changes it.
- `name` must be a string when sent; leave it out rather than sending `null` (null answers 400).
- The upload URL writes only that one path, only that file type, at most 25 MB, and never over an existing file. A second PUT answers 400 (the first one landed); an expired URL means asking for a new one.
- Register finds the file by `documentId` under this project and household, then applies the same checks as the page (real size and type read back, the cap re-counted). It answers 400 "Upload not found. Try again." when nothing was uploaded under that id (or the document was deleted since), and 400 for a malformed id. Repeating a successful register returns the same document, so it is safe to retry.
- Without `name`, the document is named after the stored file: `Owens-quote.pdf` becomes "Owens quote". `name` is 1 to 120 characters; `note` up to 200.
- A URL asked for and never used, or a PUT never registered, leaves nothing visible (the file, if any, sits in storage with no row).

### `POST /api/ingest/projects/[id]/photos`

One photo per call, the same multipart form the browser sends: `full` (JPEG, at most 3 MB), `thumb` (JPEG, at most 200 KB), `width` and `height` (the full image's pixels). The caller makes both JPEGs; the browser's own targets are a 2000 px longest side at quality 85 and a 400 px thumbnail at quality 80:

```python
from PIL import Image, ImageOps
import io, requests
img = ImageOps.exif_transpose(Image.open("porch.jpg")).convert("RGB")
def jpeg(edge, q):
    c = img.copy(); c.thumbnail((edge, edge)); b = io.BytesIO(); c.save(b, "JPEG", quality=q); return b.getvalue(), c.size
full, (w, h) = jpeg(2000, 85); thumb, _ = jpeg(400, 80)
requests.post(f"https://www.adulting.diy/api/ingest/projects/{P}/photos", headers={"Authorization": f"Bearer {KEY}"},
              files={"full": ("full.jpg", full, "image/jpeg"), "thumb": ("thumb.jpg", thumb, "image/jpeg")},
              data={"width": w, "height": h})
```

Returns `{ id, width, height, position }`. 409 at 25 photos, 400 for a non-JPEG or a missing part, 413 over the sizes. **Not safe to retry:** there is no caller-supplied id, so repeating a call after a lost response adds a second copy (delete it on the page).

## Project Detail, Update and Delete

One project per call, so a script can see what is already on a project before it adds to it, change the project's fields, and remove a project it made. The host rule and the 401/403/404 rules of [Project Files](#project-files) apply; the read is not attributed to anyone, so only the writes check that the key's owner is still in the household.

`ProjectIngestService.getDetail`, `update` and `remove` call `ProjectService.get`, `update` and `softDelete`, so the 404 rules, the ordering and the Done rule are the app's own. The response shapes are the ingest contract in `types/project.ts` (`IngestProjectDetail` and the `IngestProject*Dto` items), built by the helpers in `server/utils/ingest-project-dto.ts`; the per-resource ingest routes return the same item shapes. The browser's `ProjectDetail` is a different, wider shape and is not changed by these routes.

### `GET /api/ingest/projects/[id]`

```bash
curl -sf "https://www.adulting.diy/api/ingest/projects/$P" -H "Authorization: Bearer $KEY"
```

```json
{
  "id": "…", "title": "Porch", "location": "Front", "status": "active", "path": "hire",
  "notes": "Railing is loose", "completedAt": null, "providerCategoryId": null,
  "createdAt": "2026-11-12T15:04:05.000Z", "updatedAt": "2026-11-20T09:00:00.000Z",
  "steps": [{ "id": "…", "text": "Get three quotes", "done": false, "doneAt": null, "estimateMinutes": 30, "position": 0 }],
  "documents": [{ "id": "…", "name": "Owens quote", "note": null, "fileName": "Owens-quote.pdf", "contentType": "application/pdf", "sizeBytes": 182044, "createdAt": "…" }],
  "photos": [{ "id": "…", "position": 0, "width": 2000, "height": 1500, "createdAt": "…" }],
  "providers": [{ "id": "…", "name": "Owens Carpentry", "status": "contacted" }]
}
```

- `steps` are in checklist order; `done` is `doneAt != null`. `documents` are newest first. `photos` are in display order, so the first one is the cover. `providers` are the providers linked to the project: `id` is the provider's id and `status` is the link's status (`considering`, `contacted`, `chosen`, `passed`).
- There are no file URLs. A document or photo is opened in the app; the ids are for the routes that change them.
- Read-only, safe to repeat.

### `PATCH /api/ingest/projects/[id]`

```bash
curl -sf -X PATCH "https://www.adulting.diy/api/ingest/projects/$P" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n '{status: "active", path: "hire", notesAppend: "2026-11-22: Owens quoted $4,200, start in March."}')"
```

| Field | Notes |
|-------|-------|
| `title` | 1-200 chars, trimmed |
| `location` | Up to 100 chars; blank or null clears it |
| `notes` | Replaces the notes. Up to 5000 chars; blank or null clears them |
| `notesAppend` | Adds a paragraph to the end of the notes, after a blank line (or becomes the notes when there are none). 1-5000 chars, trimmed |
| `status` | `planning`, `active`, `future`, `done`. Moving to `done` stamps `completedAt`, staying `done` keeps it, leaving `done` clears it |
| `path` | `diy`, `hire`, `unsure`, or null |

Returns the same shape as the GET, after the change.

- Send only the fields to change, and at least one. An empty body, an unknown field (such as `note` or `notes_append`) and `notes` with `notesAppend` all answer 400, so a typo never silently does nothing. The provider category and linked providers are not set here.
- `notesAppend` answers 400 when the notes would go over 5000 characters, and nothing is written. Use it rather than reading the notes and sending them back with `notes`: it does not overwrite a change someone made in between. If the notes keep changing while it writes, it gives up after three tries with 409 "The notes changed while appending. Try again."
- **Safe to retry.** Setting a field twice leaves the same result. `notesAppend` adds nothing when the notes already end with exactly that paragraph, so a retry after a lost response does not double it (the same paragraph cannot be appended twice in a row on purpose). The check only looks at the last paragraph: if someone else appended between the lost response and the retry, the retry adds the paragraph again, so a careful client reads the project first and looks for its text.
- With `notesAppend` and other fields together, the notes are written first and the other fields right after, not as one transaction. Every field is checked before either write, so a 400 means nothing changed.
- Checking off steps never moves a project to Done; a script that has finished the checklist sends `status: "done"` itself.

### `DELETE /api/ingest/projects/[id]`

```bash
curl -sf -X DELETE "https://www.adulting.diy/api/ingest/projects/$P" -H "Authorization: Bearer $KEY"
```

Soft-deletes the project, exactly as Delete on the project page: it leaves every list, and its photos and documents stay in storage. Returns `{ "success": true }`. A repeat answers 404, which a retrying client can treat as done. There is no undelete over the API.

## Steps on an existing project

Call `https://www.adulting.diy` (see [Project Files](#project-files) for why not the bare domain). Every write is attributed to the key's owner and refused with 403 if that person has left the household; a deleted project, one in another household, or a step that is not on that project answers 404. A malformed body answers 400 before either check. Changes appear on the project page and in the dashboard's next steps on their next load.

### `POST /api/ingest/projects/[id]/steps`

Adds 1 to 100 steps to the end of the checklist, in the order given, with the [batch rules](#shared-rules) above (items checked one at a time, 200 even with errors or skips).

```bash
KEY="adk_..."; P="<project id>"; API=https://www.adulting.diy/api/ingest/projects/$P
curl -sf -X POST "$API/steps" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"steps": [{"text": "Call the utility to mark lines", "estimateMinutes": 15}, {"text": "Pull a permit"}]}'
```

| Field | Required | Notes |
|-------|----------|-------|
| `text` | yes | 1-200 chars, trimmed |
| `estimateMinutes` | no | Whole minutes, 1-9999, or null |

```json
{
  "created": [{ "index": 0, "id": "…", "text": "Call the utility to mark lines" }],
  "skipped": [{ "index": 1, "id": "…", "text": "Pull a permit", "reason": "An undone step with this text already exists" }],
  "errors": [{ "index": 2, "text": "", "message": "Step text is required" }]
}
```

- **Match rule:** a step is skipped when the project already has an **undone** step with the same text, ignoring case and surrounding spaces, and `id` is that step's id. A done step never blocks, so "Clean the gutters" can be added again after the last one was checked off. A repeat within the same batch is skipped with the id the first one got ("Repeats an earlier step in this batch").
- **Cap:** a project holds at most 100 steps. Items that do not fit come back in `errors` with "This project already has 100 steps" and nothing is saved for them; skipped and invalid items take no room. Delete steps (below) to make room.
- **Safe to retry:** repeating a batch after a lost response skips every step it already added, as long as they are still undone. Two batches sent to the same project at the same moment are not locked against each other and can both add the same text.

### `PATCH /api/ingest/projects/[id]/steps/[stepId]`

```bash
curl -sf -X PATCH "$API/steps/$STEP" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{"done": true}'
# { "id", "text", "done": true, "doneAt": "2026-11-22T15:04:05.000Z", "estimateMinutes": 15, "position": 0 }
```

- Any of `text` (1-200 chars, trimmed), `estimateMinutes` (1-9999; null clears it) and `done` (`true` or `false`). `{}` answers 400 "Nothing to update"; an unknown field (`estimate`, `completed`) answers 400 instead of being ignored.
- `done: true` on a step that is already done keeps the time it was first checked; `done: false` clears it.
- Checking off the last undone step does **not** mark the project Done (the app asks the person). To finish the project, send `status: "done"` to the project itself.
- Returns the step in the same shape as the project read's `steps`. Safe to retry.

### `DELETE /api/ingest/projects/[id]/steps/[stepId]`

```bash
curl -sf -X DELETE "$API/steps/$STEP" -H "Authorization: Bearer $KEY"
# { "success": true }
```

The first call answers `{ "success": true }`; a repeat answers 404 "Step not found", which a retrying client can treat as done. That holds even when the retry overlaps the first call. The other steps keep their order.

## Related

- [Provider ingest](provider-ingest.md) - API keys and the provider endpoint
- [API endpoints](api-endpoints.md)
- [Task scheduling](task-scheduling.md)
