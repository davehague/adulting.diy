# Project Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. David chose **native** execution on 2026-11-12: claude builds every task in this session, then one fresh reviewer on the most capable model checks the whole branch.

**Goal:** A Documents section on the project page: upload PDF, Word, Excel, JPEG and PNG files of up to 25 MB straight to private Vercel Blob, list them, open them through a 5-minute link, rename and annotate them, and remove them.

**Architecture:** The browser calls `uploadPresigned` against our upload route, which authorises the household and project and signs a PUT for one exact path; the file goes straight to Blob. The browser then registers the document with our server, which heads the blob to read the real size and type before saving the row. Opening asks our server for a presigned GET URL valid 5 minutes. All Blob calls on the server stay in `server/utils/blob-storage.ts`.

**Tech Stack:** Nuxt 3, Prisma on CockroachDB, `@vercel/blob` 2.8.0 (`issueSignedToken`, `presignUrl`, `head`, `del`, `handleUploadPresigned`, `uploadPresigned`), Vitest, Tailwind, lucide-vue-next.

**Spec:** `docs/superpowers/specs/2026-11-12-project-documents-design.md`

## Spike result (task 1 of the spec's build order, done 2026-11-12 before this plan)

Run from Node with the local read-write token against the real store, everything deleted afterwards (verified empty):

- A 6 MB PDF uploaded through `uploadPresigned` + `handleUploadPresigned` in 1.8 s, progress reached 100.
- `head` returns `size`, `contentType: application/pdf`, `contentDisposition: inline; filename="Back-porch-brief.pdf"`. The presigned GET returns the same headers from `<store>.private.blob.vercel-storage.com`, so a download carries the safe file name. No fallback needed.
- Refused: a second PUT to the same path (`allowOverwrite: false`), an `.html` path (no type in our map, our `getSignedToken` throws), a 25 MB + 10 byte file (`BlobFileTooLargeError`), a `.pdf` path sent with `contentType: text/html` ("Content type mismatch"), an upload with no auth header, and a GET with a tampered signature (403).
- `handleUploadPresigned` throws "Missing webhook public key" unless one is passed; local `.env` has none. Pass `webhookPublicKey: 'unused'` and refuse `blob.upload-completed` bodies before calling it; the key is only used to verify those callbacks.
- The client's PUT is signed over the pathname the client sent, so the server cannot rewrite it. The browser must build the full path, so `ProjectDetail` gains `householdId`.

## Global Constraints

- File types: `pdf` → `application/pdf`; `docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; `xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; `jpg` and `jpeg` → `image/jpeg`; `png` → `image/png`. Nothing else.
- `MAX_PROJECT_DOCUMENTS = 30`, `MAX_DOCUMENT_BYTES = 25 * 1024 * 1024`, `MAX_DOCUMENT_NAME_LENGTH = 120`, `MAX_DOCUMENT_NOTE_LENGTH = 200`.
- Blob path: `households/{householdId}/projects/{projectId}/documents/{documentId}/{fileName}`; upload URL valid 10 minutes, `addRandomSuffix: false`, `allowOverwrite: false`; GET link valid 5 minutes.
- Only `server/utils/blob-storage.ts` imports `@vercel/blob` on the server. The browser imports `uploadPresigned` from `@vercel/blob/client`.
- Every route uses `defineHouseholdProtectedEventHandler` and requires the project to be `metaStatus: 'active'` in the caller's household.
- Documents never reach any model; no `*-prompts.ts` file changes.
- Copy fixed by the spec: "Only PDF, Word, Excel, JPEG or PNG files", "Over 25 MB", "This project can hold 30 documents", "Upload not found. Try again.", "No documents yet. Add contractor briefs, quotes and contracts here.", "Remove this document? This cannot be undone.", "Could not open. Try again.", "This project has 30 documents", "or drop files here", "Drop to add".
- Migration is hand-written, applied only on David's go with `npx prisma migrate deploy`, with `schema_locked = false` after `CREATE TABLE`.
- Markdown prose is never hard-wrapped.

## Review Focus

1. A path from the browser for another household's or another project's prefix, or with `..`, an unknown extension or a malformed uuid: the upload route refuses it (400) and signs nothing.
2. Register called for a blob whose real type or size breaks the rules (a token bypass, or a file renamed): register deletes the blob and refuses; the row is never written.
3. Register called twice with the same id (a retry after a lost response): the second call returns the existing document and writes nothing.
4. A phone popup blocker: opening uses a tab opened synchronously in the tap; when `window.open` returns null, the current tab navigates.
5. Two uploads racing past 30: the post-insert re-count removes the late row and its blob and answers 409.

---

### Task 1: Shared document rules

**Files:**
- Modify: `types/project.ts`
- Create: `utils/project-documents.ts`
- Test: `tests/unit/utils/project-documents.test.ts`

**Interfaces:**
- Produces in `types/project.ts`: the four constants above; `DOCUMENT_TYPES: Record<DocumentExtension, string>`; `type DocumentExtension = 'pdf' | 'docx' | 'xlsx' | 'jpg' | 'jpeg' | 'png'`; `interface ProjectDocumentDto { id: string; name: string; note: string | null; fileName: string; contentType: string; sizeBytes: number; createdAt: Date | string }`; `ProjectDetail` gains `householdId: string` and `documents: ProjectDocumentDto[]`.
- Produces in `utils/project-documents.ts` (pure, used by client and server):
  - `documentExtension(fileName: string): DocumentExtension | null`: the lower-cased last extension if it is in the map.
  - `safeDocumentFileName(original: string): string | null`: null when the extension is not allowed; otherwise the base with spaces turned into `-`, every character outside `[A-Za-z0-9._-]` dropped, runs of `-`, `_` or `.` collapsed to one, leading and trailing `.-_` trimmed, cut to 80 characters, `document` when empty, then `.` and the lower-cased extension. Idempotent.
  - `defaultDocumentName(original: string): string`: the name without its last extension, trimmed, cut to 120; `Document` when empty.
  - `documentBlobPath(householdId: string, projectId: string, documentId: string, fileName: string): string`.
  - `parseDocumentBlobPath(path: string): { householdId: string; projectId: string; documentId: string; fileName: string; extension: DocumentExtension } | null`: null unless the path is exactly the shape, all three ids are lower-case uuids, and `safeDocumentFileName(fileName) === fileName`.
  - `formatDocumentSize(bytes: number): string`: `"840 KB"` below 1 MB (rounded, at least 1 KB), `"2.4 MB"` from 1 MB (one decimal).

- [ ] **Step 1: Write the failing tests**: `documentExtension('Quote.PDF') === 'pdf'`, `documentExtension('a.doc') === null`, `documentExtension('noext') === null`; `safeDocumentFileName('Back porch and lower room brief.pdf') === 'Back-porch-and-lower-room-brief.pdf'`, `safeDocumentFileName('../../etc/passwd.pdf') === 'etc-passwd.pdf'` (or any result with no `/` and no `..`; assert those two properties), `safeDocumentFileName('Ünïcode ✓.JPEG') === 'ncode.jpeg'` style (assert it matches `/^[A-Za-z0-9._-]+\.jpeg$/`), `safeDocumentFileName('.pdf') === 'document.pdf'`, `safeDocumentFileName('x.html') === null`, idempotence over a few inputs, a 200-character base cut to 80 plus extension; `defaultDocumentName('Owens quote.final.pdf') === 'Owens quote.final'`, `defaultDocumentName('.pdf') === 'Document'`; `parseDocumentBlobPath` round-trips `documentBlobPath` output and returns null for: a missing segment, an upper-case uuid, a non-uuid id, `foo/../x.pdf` as the file name, an `.html` file name, a file name that is not already safe, a trailing slash; `formatDocumentSize(500) === '1 KB'`, `formatDocumentSize(860160) === '840 KB'`, `formatDocumentSize(2516582) === '2.4 MB'`.
- [ ] **Step 2: Run `npx vitest run tests/unit/utils/project-documents.test.ts`**: expect FAIL (module missing).
- [ ] **Step 3: Add the constants, types and functions.**
- [ ] **Step 4: Run the test again**: expect PASS.
- [ ] **Step 5: Commit** `feat: shared rules for project documents`.

### Task 2: Schema, migration, Blob wrappers and the service

**Files:**
- Modify: `prisma/schema.prisma` (new `ProjectDocument`; `documents ProjectDocument[]` on `Project`; `projectDocuments ProjectDocument[] @relation("ProjectDocumentUploadedBy")` on `User`)
- Create: `prisma/migrations/20261112120000_add_project_documents/migration.sql`
- Modify: `server/utils/blob-storage.ts`
- Create: `server/services/ProjectDocumentService.ts`
- Test: `tests/unit/services/project-document-service.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces in `blob-storage.ts`:
  - `headPrivate(pathname: string): Promise<{ size: number; contentType: string } | null>`: null on `BlobNotFoundError`, other errors thrown.
  - `presignPrivateGet(pathname: string, ttlMs: number): Promise<string>`: `issueSignedToken({ pathname, operations: ['get'], validUntil })` then `presignUrl(..., { operation: 'get', access: 'private', validUntil })`.
  - `handlePresignedUpload(body: unknown, request: IncomingMessage, sign: (pathname: string) => Promise<{ contentType: string; maxBytes: number; ttlMs: number }>): Promise<unknown>`: throws `HttpError(400)` unless `body.type === 'blob.generate-presigned-url'`; calls `handleUploadPresigned` with `webhookPublicKey: 'unused'` and a `getSignedToken` that calls `sign(pathname)` (which throws to refuse) and issues a token for that exact pathname with `operations: ['put']`, `allowedContentTypes: [contentType]`, `maximumSizeInBytes: maxBytes`, plus `urlOptions` `{ addRandomSuffix: false, allowOverwrite: false, validUntil }`. Every Blob call passes `authOptions()`.
- Produces `ProjectDocumentService` with:
  - `authorizeUpload(householdId: string, projectId: string, pathname: string): Promise<{ contentType: string; maxBytes: number; ttlMs: number }>`: 404 "Project not found" for a missing or deleted project; 400 "Invalid document path" unless `parseDocumentBlobPath` matches this household and project; 409 "This project can hold 30 documents" at the cap; 409 "Document already exists" if a row has that id.
  - `register(householdId: string, projectId: string, userId: string, input: { id: string; blobPath: string; name: string; note: string | null }): Promise<ProjectDocumentDto>`
  - `link(householdId: string, projectId: string, documentId: string): Promise<{ url: string; expiresAt: string }>`
  - `update(householdId: string, projectId: string, documentId: string, input: { name?: string; note?: string | null }): Promise<ProjectDocumentDto>`
  - `remove(householdId: string, projectId: string, documentId: string): Promise<void>`
  - exported `documentSelect` and `documentOrder` (`{ createdAt: 'desc' }`) for the detail query.

- [ ] **Step 1: Write the failing service tests** (prisma and blob-storage mocked as in `project-photo-service.test.ts`):
  - `authorizeUpload`: 404 for a missing project with the `where` `{ id, householdId, metaStatus: 'active' }`; 400 for a path under another household, another project, or one `parseDocumentBlobPath` rejects; 409 with the cap message at 30 rows; 409 when the id already has a row; returns `{ contentType: 'application/pdf', maxBytes: 26214400, ttlMs: 600000 }` for a good `.pdf` path.
  - `register`: when a row with that id exists for this project, returns it and calls neither `headPrivate` nor `create`; 400 "Upload not found. Try again." when `headPrivate` returns null; deletes the blob and answers 400 "Only PDF, Word, Excel, JPEG or PNG files" when the headed type differs from the extension's type; deletes the blob and answers 413 "Over 25 MB" above the cap; 409 at the cap before create (blob deleted); creates with `name` trimmed, blank note stored as null, `contentType` and `sizeBytes` from the head, `fileName` from the path; when the post-insert count is 31, deletes the row and the blob and answers 409.
  - `link`: 404 for a document in another project or a deleted project; calls `presignPrivateGet(blobPath, 300000)` and returns `expiresAt` 5 minutes ahead.
  - `update`: 404 as above; trims the name, refuses a blank one (400 "Name can't be blank"), blank note to null.
  - `remove`: deletes the row then calls `removeBlobs([blobPath])`; a failing `removeBlobs` does not fail the call.
- [ ] **Step 2: Run** `npx vitest run tests/unit/services/project-document-service.test.ts`: expect FAIL.
- [ ] **Step 3: Add the model and write the migration by hand.** Model fields per the spec's Data table; `blobPath String @unique`; `@@index([projectId, createdAt])`; `@@map("project_documents")`. SQL: `CREATE TABLE "project_documents" (...)`, then `ALTER TABLE "project_documents" SET (schema_locked = false);`, then the unique index on `blobPath`, the `(projectId, createdAt)` index, and the two foreign keys (`projectId` → `projects` ON DELETE CASCADE, `uploadedById` → `users`). Match the column types of `20261009120000_add_chat_message_photos` and earlier migrations (`TEXT`, `INT4`, `TIMESTAMP(3)`). Run `npx prisma generate` (local only, no DB).
- [ ] **Step 4: Add the three Blob wrappers and the service.** Copy `ProjectPhotoService`'s structure: `requireProject`, `requireDocument` (`where: { id, projectId, project: { householdId, metaStatus: 'active' } }`), best-effort `cleanUp`, and the race re-count.
- [ ] **Step 5: Run the tests**: expect PASS.
- [ ] **Step 6: Commit** `feat: project documents model, migration (not applied) and service`.

### Task 3: Routes and the project detail

**Files:**
- Create: `server/api/projects/[id]/documents/upload.post.ts`, `server/api/projects/[id]/documents.post.ts`, `server/api/projects/[id]/documents/[documentId].patch.ts`, `server/api/projects/[id]/documents/[documentId].delete.ts`, `server/api/projects/[id]/documents/[documentId]/link.post.ts`
- Modify: `server/utils/project-schemas.ts` (`documentRegisterSchema`, `documentUpdateSchema`), `server/services/ProjectService.ts` (`detailInclude.documents`, `toDetail` adds `householdId` and `documents`)
- Test: `tests/unit/api/project-document-routes.test.ts`, and extend `tests/unit/services/project-service.test.ts` for the two new detail fields

**Interfaces:**
- Consumes: Task 2's service and `handlePresignedUpload`.
- Produces HTTP:
  - `POST /api/projects/:id/documents/upload`: body is the SDK's; answers the SDK's JSON. On a refusal answers the error's status with `{ message }` (the SDK only reads `ok`).
  - `POST /api/projects/:id/documents` `{ id: uuid, blobPath: string, name: 1..120 after trim, note?: string up to 200 | null }` → `ProjectDocumentDto`.
  - `PATCH /api/projects/:id/documents/:documentId` `{ name?, note? }` (at least one) → `ProjectDocumentDto`.
  - `DELETE /api/projects/:id/documents/:documentId` → 204.
  - `POST /api/projects/:id/documents/:documentId/link` → `{ url, expiresAt }`.
  - `GET /api/projects/:id` now includes `householdId` and `documents` (newest first). The list route is untouched.

- [ ] **Step 1: Write the failing route tests** in the style of `project-plan-routes.test.ts` (dev-bypass auth, service mocked, `readBody` mocked): each route answers 401 with no user and 403 for a user with no household; passes `householdId`, `projectId` and the body through; `documents.post` answers 400 for a non-uuid id, a blank name, a 121-character name and a 201-character note, without calling the service; `PATCH` answers 400 for an empty body; the upload route hands `authorizeUpload` the pathname from `body.payload.pathname` (mock `handlePresignedUpload` to call its `sign` argument) and answers 400 for a `blob.upload-completed` body. In `project-service.test.ts`: `get` returns `householdId` and `documents` in the selected shape.
- [ ] **Step 2: Run** `npx vitest run tests/unit/api/project-document-routes.test.ts tests/unit/services/project-service.test.ts`: expect FAIL.
- [ ] **Step 3: Implement the schemas, routes and detail change.** The upload route reads the body with `readBody` and passes `event.node.req` as the request.
- [ ] **Step 4: Run the tests, then the full suite** `npm run test`: expect PASS (the five notification tests that fail after 20:00 US Eastern are pre-existing and date-dependent).
- [ ] **Step 5: Commit** `feat: project document routes`.

### Task 4: The Documents section

**Files:**
- Modify: `composables/useProjects.ts`
- Create: `components/projects/ProjectDocuments.vue`
- Modify: `pages/projects/[id].vue` (render `<ProjectDocuments>` after the Photos section, before the danger zone; keep `project.documents` in sync from its `update:documents` event)

**Interfaces:**
- Consumes: Task 1 helpers and types; Task 3 routes.
- Produces in `useProjects`:
  - `uploadDocumentFile(path: string, file: File, onProgress: (percent: number) => void): Promise<void>`: `uploadPresigned(path, file, { access: 'private', handleUploadUrl: '/api/projects/:id/documents/upload', headers, contentType: DOCUMENT_TYPES[ext], onUploadProgress })`. `headers` carries `Authorization: Bearer <token>` from the auth store when there is one (the dev bypass rides on its cookie).
  - `registerDocument(projectId: string, input: { id: string; blobPath: string; name: string; note: string | null }): Promise<ProjectDocumentDto>`
  - `getDocumentLink(projectId: string, documentId: string): Promise<{ url: string; expiresAt: string }>`
  - `updateDocument(projectId: string, documentId: string, input: { name?: string; note?: string | null }): Promise<ProjectDocumentDto>`
  - `deleteDocument(projectId: string, documentId: string): Promise<void>`
- Produces the component: props `projectId: string`, `householdId: string`, `documents: ProjectDocumentDto[]`; emits `update:documents` with the new array after every add, edit and remove.

Behaviour, all from the spec:
- Queue items: `{ key, file, id (crypto.randomUUID()), path, name, state: 'waiting' | 'uploading' | 'saving' | 'failed', percent, error, uploaded: boolean }`. One at a time, in pick order. Upload sets `uploaded = true` on success, then registers. Retry: if `uploaded` or the failure came from the upload step, register first; only a register error whose message is "Upload not found. Try again." leads to a fresh `uploadDocumentFile` to the same path, then register. A done item leaves the queue and its document is prepended to the list. × removes a waiting or failed item.
- Client checks before queueing, with the spec's copy: an unknown type, over 25 MB, and room (`MAX_PROJECT_DOCUMENTS - documents.length - queued`). A drop on a computer runs the same checks. Copy the photo uploader's drag-depth handling into this component (extraction to a composable is not worth it for two users).
- Rows: lucide `FileText` (pdf, docx), `FileSpreadsheet` (xlsx), `Image` (jpg, jpeg, png); the name as a button that opens the file; the note beneath; `formatDocumentSize(sizeBytes) · <short date>` muted; **Edit** and **Remove** as visible buttons. Edit shows name and note inputs that save on blur or Enter; a blank name restores the old name and shows "Name can't be blank"; Escape cancels.
- Open: `const tab = window.open('', '_blank')` synchronously in the click; then `getDocumentLink`; on success `tab ? (tab.location.href = url) : (window.location.href = url)`; on failure `tab?.close()` and the row shows "Could not open. Try again.".
- At the cap the Add button is disabled and the line "This project has 30 documents" shows.
- File input: `multiple`, `accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"`, reset after each pick.

- [ ] **Step 1: Add the composable functions and the component, and wire the page.**
- [ ] **Step 2: Run** `npx nuxi typecheck 2>&1 | grep -E "ProjectDocuments|project-documents|useProjects|\[id\]\.vue|ProjectDocument"`: expect no lines (the 65 known errors are elsewhere).
- [ ] **Step 3: Run** `npm run build`: expect success, and confirm `@vercel/blob/client` resolves in the client bundle.
- [ ] **Step 4: jsdom harness** (outside the repo, in the session scratchpad, compiled against the repo's Vue as the 2026-10 reviewers did): mount `ProjectDocuments` with the composable mocked, and check pick → upload → register → row prepended; the type, size and room refusals with exact copy; upload failure then Retry re-uploads only after "Upload not found. Try again."; a register failure Retry does not re-upload; open with `window.open` returning a tab and returning null; open failure closes the tab; edit save, blank-name refusal and Escape; remove confirm cancel and accept; the cap state.
- [ ] **Step 5: Commit** `feat: Documents section on the project page`.

### Task 5: Docs, review, then David's gates

- [ ] **Step 1: Run the `update-docs` skill**: `docs/functionality/projects.md` (Documents subsection, privacy, limitations, Where It Appears), `docs/functionality/changelog.md`, `docs/tech/architecture.md` (Blob holds documents; the presigned upload and link flows; the `'unused'` webhook key), `docs/tech/api-endpoints.md`, `docs/next-up.md` (the spec's Later list), CLAUDE.md data model line 9 (**ProjectDocument**). Commit `docs: project documents`.
- [ ] **Step 2: Whole-branch review** by one fresh Opus reviewer given the spec, this plan and `git diff main...feat/project-documents`. Fix what it confirms; commit.
- [ ] **Step 3: Stop and ask David** for the migration. On his go: `npx prisma migrate deploy`. Recovery if it fails partway: `DROP TABLE IF EXISTS "project_documents";` then `npx prisma migrate resolve --rolled-back 20261112120000_add_project_documents`, fix, re-deploy.
- [ ] **Step 4: Real browser against local dev** (shared Chrome on `127.0.0.1:9222`, dev bypass): make a throwaway project, upload a PDF over 4.5 MB, a PNG and a DOCX, open each, edit, remove, refuse an `.html`; then delete the throwaway project's documents and the project. This writes to production storage and data.
- [ ] **Step 5: On David's go, merge** (fast-forward `main`), **then on his go, push**. Watch the Vercel deploy.
- [ ] **Step 6: In production** (Chrome), upload the four briefs to their projects, each with the note "Contractor brief"; this is the first OIDC run of token issue and presigned GET. If it fails, read the function log (see the spec's credential note).
- [ ] **Step 7: Add a note to Slate issue SL-238** with the `/projects` skill saying the four briefs are on their projects.

## Phone and desktop test steps

Written into the final report after the build, from the shipped code (exact copy and expected results per step).
