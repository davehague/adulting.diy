# Project documents: design

Written 2026-11-12 from the brief `2026-11-12-project-documents-brief.md` and a brainstorm with David. Status: awaiting David's review. No code until he approves this and a written plan.

## Intent

Files that are not photos should live with the project they belong to. The trigger is four contractor brief PDFs (1.9 to 3.4 MB each) made for real household projects with nowhere in Adulting.DIY to put them. Quotes and contracts come next: the back porch addition has four contractors bidding. A household member should be able to add a PDF to a project from a phone or a desktop, find it again later, open it, and hand it to a contractor.

## Goals

- A **Documents** section on the project page: add, list, open, rename and annotate, remove.
- Files of any realistic size (a scanned contract can be well over 10 MB) upload reliably from a phone.
- Documents are as private as photos: only signed-in members of the owning household can open one.

## Non-goals (this slice)

- No API-key ingest route for documents (later, when quotes start arriving by email).
- No link from a document to a provider on the project (later; the natural start of slice 3b, quotes).
- No document count on project cards or the list.
- No documents on the new-project capture form; they are added from the project page.
- No inline preview, thumbnails or text extraction.
- Documents never reach any AI model. Suggestions, the DIY plan and the chat do not know documents exist, and no `*-prompts.ts` file changes.
- No cleanup job for orphaned blobs (see Known gaps).

## Anti-goals

- Anything that makes an upload over 4.5 MB fail on Vercel while working in local dev.
- A document openable by someone outside the household, or by a former member after they leave (beyond a link they already opened, which expires in minutes).
- Serving uploaded bytes from the adulting.diy origin. Uploaded files are untrusted; they are served from the Blob domain only.
- A new long-lived secret in Vercel production.

## Decisions (David's, 2026-11-12)

David took every recommendation in the brainstorm. These are his decisions:

1. **Upload path: presigned direct upload, then a register call.** The browser asks our server for an upload URL, uploads the file straight to Vercel Blob with it (never through our function, so Vercel's 4.5 MB request body cap does not apply), then calls our server to register the document. No Blob upload-completed webhook (it cannot reach localhost). Uses `uploadPresigned` (browser) and `handleUploadPresigned` plus `issueSignedToken` (server) from `@vercel/blob` 2.8.0, already installed. These work with production's OIDC credentials and with `BLOB_READ_WRITE_TOKEN` locally, so no new Vercel setting is needed. (Verified against Vercel docs updated 2026-08/09: the 4.5 MB cap still applies to request bodies; the classic `handleUpload` would have needed `BLOB_READ_WRITE_TOKEN` added to production, which is why presigned was chosen.)
2. **Opening: a 5-minute presigned GET link.** Tapping a document asks our server (which checks sign-in and household) for a link valid for 5 minutes, and the browser opens it. Bytes come from the Blob domain, never through our function. This replaced the first idea of streaming through our route like photos, because a new browser tab cannot carry the Bearer token the app authenticates with.
3. **File types:** PDF, Word (`.docx`), Excel (`.xlsx`), JPEG and PNG. Nothing else; never HTML or SVG. Legacy `.doc`/`.xls` and HEIC are not accepted (iPhone converts a library photo to JPEG when picked through a file input; a HEIC dragged in on a desktop is rejected with the type message).
4. **Caps:** 25 MB per file, 30 documents per project.
5. **Viewing:** tap opens in a new tab. PDFs and images show in the browser's own viewer; Word and Excel download. The downloaded file carries a readable name (the original file name, made safe), not an id.
6. **Naming:** the display name starts as the file name without its extension; it can be edited. An optional one-line note (up to 200 characters, such as "Owens quote, Nov 2026"). Both are editable after upload.
7. **Placement:** a Documents section directly below Photos on the project page. Each row: a type icon, the name, the note, the size and the upload date. Nothing on project cards or the list.
8. **Delete:** any household member, after a browser confirm, matching photos.
9. **Ingest route:** not in this slice. The four briefs are uploaded through the real page in Chrome after deploy, which doubles as the end-to-end test.
10. **Provider link:** not in this slice. Adding a nullable provider column later is additive.
11. **AI:** documents are never sent to a model.

## Constraints

- **Blob store:** the one private store (`adulting-diy-photos`, iad1), shared by local dev and production. A local upload is a real upload into the production store. `server/utils/blob-storage.ts` stays the only server module that imports `@vercel/blob`; new Blob calls (token issue, the presigned upload handler, head, presigned GET) go there as named functions so services can fake storage in tests. The browser side imports `uploadPresigned` from `@vercel/blob/client`. Never add `BLOB_STORE_ID` to `.env` (see CLAUDE.md).
- **Database:** local dev and production share the one CockroachDB. The migration is hand-written (never `prisma migrate dev`) and applied by hand with `npx prisma migrate deploy`, only on David's go, before the merge. CockroachDB v26 creates tables schema-locked: put `ALTER TABLE "project_documents" SET (schema_locked = false);` right after the `CREATE TABLE`, before indexes and foreign keys.
- **Auth:** every route uses `defineHouseholdProtectedEventHandler`. `uploadPresigned` sends the Bearer token to our upload route through its `headers` option.
- **Approvals:** the schema change, the migration, the merge and the push each need David's explicit go.

## The design

### Data

New model `ProjectDocument` (table `project_documents`), modelled on `ProjectPhoto`:

| Field | Notes |
|---|---|
| `id` | uuid, generated by the client before upload and checked by the server (it is part of the Blob path) |
| `projectId` | FK to `projects`, `onDelete: Cascade` |
| `blobPath` | unique; `households/{householdId}/projects/{projectId}/documents/{id}/{fileName}` |
| `fileName` | the safe file name used in the path, with its extension (what a download is called) |
| `name` | display name, 1 to 120 characters, trimmed |
| `note` | optional, up to 200 characters, blank becomes null |
| `contentType` | one of the five allowed types, read back from Blob at register time |
| `sizeBytes` | `Int`, read back from Blob at register time |
| `uploadedById` | FK to `users`, relation `ProjectDocumentUploadedBy` |
| `createdAt`, `updatedAt` | |

Index on `(projectId, createdAt)`. Migration name: `<timestamp>_add_project_documents`, one new table, no change to existing tables. Recovery if it fails partway: `DROP TABLE IF EXISTS "project_documents";` then `npx prisma migrate resolve --rolled-back <name>`.

Shared constants and the type map go in `types/project.ts` next to the photo ones: `MAX_PROJECT_DOCUMENTS = 30`, `MAX_DOCUMENT_BYTES = 25 * 1024 * 1024`, `MAX_DOCUMENT_NAME_LENGTH = 120`, `MAX_DOCUMENT_NOTE_LENGTH = 200`, and an extension-to-MIME map (`pdf` → `application/pdf`, `docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `jpg`/`jpeg` → `image/jpeg`, `png` → `image/png`). One shared function makes a safe file name from the original (keeps letters, digits, `-`, `_`, `.`; spaces become `-`; collapses repeats; at most 80 characters before the extension; lower-case extension; falls back to `document`), so the client builds the path and the server can check it.

### Upload flow

1. **Client checks first.** On pick or drop, reject before any network call: a type outside the map ("Only PDF, Word, Excel, JPEG or PNG files"), a file over 25 MB ("Over 25 MB"), or more files than the remaining room ("This project can hold 30 documents"). The room count includes documents already uploaded plus every queued, uploading and failed item, as the photo uploader does.
2. **Upload URL.** The client generates the document id, builds the path, and calls `uploadPresigned(path, file, { access: 'private', handleUploadUrl: '/api/projects/:id/documents/upload', headers: { Authorization }, contentType, onUploadProgress })`. Our route runs `handleUploadPresigned`. Inside its `getSignedToken` the server checks that the project is active and in this household, that the path is exactly the shape above for this household and project with a well-formed uuid and an allowed extension, and that the project has fewer than 30 documents. It then issues a token scoped to that one path, `operations: ['put']`, that extension's MIME type only, `maximumSizeInBytes` 25 MB, valid 10 minutes, with `addRandomSuffix: false` and `allowOverwrite: false`. It does not set `onUploadCompleted`, and any callback-type body is rejected.
3. **Straight to Blob.** The browser PUTs the file to Blob. Progress shows as a percentage.
4. **Register.** The client calls `POST /api/projects/:id/documents` with `{ id, blobPath, name, note }`. The server checks the project (active, this household), the path shape, then heads the blob to read its real size and content type. It rejects a missing blob (400 "Upload not found. Try again."), a type that is not allowed or does not match the extension, or a size over the cap; in the last two cases it deletes the blob first. It checks the count, creates the row, then re-counts and undoes its own row and blob if a race took the project over 30 (409), exactly as `ProjectPhotoService.add` does. Registering an id that already exists for this project returns the existing document, so a retry after a dropped response is harmless.
5. **Queue.** Files upload one at a time in pick order. Each item shows its state: waiting, uploading n%, saving, done, or failed with **Retry**. Retry repeats only the step that failed (a failed register does not re-upload). A waiting or failed item can be removed with ×. A finished item leaves the queue and appears in the list.
6. **Retrying an upload whose PUT may have landed** (claude's call): the path refuses overwrites, so a PUT that succeeded but lost its response on a phone would fail again on a blind re-upload. Retry of the upload step therefore keeps the same id and goes straight to register first; register heads the blob, and if it is there with an allowed type and size the document is saved and no re-upload happens. Only a register answer of "Upload not found" leads to a fresh PUT to the same path.

### Opening

`POST /api/projects/:id/documents/:documentId/link` checks the project and document and returns `{ url, expiresAt }`: a presigned GET URL for that one blob, valid 5 minutes. To keep a phone's popup blocker from eating it, the tap handler opens a blank tab synchronously, then points it at the URL when the call returns; if the browser refused the blank tab, the current tab navigates instead. If the call fails, the blank tab is closed and the row shows "Could not open. Try again."

The URL is served by Blob with the file's own content type, so PDFs and images open in the browser and Word and Excel download. Whether Blob's `Content-Disposition` carries the safe file name is checked in the spike (task 1); if it does not, the builder decides the fallback and records it.

### Editing and removing

`PATCH /api/projects/:id/documents/:documentId` takes `{ name?, note? }` with the same limits; last write wins. Renaming does not change the stored file name (a download keeps the original name).

`DELETE /api/projects/:id/documents/:documentId` deletes the row, then removes the blob best-effort, as photo delete does.

### Reading

The project detail response gains `documents: ProjectDocumentDto[]` (id, name, note, fileName, contentType, sizeBytes, createdAt), newest first. Metadata only; no URLs. It also gains `householdId`, because the spike showed the browser's PUT is signed over the exact path the browser sends, so the browser has to build the full path itself.

### The section

A new `components/projects/ProjectDocuments.vue` sits on `pages/projects/[id].vue` directly below the Photos section, before Delete project, in the same white card style.

- Heading "Documents". An **Add documents** button opens a file picker (multiple, `accept` limited to the five types). On a computer the card is also a drop zone ("or drop files here", "Drop to add" while dragging), reusing the PhotoUploader's drop handling (extract it to a shared composable if that is clean; the builder decides).
- Empty state: "No documents yet. Add contractor briefs, quotes and contracts here."
- Each row: an icon by type (lucide `FileText` for PDF and Word, `FileSpreadsheet` for Excel, `Image` for JPEG and PNG), the name as the tap target that opens the file, the note on a second line when present, and "2.4 MB · Nov 12" in muted text. An **Edit** control turns the row into name and note fields that save when you leave the field or press Enter (the steps pattern); a blank name is refused. **Remove** asks "Remove this document? This cannot be undone." and then deletes.
- At 30 documents the Add button is disabled with "This project has 30 documents".
- Phone-first: rows are full width, the tap target is the whole name line, and Edit and Remove are reachable without hover.

Available whatever the project's status, Done included, like photos and steps.

## Where it meets existing features (impact analysis)

From the `feature-impact-analysis` pass against `docs/functionality/`:

- **Deleting a project** hides it and keeps its photos; documents follow the same rule. The link, edit, delete, upload and register routes all require an active project, so nothing about a deleted project's documents can be opened afterward. Rows and blobs stay, as photos do.
- **A project deleted mid-upload** by the other member: the upload URL or register call answers 404. A blob already uploaded is deleted by the register route when it refuses, and left as an orphan otherwise.
- **Leaving the household:** a former member cannot get new links. A link they already have works until it expires (at most 5 minutes). `uploadedById` points at a user row that is kept when a member leaves, so the foreign key never breaks.
- **Two members uploading at once** near the cap: the post-insert re-count keeps the project at 30.
- **The chat, plan and suggestions** read projects through their own context builders, which select specific fields; documents are not selected, so nothing changes. The chat's privacy line ("no … file names") stays true. A test asserts the chat context has no document data.
- **The project list and cards** are unchanged (no count). The list query must not start loading documents.
- **The dashboard** is unchanged.
- **The new-project form** is unchanged; documents need an existing project.
- **The provider page** is unchanged (no provider link in this slice).
- **Local dev** writes real blobs and rows into production storage, so test with a throwaway project and delete it afterward.
- **The photo uploader** is unchanged in behaviour; if drop handling is extracted, the photo drop zone must still accept only photos.

## Left to the builder

- Whether the document routes live in a new `ProjectDocumentService` (expected, mirroring `ProjectPhotoService`) and how the Blob wrappers in `blob-storage.ts` are named and shaped.
- Exact copy for error states not quoted above, following the photo uploader's tone.
- Whether drop handling is extracted to a composable.
- Icon sizes, spacing and the edit-mode layout, within `docs/brand.md`.
- The fallback if Blob's download name is not readable (see Opening).

## Build order and verification

1. **Spike first (throwaway, scratchpad, real store, cleaned up after):** from Node with the local token, issue a put token for a `spike/` path, upload a PDF over 4.5 MB with `uploadPresigned` or a presigned PUT, head it, presign a GET and fetch it (record `Content-Type` and `Content-Disposition`), confirm that a wrong type and an oversize file are refused, then delete everything it made. Stop and report if any of this fails, because it decides the design.
2. Schema, migration file and service with unit tests (Blob faked through `blob-storage.ts`). The migration is written but not applied without David's go.
3. Routes with tests.
4. The section, checked by the reviewer in a jsdom harness against the repo's Vue (this caught real bugs before), plus a real-browser run against local dev in the shared Chrome on `127.0.0.1:9222` with a file over 4.5 MB. That run writes to production storage and the production database, so it uses a throwaway project that is deleted afterward.
5. `update-docs`: `docs/functionality/projects.md`, the changelog, `docs/tech/architecture.md` (Blob now holds documents too, the presigned flow), `docs/tech/api-endpoints.md`, `docs/next-up.md` (the Later list below), and the CLAUDE.md signposts (the data models line).
6. On David's go: migration, then merge, then push. Then upload the four briefs through the production page in Chrome, then add a note to Slate issue SL-238.

**The production-only credential path** (claude's call). Local dev authenticates to Blob with `BLOB_READ_WRITE_TOKEN`; production uses OIDC with `BLOB_STORE_ID`, which is set in Vercel Production and Preview (checked with `vercel env ls` on 2026-11-12), so `issueSignedToken` and `presignUrl` pick it up the same way `put`, `get` and `del` already do. Token issue and presigned GET still run under OIDC for the first time in production, after the merge; a Vercel preview cannot stand in because Google sign-in does not work on preview URLs. This is accepted because a failure is contained: the migration only adds a table, nothing existing reads it, so photos, steps, the plan and the chat keep working and the Documents section fixes forward. The first production upload (a brief) is the check; if token issue fails there, read the function log, and pass `storeId` explicitly in `blob-storage.ts` only if the log points at the store id.

The plan ends with exact phone and desktop test steps.

## Known gaps (accepted)

- **Orphaned blobs:** a file uploaded but never registered (tab closed between upload and register, or register refused before cleanup) stays in the store with no row. It is unreachable, not exposed; it only costs storage. A sweep job is on the Later list.
- A deleted project's documents stay in storage, as its photos do.
- A presigned link works for anyone holding it for 5 minutes.
- Renaming does not change the downloaded file name.
- Word and Excel cannot be previewed; they download.

## Later (goes into docs/next-up.md)

- API-key ingest for documents (same presigned shape, authorised by the household key), for quotes arriving by email.
- Link a document to a provider on the project; the start of quotes (slice 3b).
- A document count on project cards.
- A sweep job for orphaned blobs.
- Letting the chat read a document (its own privacy decision).
