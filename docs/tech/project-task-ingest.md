# Project and Task Ingest - Technical Reference

Home projects (see [functionality doc](../functionality/projects.md)) and tasks (see [functionality doc](../functionality/task-management.md)) can be created by machines with the same per-household API key the provider ingest uses, and documents and photos can be attached to projects. Key creation, hashing and revocation are in [provider-ingest.md](provider-ingest.md#api-keys). This is how lists kept elsewhere (Todoist, scripts) are moved into a household.

## Key Files

- `server/api/ingest/projects.post.ts`, `server/api/ingest/tasks.post.ts` - the endpoints
- `server/services/ProjectIngestService.ts`, `server/services/TaskIngestService.ts` - batch logic
- `server/utils/project-schemas.ts` (`projectIngestItemSchema`), `server/utils/task-schemas.ts` (`taskIngestItemSchema`) - item validation
- `ApiKeyService.requireOwnerInHousehold` - the attribution check below
- `server/api/ingest/projects.get.ts`, `server/api/ingest/projects/[id]/documents/upload-url.post.ts`, `server/api/ingest/projects/[id]/documents.post.ts`, `server/api/ingest/projects/[id]/photos.post.ts` - project files
- `server/api/ingest/projects/[id]/documents/[documentId].patch.ts` and `.delete.ts`, `server/api/ingest/projects/[id]/photos/[photoId].delete.ts`, `server/api/ingest/projects/[id]/photos/order.put.ts` - renaming and removing files, and the photo order
- `server/services/ProjectFileIngestService.ts` - the ingest-only steps; every file rule stays in `ProjectDocumentService` and `ProjectPhotoService`
- `server/utils/blob-storage.ts` (`presignPrivatePut`, `findPrivateBlob`, `BLOB_API_VERSION`), `server/utils/photo-upload.ts` (the photo form, shared with the browser route)

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

Returns `{ id, position, width, height, createdAt }`. 409 at 25 photos, 400 for a non-JPEG or a missing part, 413 over the sizes.

**Retry safety: send a `photoId`.** Add a `photoId` form field holding a UUID you make once per photo (`str(uuid.uuid4())`) and send the same value on every retry. If a photo with that id is already on this project, the call returns it (200, same shape) and stores nothing, so a retry after a lost response never adds a second copy, and two calls racing with the same id still leave one photo. A `photoId` that is not a UUID answers 400; one already used by a photo on another project answers 409 (pick a new one). Without a `photoId` the call is **not** safe to retry: repeating it adds a copy.

```python
import uuid
pid = str(uuid.uuid4())   # keep this with the file; reuse it on every retry
requests.post(..., files={...}, data={"width": w, "height": h, "photoId": pid})
```

### Renaming and removing documents

```bash
DOC_API=https://www.adulting.diy/api/ingest/projects/$P/documents/$DOC
# Rename and/or re-note: send one or both fields
curl -sf -X PATCH "$DOC_API" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"name": "Owens quote (superseded)", "note": null}'
# Remove the document and its stored file
curl -sf -X DELETE "$DOC_API" -H "Authorization: Bearer $KEY"
```

- `PATCH` takes `name` (a string, 1 to 120 characters, trimmed; blank or `null` answers 400) and `note` (a string up to 200, or `null`; blank or `null` clears it). `{}` answers 400 "Nothing to update", and any other field answers 400. Returns the document `{ id, name, note, fileName, contentType, sizeBytes, createdAt }`. Safe to retry.
- `DELETE` removes the document and its file from storage, as the page does, and returns `{ "success": true }`. Repeating it answers 404: after a lost response, treat that 404 as done.
- To replace a file with a revised version, upload the new one (three calls above), then delete the old one.
- An unknown document id, or one on another project, answers 404.

### Removing and reordering photos

```bash
PH_API=https://www.adulting.diy/api/ingest/projects/$P/photos
# Remove one photo and both stored files
curl -sf -X DELETE "$PH_API/$PHOTO" -H "Authorization: Bearer $KEY"
# Set the order: list every photo id on the project, cover first
curl -sf -X PUT "$PH_API/order" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d "$(jq -n --arg a "$NEW_COVER" --arg b "$OTHER" '{photoIds: [$a, $b]}')"
```

- `DELETE` returns `{ "success": true }`; a repeat answers 404 (done on retry). Deleting the cover makes the next photo in order the cover.
- `PUT .../photos/order` takes `{ "photoIds": [...] }` listing **every** photo on the project exactly once; the first becomes the cover (lowest `position`). A missing, extra or repeated id answers 400 "photoIds must list every photo in this project exactly once", so read the current ids first (`GET /api/ingest/projects/[id]`). Returns `{ "photos": [{ id, position, width, height, createdAt }] }` in the new order, positions 0 to n-1. Safe to retry. If a photo is added or removed while the order is being saved, it answers 409; read the ids again and retry.

## Related

- [Provider ingest](provider-ingest.md) - API keys and the provider endpoint
- [API endpoints](api-endpoints.md)
- [Task scheduling](task-scheduling.md)
