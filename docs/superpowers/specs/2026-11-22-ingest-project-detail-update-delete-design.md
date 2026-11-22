# Ingest: project detail, update and delete (design)

Slice `ingest-project` of the initiative in [docs/plans/2026-11-22-ingest-manage-existing-projects.md](../../plans/2026-11-22-ingest-manage-existing-projects.md) (Slices 1 and 2). A script holding the household API key can read one project in full, change its fields, append to its notes, and soft-delete it.

## Routes

All three use `defineApiKeyProtectedEventHandler` and `toHttpError`, like `server/api/ingest/projects/[id]/documents.post.ts`. The files sit next to the existing `server/api/ingest/projects/[id]/` folder, the same layout the browser routes use (`server/api/projects/[id].get.ts` beside `server/api/projects/[id]/`).

| Route | File | Calls |
|---|---|---|
| `GET /api/ingest/projects/:id` | `server/api/ingest/projects/[id].get.ts` | `ProjectIngestService.getDetail` |
| `PATCH /api/ingest/projects/:id` | `server/api/ingest/projects/[id].patch.ts` | `ProjectIngestService.update` |
| `DELETE /api/ingest/projects/:id` | `server/api/ingest/projects/[id].delete.ts` | `ProjectIngestService.remove` |

A project in another household, or a deleted one, answers 404 (`ProjectService.requireProject` already does this). Writes call `ApiKeyService.requireOwnerInHousehold` first and answer 403 when the key's owner has left the household. The read does not: a read attributes nothing, and `GET /api/ingest/projects` does not check either.

## Response: `IngestProjectDetail`

GET and PATCH both return this. It is built from `ProjectService.get` / `ProjectService.update` (so ordering, the visible-provider filter and the 404 rules stay in one place), plus one small read for the two timestamps `ProjectDetail` does not carry (`updatedAt` and each photo's `createdAt`). `ProjectService`, `ProjectDetail` and `ProjectPhotoDto` are unchanged, so the browser response and the project page are untouched.

```ts
interface IngestProjectDetail {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  notes: string | null;
  completedAt: Date | string | null;
  providerCategoryId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  steps: { id: string; text: string; done: boolean; doneAt: Date | string | null; estimateMinutes: number | null; position: number }[]; // in checklist order
  documents: { id: string; name: string; note: string | null; fileName: string; contentType: string; sizeBytes: number; createdAt: Date | string }[]; // newest first
  photos: { id: string; position: number; width: number; height: number; createdAt: Date | string }[]; // cover (lowest position) first
  providers: { id: string; name: string; status: ProjectProviderStatus }[]; // id is the provider's id; status is the link's status
}
```

Differences from the browser `ProjectDetail`, on purpose: no `householdId` (the key fixes it), steps gain `done` next to `doneAt` (so a step is a superset of `ProjectStepDto`, which the steps slice returns), providers are flattened to `{ id, name, status }` (no phone or neighbor count), and nothing is a signed URL (the browser detail has none either).

## PATCH body

```json
{ "title": "...", "location": "...", "notes": "...", "notesAppend": "...", "status": "active", "path": "diy" }
```

- All fields optional; at least one is required (`{}` answers 400 "Nothing to update"). Unknown fields answer 400 (`.strict()`), so a typo such as `note` or `notes_append` fails loudly instead of doing nothing. `providerCategoryId` is not accepted (provider links are out of scope for the API).
- `title`, `location`, `notes`, `status`, `path` reuse `projectUpdateSchema`'s field rules (trim, blank location or notes clears them, 200/100/5000 limits, enum messages). Status and the Done/`completedAt` rule run in `ProjectService.update`, unchanged: moving to Done stamps `completedAt`, staying Done keeps it, leaving Done clears it.
- `notesAppend`: a non-blank string (trimmed). The service appends it to the current notes after a blank line, or sets it as the notes when they are empty. If the result would exceed 5000 characters it answers 400 and writes nothing. `notes` and `notesAppend` together answer 400.
- **Append is retry-safe.** If the notes already end with exactly that paragraph, nothing is appended. A retried PATCH after a lost response therefore does not double the text. The cost is that the same paragraph cannot be appended twice in a row on purpose.
- **Append does not lose a concurrent write.** The new notes are written with a compare-and-swap on the notes value read (`updateMany where { id, notes: <what was read> }`); if another write changed the notes in between, it re-reads and tries again (up to 3 times, then 409 "The notes changed while appending. Try again."). `updateMany` is scoped to household and active so a project deleted in between does not get written.
- When `notesAppend` comes with other fields, the notes are written first and the other fields then go through `ProjectService.update`. The two writes are not one transaction; every field is validated before either runs, so the only way the second can fail after the first is the project being deleted in between or a database error.

## DELETE

`ProjectService.softDelete`, returns `{ success: true }` like the browser route. Repeating it answers 404, which a retrying client can treat as success.

## Retry safety (for the doc)

- GET: read-only.
- PATCH: safe to repeat. Setting fields is idempotent; `notesAppend` skips a paragraph that is already the last one.
- DELETE: the first call answers `{ success: true }`, a repeat answers 404; treat 404 on a retry as done.

## Tests

- `tests/unit/api/ingest-project-routes.test.ts`: 401 for a missing or unknown key on all three routes (service not called); passes household, user and id through; route-level 400s (empty body, unknown field, bad status/path, notes and notesAppend together, blank notesAppend, too-long fields); service errors (403, 404, 409) pass through; DELETE returns `{ success: true }`.
- `tests/unit/services/project-ingest-service.test.ts` (new `describe` blocks): detail mapping (done flag, flattened providers, photo createdAt, updatedAt, no householdId); 404 from `ProjectService` passes through; owner check before any write on update and remove (403 and nothing written); update passes fields to `ProjectService.update` and maps the result; Done/`completedAt` behaviour through the real `ProjectService` with Prisma mocked; append to empty notes, to existing notes after a blank line, the 5000 limit (400, nothing written), the repeat skip, the compare-and-swap retry and the 409 after 3 misses.

## Shared files touched (additive)

- `server/utils/project-schemas.ts`: `ingestProjectUpdateSchema` (new export).
- `types/project.ts`: `IngestProjectDetail` and its item types, `IngestProjectUpdateInput` (new exports).
- Docs: a new "Project detail, update and delete" section in `docs/tech/project-task-ingest.md`, rows in `docs/tech/api-endpoints.md`, one changelog entry.
