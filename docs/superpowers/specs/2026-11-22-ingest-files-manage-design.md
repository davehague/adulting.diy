# Ingest: manage project documents and photos — design

Slice `ingest-files` of the initiative in [docs/plans/2026-11-22-ingest-manage-existing-projects.md](../../plans/2026-11-22-ingest-manage-existing-projects.md) (Slices 4 and 5). A script holding the household API key can rename, re-note and delete a project's documents, delete and reorder its photos, and retry a photo upload without adding a copy. No schema change.

## Shared rules

Every route uses `defineApiKeyProtectedEventHandler` and `toHttpError`, like `server/api/ingest/projects/[id]/documents.post.ts`. Every write calls `ApiKeyService.requireOwnerInHousehold` first (403 if the key's owner left). A project in another household or a deleted project, and an unknown document or photo, answer 404. Ingest glue (owner check, id lookups, DTO mapping) lives in `ProjectFileIngestService`; business rules stay in `ProjectDocumentService` and `ProjectPhotoService`.

## Documents

### `PATCH /api/ingest/projects/[id]/documents/[documentId]`

Body `{ name?, note? }`, parsed by a new `ingestDocumentUpdateSchema` (the browser's `documentName` and `documentNote` rules, plus `.strict()`):

- `name`: string, trimmed, 1–120 characters. Blank → 400 "Name can't be blank"; `null` → 400 (as on register).
- `note`: string or `null`, trimmed, ≤ 200; blank or `null` clears it.
- `{}` → 400 "Nothing to update"; an unknown key → 400.

`ProjectFileIngestService.updateDocument` → `ProjectDocumentService.update` → `toIngestDocument`. Returns `IngestProjectDocumentDto`. Safe to repeat.

### `DELETE /api/ingest/projects/[id]/documents/[documentId]`

`ProjectFileIngestService.removeDocument` → `ProjectDocumentService.remove` (deletes the row, then the blob, best effort, exactly as the browser route). Returns `{ success: true }`. A repeat answers 404, which a retrying caller treats as done.

## Photos

### `DELETE /api/ingest/projects/[id]/photos/[photoId]`

`ProjectFileIngestService.removePhoto` → `ProjectPhotoService.remove`. Returns `{ success: true }`; a repeat answers 404 (done on retry). Deleting the cover makes the next-lowest position the cover; positions are not renumbered.

### `POST /api/ingest/projects/[id]/photos` with `photoId`

The form gains an optional `photoId` text field (a UUID, lowercased before use since `ProjectPhoto.id` is a string column). `readIngestPhotoUpload` in `server/utils/photo-upload.ts` returns `{ upload, photoId }`; the browser route keeps calling `readPhotoUpload`, which is unchanged. A `photoId` that is not a UUID → 400 "photoId must be a UUID".

`ProjectFileIngestService.addPhoto(householdId, userId, projectId, upload, photoId?)`:

1. Owner check.
2. With a `photoId`, look it up by id (with its project's household and status):
   - in this project, project active in this household → return it (200, `IngestProjectPhotoDto`); nothing is stored and the cap and JPEG checks are skipped, since the first call passed them.
   - on this project id but the project is deleted or in another household → 404 "Project not found".
   - anywhere else → 409 "That photoId is already used" (says nothing about where).
3. Otherwise `ProjectPhotoService.add(..., { id: photoId })`. If the create loses a race to a concurrent request with the same id (Prisma `P2002`), `add` has already removed its own blobs; the ingest service repeats the lookup in step 2 and returns the winner (or 409).

The route now returns `IngestProjectPhotoDto` `{ id, position, width, height, createdAt }` (via `toIngestPhoto`) for a new photo and a repeated `photoId` alike: a superset of the old `{ id, width, height, position }`, so existing callers keep working. Without a `photoId` the route otherwise behaves as today (not safe to retry).

`ProjectPhotoService` gains `insert(householdId, projectId, userId, upload, { id? })`, which does what `add` did and returns the row's DTO plus `createdAt`; `add` becomes `insert` without an id, mapped to the old `ProjectPhotoDto`, so the browser route's response is unchanged. Blob paths: when no id is given, nothing changes (`<id>-full.jpg`, `<id>-thumb.jpg`). When an id is given, the file key in the path is a fresh `randomUUID()`, not the photo id, because two concurrent requests with the same id would otherwise write the same paths and the loser's cleanup would delete the winner's files. Nothing parses photo paths; every reader takes them from the row. A code comment says why the key differs from the id, and a test proves a losing concurrent create's cleanup never touches the winner's paths.

### `PUT /api/ingest/projects/[id]/photos/order`

Body `{ photoIds: string[] }` (`.strict()`, at most 25, no duplicates → 400). `ProjectPhotoService.reorder(householdId, projectId, photoIds)`:

1. Project active in this household, else 404.
2. In one `prisma.$transaction`: read the project's photo ids; if `photoIds` is not exactly that set → 400 "photoIds must list every photo in this project exactly once"; set each listed photo's `position` to its index (0..n-1), skipping rows already there; read the photos back ordered by position.
3. A write conflict (Prisma `P2034`) → 409 "Photos changed while reordering. Try again."

Returns `{ photos: IngestProjectPhotoDto[] }` in the new order (via `toIngestPhoto`). The first id becomes the cover. Safe to repeat. An empty list is valid only for a project with no photos.

## Files

- New routes: `server/api/ingest/projects/[id]/documents/[documentId].patch.ts`, `[documentId].delete.ts`, `server/api/ingest/projects/[id]/photos/[photoId].delete.ts`, `server/api/ingest/projects/[id]/photos/order.put.ts`.
- Edited: `server/api/ingest/projects/[id]/photos.post.ts`, `server/utils/photo-upload.ts`, `server/services/ProjectFileIngestService.ts`, `server/services/ProjectPhotoService.ts`, `server/utils/project-schemas.ts` (own section: `ingestDocumentUpdateSchema`, `ingestPhotoIdSchema`, `ingestPhotoOrderSchema`).
- Tests: `tests/unit/api/ingest-file-routes.test.ts`, `tests/unit/services/project-file-ingest-service.test.ts`, `tests/unit/services/project-photo-service.test.ts`; the browser route tests stay as they are.
- Docs: "Project Files" in `docs/tech/project-task-ingest.md`, the ingest rows in `docs/tech/api-endpoints.md`, one changelog entry.

## Out of scope

Replacing a document's file in place (delete and upload again); renumbering positions after a delete; a browser reorder UI.
