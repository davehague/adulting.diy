# Project File Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution: native (claude builds every task in this session; one fresh reviewer on the whole branch at the end), as for the Documents slice.

**Goal:** Let a script with the household API key list projects, attach a document of up to 25 MB (upload URL → PUT → register) and attach a photo (one multipart call).

**Architecture:** A new `ProjectFileIngestService` does the owner check and the ingest-only steps (server-made path and presigned PUT URL; finding the uploaded file by document id) and hands every rule to `ProjectDocumentService` and `ProjectPhotoService`. Two new Blob wrappers live in `server/utils/blob-storage.ts`. Four routes under `server/api/ingest/`.

**Tech Stack:** Nuxt 3 / Nitro, Prisma, `@vercel/blob` 2.8.0 (`issueSignedToken`, `presignUrl`, `list`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-project-file-ingest-design.md`

## Global Constraints

- Auth: `defineApiKeyProtectedEventHandler`; every write calls `ApiKeyService.requireOwnerInHousehold` first (403 "The API key owner is no longer a member of this household"). The list route does not.
- Upload URL: one path, that extension's type only, 25 MB, valid 10 minutes, no overwrite, no random suffix. Response `{ documentId, fileName, uploadUrl, method: "PUT", headers: { "x-api-version": "12" }, maxBytes: 26214400, expiresAt }`.
- `x-api-version` value comes from one constant `BLOB_API_VERSION` in `blob-storage.ts`, mirroring the SDK's `BLOB_API_VERSION`.
- Register body `{ documentId, name?, note? }`: `documentId` lower-case uuid (400), project checked first (404), file found by Blob prefix `households/{h}/projects/{p}/documents/{documentId}/` (none or more than one → 400 "Upload not found. Try again."), default name = stored file name without extension with `-`/`_` runs as spaces.
- Name 1 to 120 after trimming, note up to 200, blank note → null.
- Photo route: multipart `full`, `thumb`, `width`, `height`, same as the browser route; parsing shared, not copied.
- List: `{ projects: [{ id, title, location, status, path, createdAt }] }`, not deleted, all statuses, newest first.
- No migration; no change to any `*-prompts.ts`.

## Review Focus

1. A register for a document id whose file sits under another project or household: the prefix is built from the key's household and the URL's project, so it finds nothing (400) and touches nothing else.
2. A `fileName` with path pieces or an unknown extension (`../../x.pdf`, `quote.html`, `noext`): 400 or a safe name; never a path outside the project's documents prefix.
3. A key whose owner left: every write refused before any Blob call.
4. The SDK is bumped and its API version changes: a unit test reads the installed SDK and fails if `BLOB_API_VERSION` in `blob-storage.ts` no longer matches.
5. Register retried after success: the existing document comes back, nothing is written twice.

---

### Task 1: Blob wrappers, display-name helper and the ingest service

**Files:**
- Modify: `server/utils/blob-storage.ts`, `utils/project-documents.ts`
- Create: `server/services/ProjectFileIngestService.ts`
- Test: `tests/unit/services/project-file-ingest-service.test.ts`, extend `tests/unit/utils/project-documents.test.ts`, create `tests/unit/utils/blob-api-version.test.ts`

**Interfaces:**
- Produces in `blob-storage.ts`:
  - `export const BLOB_API_VERSION = '12'`
  - `presignPrivatePut(pathname: string, grant: UploadGrant): Promise<{ url: string; headers: Record<string, string>; expiresAt: string }>`: `issueSignedToken` (`operations: ['put']`, `allowedContentTypes: [grant.contentType]`, `maximumSizeInBytes: grant.maxBytes`, `validUntil = now + grant.ttlMs`) then `presignUrl(token, { operation: 'put', pathname, access: 'private', validUntil, allowedContentTypes, maximumSizeInBytes, addRandomSuffix: false, allowOverwrite: false })`; headers `{ 'x-api-version': BLOB_API_VERSION }`.
  - `findPrivateBlob(prefix: string): Promise<string | null>`: `list({ prefix, limit: 2 })`; the pathname when exactly one blob, else null.
- Produces in `utils/project-documents.ts`: `displayNameFromStoredFile(fileName: string): string`.
- Produces `ProjectFileIngestService`:
  - `listProjects(householdId: string): Promise<IngestProjectSummary[]>` (type in `types/project.ts`: `{ id, title, location, status, path, createdAt }`)
  - `documentUploadUrl(householdId: string, userId: string, projectId: string, fileName: string): Promise<DocumentUploadUrl>` (type in `types/project.ts`, the Global Constraints response shape)
  - `registerDocument(householdId: string, userId: string, projectId: string, input: { documentId: string; name?: string; note?: string | null }): Promise<ProjectDocumentDto>`
  - `addPhoto(householdId: string, userId: string, projectId: string, upload: PhotoUpload): Promise<ProjectPhotoDto>`

- [ ] **Step 1: Write the failing tests.**
  - `displayNameFromStoredFile`: `'Owens-quote.pdf'` → `'Owens quote'`; `'back_porch--brief.v2.pdf'` → `'back porch brief.v2'`; `'.pdf'` → `'Document'`; a 200-character base → 120 characters.
  - `blob-api-version.test.ts`: read every `.js` file in `node_modules/@vercel/blob/dist/`, find `BLOB_API_VERSION = (\d+)`, expect it to equal `BLOB_API_VERSION` from `blob-storage.ts` (mock nothing; import only the constant: put it before any SDK import side effects, or read the constant from the file text if importing the module pulls the SDK).
  - Service (prisma, `ApiKeyService`, `blob-storage`, `ProjectDocumentService`, `ProjectPhotoService` mocked):
    - `listProjects` queries `{ householdId, metaStatus: 'active' }`, `orderBy: { createdAt: 'desc' }`, selects exactly the six fields, and does not call the owner check.
    - `documentUploadUrl`: owner check first (a 403 from it means no other call); `'quote.html'` and `'noext'` → 400 "Only PDF, Word, Excel, JPEG or PNG files" with no Blob call; `'../../Owens quote.PDF'` builds `households/H/projects/P/documents/<uuid>/Owens-quote.pdf` (assert the `authorizeUpload` path matches `parseDocumentBlobPath` with this household and project, and `fileName` is `Owens-quote.pdf`); passes the grant from `authorizeUpload` to `presignPrivatePut`; returns the Global Constraints shape with `method: 'PUT'` and `maxBytes: 26214400`; a 404 or 409 from `authorizeUpload` passes through and no URL is made.
    - `registerDocument`: owner check first; `documentId: 'NOT-A-UUID'` and an upper-case uuid → 400 with no Blob call; missing project → 404 with no Blob call; `findPrivateBlob` called with `households/H/projects/P/documents/D/`; null → 400 "Upload not found. Try again." and `register` not called; found → `register(H, P, U, { id: D, blobPath, name: 'Owens quote', note: null })` when no name is given; a given name is trimmed and passed; a note is passed through.
    - `addPhoto`: owner check first, then `ProjectPhotoService.add(H, P, U, upload)` and its result returned.
- [ ] **Step 2: Run** `npx vitest run tests/unit/services/project-file-ingest-service.test.ts tests/unit/utils/project-documents.test.ts tests/unit/utils/blob-api-version.test.ts`: expect FAIL (missing modules and exports).
- [ ] **Step 3: Implement** the wrappers, the helper, the two types and the service. The project check in `registerDocument` is the same query as `ProjectDocumentService.requireProject` (`{ id, householdId, metaStatus: 'active' }`, 404 "Project not found").
- [ ] **Step 4: Run the tests**: expect PASS.
- [ ] **Step 5: Commit** `feat: project file ingest service and Blob helpers`.

### Task 2: Routes and the shared photo form reader

**Files:**
- Create: `server/utils/photo-upload.ts` (`readPhotoUpload(event: H3Event): Promise<PhotoUpload>`, moved from `server/api/projects/[id]/photos.post.ts` with the same 400 messages)
- Modify: `server/api/projects/[id]/photos.post.ts` (use it), `server/utils/project-schemas.ts` (`ingestUploadUrlSchema` `{ fileName: 1..255 }`, `ingestDocumentRegisterSchema` `{ documentId: string, name?: trimmed 1..120, note?: up to 200 | null }`)
- Create: `server/api/ingest/projects.get.ts`, `server/api/ingest/projects/[id]/documents/upload-url.post.ts`, `server/api/ingest/projects/[id]/documents.post.ts`, `server/api/ingest/projects/[id]/photos.post.ts`
- Test: `tests/unit/api/ingest-file-routes.test.ts`

**Interfaces:**
- Consumes: Task 1's service.
- Produces the HTTP routes in the spec.

- [ ] **Step 1: Write the failing route tests.** Mock `ApiKeyService` (`authenticate` returns `{ householdId: 'h1', apiKeyId: 'k1', userId: 'u1' }` for `Bearer adk_good`, null otherwise), the ingest service, and `h3`'s `readBody` / `readMultipartFormData`. Assert: each route answers 401 with no header and with a bad key; the list returns `{ projects }` from the service; upload-url passes `('h1', 'u1', 'p1', 'Owens quote.pdf')` and answers 400 for a missing or empty or 256-character `fileName` without calling the service; register passes `('h1', 'u1', 'p1', { documentId, name: 'Owens quote', note: null })` from `{ documentId, name: ' Owens quote ' }` and answers 400 for a missing `documentId`, a blank `name`, a 121-character name and a 201-character note; photos passes the parsed upload and answers 400 "Both the photo and its thumbnail are required" without `thumb`; service errors (403, 404, 409) pass through with their status.
- [ ] **Step 2: Run** `npx vitest run tests/unit/api/ingest-file-routes.test.ts`: expect FAIL.
- [ ] **Step 3: Implement** the helper, schemas and routes; switch the browser photo route to the helper.
- [ ] **Step 4: Run** the new tests, then `npm run test` (the five notification tests that fail after 20:00 US Eastern are pre-existing and date-dependent): expect PASS.
- [ ] **Step 5: Commit** `feat: ingest routes for project documents and photos`.

### Task 3: Real run, docs, review, David's gates

- [ ] **Step 1: Real run against local dev** (`npm run dev`; local dev shares production data and storage): create a test API key for the household as an admin through the app's existing key route with the dev bypass, then with curl: list projects; make a throwaway project with `POST /api/ingest/projects`; upload-url for a 6 MB PDF, `curl -X PUT` with the returned headers, register without a name; confirm `head` shows `inline` and the name "…"; register again (same document back); a Pillow-made full + thumb photo; refusals: `.html` file name, a register with a random uuid (400), a bad key (401). Then remove the document and photo, delete the throwaway project, and revoke the key. Record what ran in the ledger.
- [ ] **Step 2: `update-docs`**: `docs/tech/project-task-ingest.md` (the four routes with curl and a Pillow snippet, the photo retry note), `docs/tech/api-endpoints.md`, `docs/tech/architecture.md` (the ingest path into Blob), `docs/functionality/projects.md` (drop the "not by a script" limitation), `docs/functionality/changelog.md`, `docs/next-up.md` (remove the API-key line from "Documents, next levels"). Commit `docs: project file ingest`.
- [ ] **Step 3: Whole-branch review** by one fresh Opus reviewer with the spec, this plan, the ledger and the Review Focus. Fix Critical and Important with a failing test first; ledger minors.
- [ ] **Step 4: Stop and ask David** for the merge, then the push. No migration.
