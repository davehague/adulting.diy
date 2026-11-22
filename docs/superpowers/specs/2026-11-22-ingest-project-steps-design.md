# Ingest: steps on an existing project (design)

Slice `ingest-steps` of the initiative in [docs/plans/2026-11-22-ingest-manage-existing-projects.md](../../plans/2026-11-22-ingest-manage-existing-projects.md) (Slice 3). A script holding the household API key can add checklist steps to a project that already exists, edit or check them off, and delete them.

## Routes

All three use `defineApiKeyProtectedEventHandler` and `toHttpError`, like `server/api/ingest/projects/[id]/documents.post.ts`, and call a new `ProjectStepIngestService` (`server/services/ProjectStepIngestService.ts`), which holds the ingest-only glue (owner check, dedupe, envelope, DTO mapping) and delegates every rule to `ProjectStepService`.

| Route | File | Calls |
|---|---|---|
| `POST /api/ingest/projects/:id/steps` | `server/api/ingest/projects/[id]/steps.post.ts` | `ProjectStepIngestService.addBatch` |
| `PATCH /api/ingest/projects/:id/steps/:stepId` | `server/api/ingest/projects/[id]/steps/[stepId].patch.ts` | `ProjectStepIngestService.update` |
| `DELETE /api/ingest/projects/:id/steps/:stepId` | `server/api/ingest/projects/[id]/steps/[stepId].delete.ts` | `ProjectStepIngestService.remove` |

Every route calls `ApiKeyService.requireOwnerInHousehold` first (403 when the key's owner has left the household, nothing written). A project in another household, a deleted project, or a step that is not on that project answers 404 (`ProjectStepService`'s existing `requireProject` / `requireStep`).

## POST: add a batch of steps

Body: `{ "steps": [{ "text": "...", "estimateMinutes": 30 }] }`, 1–100 items. The envelope is checked at the route (`{ steps: [...] }` with 1–100 items, otherwise 400 with one message); each item is then validated on its own with the existing `stepCreateSchema` (text trimmed, 1–200 characters; `estimateMinutes` a whole number 1–9999, optional, `null` allowed), so one bad item never fails the batch. HTTP 200 whenever the envelope is valid.

Response, matching `POST /api/ingest/projects` with `title` → `text`:

```json
{
  "created": [{ "index": 0, "id": "<step uuid>", "text": "Call the utility" }],
  "skipped": [{ "index": 1, "id": "<existing step uuid>", "text": "Pull a permit", "reason": "An undone step with this text already exists" }],
  "errors":  [{ "index": 2, "text": "", "message": "Step text is required" }]
}
```

Rules, applied to items in the order given:

1. **Invalid item** → `errors` with the schema's first message; `text` is the raw text when it was a string, otherwise `""`.
2. **Duplicate of an undone step** → `skipped`, with the existing step's id. Match is case-insensitive and ignores surrounding whitespace (the same `trim().toLowerCase()` key `ProjectIngestService` uses for titles). Done steps do not count, so "Clean the gutters" can be added again after the last one was checked off.
3. **Repeat within the batch** → `skipped` with the id of the step its first occurrence created, reason "Repeats an earlier step in this batch".
4. **Over the cap** → `errors`, message "This project already has 100 steps". Errors rather than skipped because nothing was saved and `skipped` promises an id the caller can rely on. Skipped and invalid items do not use up room, so a retried batch on a project with 99 steps still skips its 99 and adds the one that fits. A repeat (rule 3) of an item that hit the cap gets the same error.
5. Otherwise → `created`, appended after the project's highest position in the order given (the same position rule as the browser's single add and "Add all from DIY plan").

Checking order: owner (403) → project (404) → items. Steps are added with one `createMany` (atomic for the items that fit).

### Service changes

`ProjectStepService.addMany` (used by the browser's "Add all from DIY plan") does not dedupe and keeps exactly its current behavior and response. To keep the cap and position rule in one place, its body moves into a new public method that both use:

```ts
// Appends steps after the last one, in the order given, up to MAX_PROJECT_STEPS. Returns the created steps (input order) and how many did not fit.
async append(householdId, userId, projectId, inputs): Promise<{ created: ProjectStepDto[]; overflow: number }>
```

It pre-generates each step's id with `crypto.randomUUID()` (the column is a UUID with a default, so supplying one needs no schema change) so `createMany` can report what it created without a second read. `addMany` becomes `append` + the existing re-read of all steps, returning `{ steps, skipped: overflow }` as today.

A second new method, `list(householdId, projectId): Promise<ProjectStepDto[]>`, returns a project's steps in checklist order after the same 404 check; the ingest service reads it to build the dedupe map.

Race: two batches sent at the same moment to the same project can both add the same text, or together go slightly over 100. The browser's `addMany` has the same race; it is documented, not locked.

## PATCH: edit or check off one step

Body: any of `text` (trimmed, 1–200), `estimateMinutes` (1–9999, `null` clears), `done` (`true`/`false`). `ingestStepUpdateSchema` = `stepUpdateSchema` fields, `.strict()` (unknown field → 400, so `estimate` or `completed` fails loudly), `{}` or a non-object body → 400 "Nothing to update", the same convention as the ingest project PATCH. Goes through `ProjectStepService.update`, so checking an already-done step keeps the first `doneAt`, and `done: false` clears it.

Returns the step as `IngestProjectStepDto` (`toIngestStep`): `{ id, text, done, doneAt, estimateMinutes, position }`.

Checking off the last undone step does **not** mark the project Done (the app asks the person; over the API the caller sends `PATCH /api/ingest/projects/:id` with `status: "done"` itself).

## DELETE: remove one step

`ProjectStepService.remove`; returns `{ success: true }` like the browser route. Repeating it answers 404, which a retrying client treats as done.

## Retry safety (for the doc)

- POST: safe to repeat. A retried batch skips every step it already added (and reports their ids), as long as they are still undone.
- PATCH: safe to repeat; fields are set, and `done: true` keeps the first `doneAt`.
- DELETE: first call `{ success: true }`, a repeat 404; treat 404 on a retry as done.

## Tests

- `tests/unit/api/ingest-step-routes.test.ts`: 401 for a missing or unknown key on all three routes (service not called); household, user, project and step ids passed through; POST envelope 400s (missing `steps`, empty, 101 items, not an array); PATCH 400s (`{}`, unknown field, blank text, bad estimate, non-boolean done); service errors (403, 404) pass through; DELETE returns `{ success: true }`.
- `tests/unit/services/project-step-ingest-service.test.ts` (Prisma mocked, real `ProjectStepService`): owner check before anything (403, nothing read or written); 404 for an unknown project; happy path with positions after the highest existing one; skip an existing undone step ignoring case and spaces; a done step does not block; within-batch repeat skipped with the first one's id; per-item validation errors alongside created items; cap: errors for the items that don't fit, skips don't use room; PATCH done/undone keeps the first `doneAt` and returns the ingest DTO; PATCH never touches the project; DELETE repeat 404.
- `tests/unit/services/project-step-service.test.ts`: existing `addMany` tests stay green unchanged; add `append` and `list` cases.

## Shared files touched (additive)

- `server/utils/project-schemas.ts`: `ingestStepBatchSchema`, `ingestStepUpdateSchema` (new exports).
- `types/project.ts`: `IngestStepBatchResult` (new export). The DTO contract types are not changed.
- Docs: a new "Steps on an existing project" section in `docs/tech/project-task-ingest.md`, rows in `docs/tech/api-endpoints.md`, one changelog entry.
