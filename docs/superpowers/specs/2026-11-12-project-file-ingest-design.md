# Project file ingest: design

Written 2026-11-12, the same day the Documents section shipped (main 2350dbc). Status: approved in chat by David ("take all four and write the spec"); the plan comes next.

## Intent

Let a script holding the household API key put files on a project: documents (quotes, contracts, briefs) and photos. Today only a signed-in browser can, so earlier sessions added project photos with local Node scripts that wrote straight to the database and Blob, copying the services' logic and skipping their checks. Quotes arriving by email will need the same path. The existing ingest routes (`docs/tech/project-task-ingest.md`) create projects and tasks with the key; this adds files to them.

## Goals

- A script in any language (curl, Python, Node) can find a project, attach a document of up to 25 MB, and attach a photo.
- Every rule the browser enforces still holds: types, sizes, caps, household isolation, safe retries.
- No new storage path and no new table: the same services, the same Blob layout, the same rows.

## Non-goals

- Linking a document to a provider (the start of quotes, slice 3b; its own design).
- Server-side image processing. The caller makes the photo's thumbnail.
- Batches. One file per call.
- A helper script or skill. The tech doc carries curl examples.
- Any change to what the AI features read. API-added photos are ordinary project photos, so the chat sees them like any other; documents still reach no model.

## Anti-goals

- A route that accepts the file bytes for a document (Vercel's 4.5 MB request cap would make large scans fail).
- A path the caller chooses. The server builds every Blob path.
- A second copy of the upload rules. The ingest routes call `ProjectDocumentService` and `ProjectPhotoService`; they do not reimplement checks.

## Decisions (David's, 2026-11-12, from claude's recommendations)

1. **Documents take three calls:** ask for an upload URL, PUT the file to it, register it.
2. **Photos take one multipart call**, with the same fields the browser sends; the caller makes the thumbnail.
3. **A project list route** so a script can find a project id.
4. **Ingest conventions:** attributed to the key's owner, 403 if that owner has left the household, 404 for a deleted or foreign project, one file per call, documented in `docs/tech/project-task-ingest.md`, no helper script, no migration.

## Spike result (2026-11-12, real store, cleaned up)

A server-made presigned PUT URL (`issueSignedToken` + `presignUrl`) accepts a plain `curl -X PUT --data-binary @file`: 200, type taken from the extension, a second PUT refused (400, no overwrite), and the URL refused for any other path (403). Without the header `x-api-version: 12` (which `@vercel/blob` 2.8.0 sends on every request, `BLOB_API_VERSION`) Blob stores the file with `Content-Disposition: attachment`, so a PDF downloads instead of opening; with it, `inline`, matching browser uploads. The upload URL response therefore carries the headers the caller must send.

## The design

All routes use `defineApiKeyProtectedEventHandler` (401 for a missing, invalid or revoked key). Every write first calls `ApiKeyService.requireOwnerInHousehold` (403 "The API key owner is no longer a member of this household"). Errors follow the existing services' messages and statuses.

### `GET /api/ingest/projects`

Lists the household's projects that are not deleted, every status, newest first: `{ projects: [{ id, title, location, status, path, createdAt }] }`. Read-only, so no owner check (as `GET /api/ingest/categories`).

### Documents

**1. `POST /api/ingest/projects/:id/documents/upload-url`** with `{ fileName }` (the original name, 1 to 255 characters).

- The server makes the document id (uuid), the safe file name (`safeDocumentFileName`; 400 "Only PDF, Word, Excel, JPEG or PNG files" when it is null) and the path (`documentBlobPath` with the key's household).
- It calls `ProjectDocumentService.authorizeUpload` with that path, which checks the project (404), the shape, the cap (409) and the id.
- It returns `{ documentId, fileName, uploadUrl, method: "PUT", headers: { "x-api-version": "12" }, maxBytes: 26214400, expiresAt }`. The URL is a presigned PUT for that one path, that type only, 25 MB, valid 10 minutes, no overwrite, no random suffix. The header map is what the caller must send with the PUT; its version value is read from one constant in `blob-storage.ts` with a comment naming the SDK constant it mirrors.

**2. The caller PUTs the file** to `uploadUrl` with those headers. Example: `curl -X PUT -H 'x-api-version: 12' --data-binary @"Owens quote.pdf" "$UPLOAD_URL"`. A wrong type, an oversize file or an expired URL is refused by Blob.

**3. `POST /api/ingest/projects/:id/documents`** with `{ documentId, name?, note? }`.

- The server finds the stored file by listing the Blob prefix `households/{householdId}/projects/{projectId}/documents/{documentId}/` (one result expected; none → 400 "Upload not found. Try again."). This keeps the caller from carrying the path.
- `name` defaults to the stored file name without its extension, with `-` and `_` shown as spaces (so `Owens-quote.pdf` becomes "Owens quote"); the browser default (the original name) is not available here because nothing stores it between the calls (claude's call). Same limits as the page: name 1 to 120 after trimming, note up to 200, blank note → null.
- It then calls `ProjectDocumentService.register` with the found path, so the head check, the type and size refusals (with the blob deleted), the cap re-count and the repeated-id answer all apply unchanged. A repeated register returns the existing document.

### Photos

**`POST /api/ingest/projects/:id/photos`**, multipart form, the same fields as the browser route: `full` (JPEG, at most 3 MB), `thumb` (JPEG, at most 200 KB), `width` and `height` (the full image's pixels). Calls `ProjectPhotoService.add` with the key owner: 404, 409 at 25 photos, 400 for a non-JPEG, 413 over the sizes, exactly as the browser route. Returns the photo `{ id, width, height, position }`. The tech doc shows making the two JPEGs with Pillow using the browser's own targets from `utils/image-resize.ts`: full image longest side 2000 px at quality 85, thumbnail longest side 400 px at quality 80.

### Where it lives

- Routes: `server/api/ingest/projects.get.ts`, `server/api/ingest/projects/[id]/documents/upload-url.post.ts`, `server/api/ingest/projects/[id]/documents.post.ts`, `server/api/ingest/projects/[id]/photos.post.ts`. Nitro serves `projects.post.ts` and `projects/` side by side, as it does for photos.
- `blob-storage.ts` gains `presignPrivatePut(pathname, grant): Promise<{ url: string; headers: Record<string, string>; expiresAt: string }>` and `findPrivateBlob(prefix): Promise<string | null>` (a `list` with that prefix and limit 2; more than one result is treated as "not found", since the shape allows only one).
- The photo route's multipart parsing is shared with the browser route rather than copied (extract a small helper; the builder decides its shape).

## Where it meets existing features (impact analysis)

- **API keys:** a key is household-wide, so it can write to any project in its household; revoking a key stops all four routes at once; `lastUsedAt` updates as for other ingest calls.
- **Former members:** a key whose owner left is refused on every write (403), as the project and task ingest routes do. The list stays readable, as categories are.
- **Deleted projects:** excluded from the list; every write answers 404.
- **Done projects:** listed with their status and accept files, like the page.
- **Project page:** files added by a script appear on the next load (no live update), newest document first, photos appended after the existing ones. A first photo becomes the project's cover on cards.
- **Chat:** API photos are project photos, so the chat sends them as thumbnails like any other. Documents still reach no model; the guard test stays.
- **Caps:** API uploads count against the same 30 documents and 25 photos as the page; a page upload and a script upload racing near a cap are covered by the services' re-count.
- **Orphans:** an upload URL that is used but never registered (or a URL requested and abandoned) leaves a blob with no row, as on the page. Same Later item.
- **Docs:** `docs/functionality/projects.md` limitation line ("not … by a script with the household's API key") goes; the changelog gets an entry; `docs/tech/api-endpoints.md` and `project-task-ingest.md` get the routes.

## Left to the builder

- The schema names in `project-schemas.ts` and the shared multipart helper's shape.
- Whether the list route has a status filter (not needed by any caller now; leave it out unless trivial).
- Exact wording of 400 messages not quoted above, matching the existing ingest routes.

## Verification

1. Unit tests for the new `blob-storage` functions' callers (Blob faked), each route (auth, owner check, validation, pass-through), and the register-by-id lookup (none, one, two results).
2. A real run against local dev with a real household API key created for the test and revoked afterwards (local dev shares production data and storage): list projects, attach a PDF over 4.5 MB with the three calls using curl, attach a photo made with Pillow, open the document from the page, then remove both and revoke the key.
3. `update-docs`, then a whole-branch review by a fresh reviewer, then David's go on merge and push. No migration.
