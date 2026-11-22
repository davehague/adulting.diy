# Ingest API: Manage Existing Projects — Initiative Plan

> **For Claude:** run this as an orchestrator initiative (`/orchestrator`). The orchestrator decomposes, briefs one worker per slice in its own worktree, and owns every merge. Workers follow: brainstorm → spec → build (subagent-driven) → verification → `update-docs`. Run `feature-impact-analysis` against `docs/functionality/` before slicing.

**Goal:** a machine client holding a household API key (`adk_...`) can finish a real project end to end: read what is on a project, edit its fields, manage its checklist steps, and rename, replace or remove its documents and photos, without anyone opening the app to clean up.

**Architecture:** new ingest routes under `server/api/ingest/projects/[id]/...` that mirror browser routes which already exist, calling the same services. Ingest-only glue (API-key auth, attribution, envelopes) stays in the ingest layer, the way `ProjectFileIngestService` already does it for documents. No new product behavior.

**Tech stack:** Nuxt 3 server routes (Nitro), Prisma on CockroachDB, Vercel Blob (private store), Zod, Vitest.

---

## Background: what a real client hit (Nov 2026)

An agent session filed a home project's research into an existing project using only the ingest API in [docs/tech/project-task-ingest.md](../tech/project-task-ingest.md): it attached 17 documents (PDFs, a Word file, PNG diagrams) and 7 photos through the existing upload-url → PUT → register flow and the photo route. As the research evolved it produced revised versions of the brief, case file and diagram. It then got stuck on five gaps:

| # | Gap | What it forced | Browser route that already does it | Service |
|---|---|---|---|---|
| 1 | No project detail read. `GET /api/ingest/projects` returns only id, title, location, status, path | The client could not see existing notes, steps, documents or photos, so it could not avoid duplicates or verify its own writes | `server/api/projects/[id].get.ts` | `ProjectService.get` |
| 2 | No project update or delete | Notes, status and path could not be set on an existing project; steps only exist on create | `[id].put.ts`, `[id].delete.ts` | `ProjectService.update`, `ProjectService.softDelete` |
| 3 | No steps on an existing project | A 7-step checklist had to be pasted into the app by hand | `steps.post.ts`, `steps/batch.post.ts`, `steps/[stepId].put.ts`, `steps/[stepId].delete.ts` | `ProjectStepService.add`, `addMany`, `update`, remove |
| 4 | No document rename, re-note or delete | Revised files were uploaded as "v2" next to stale v1s; five superseded documents are stuck until someone deletes them in the app | `documents/[documentId].patch.ts`, `documents/[documentId].delete.ts` | `ProjectDocumentService.update`, `remove` |
| 5 | Photos can't be deleted or reordered, and retries duplicate | A stale diagram is the project cover; a retried POST after a lost response would add a second copy | `photos/[photoId].delete.ts` | `ProjectPhotoService.remove`; `position` (lowest = cover) |

## Rules for every slice

1. **Auth and scope** exactly as today's ingest routes: `Authorization: Bearer adk_...` scopes to the key's household; writes are attributed to the key's owner and refused with 403 if that person has left the household (`ApiKeyService.requireOwnerInHousehold`); a project in another household, or a deleted one, answers 404.
2. **Reuse services and schemas** (`ProjectService`, `ProjectStepService`, `ProjectDocumentService`, `ProjectPhotoService`, `server/utils/project-schemas.ts`). Do not fork business rules (caps, Done/`completedAt`, blank-name rules, Blob cleanup) into ingest code.
3. **Retry safety is part of the contract.** Every write is either safe to repeat or documented as not. Prefer a caller-supplied id over match-by-content where content can legitimately repeat.
4. **Docs are the contract.** Update [project-task-ingest.md](../tech/project-task-ingest.md) in its existing style (curl/python examples calling `https://www.adulting.diy`, errors and retry safety per route), [api-endpoints.md](../tech/api-endpoints.md), and [changelog.md](../functionality/changelog.md).
5. **Tests for every route** per [testing.md](../tech/testing.md). No real Blob, database-of-record or AI calls in tests.

## Initiative status (orchestrator keeps this current)

- **Orchestrator session:** `shed-planning-adulting`. Workers report to it with SendMessage (START / DECISION / COMPLETION).
- **Integration branch:** `feature/ingest-projects`, cut from `main` at `2b56be0`; integration worktree `~/source/adulting.diy-worktrees/integration`. Slices merge here in order; it merges to `main` once, after a combined test pass and the owner's approval.
- **Slices (run in parallel, all based on `feature/ingest-projects`):**

  | Slice / session name | Worktree | Branch | Scope (sections below) | Status |
  |---|---|---|---|---|
  | `ingest-project` (worker session: `api-gaps`) | `~/source/adulting.diy-worktrees/ingest-project` | `slice/ingest-project` | Slice 1 (read) + Slice 2 (update, notesAppend, delete) | briefed 22 Nov |
  | `ingest-steps` | `~/source/adulting.diy-worktrees/ingest-steps` | `slice/ingest-steps` | Slice 3 | not started |
  | `ingest-files` | `~/source/adulting.diy-worktrees/ingest-files` | `slice/ingest-files` | Slice 4 + Slice 5 | not started |
  | follow-up (first free worker) | integration branch | `slice/ingest-docs` | Slice 6, after the three merge | not started |

- **Shared files every slice touches (additive; orchestrator resolves keep-both at merge):** `server/utils/project-schemas.ts`, `types/project.ts`, `docs/tech/project-task-ingest.md`, `docs/tech/api-endpoints.md`, `docs/functionality/changelog.md`. Each slice adds its own section; none rewrites another's.
- **Conventions (decided):** single-resource routes return the same DTO and status code the matching browser route returns; batch routes use the `created / skipped / errors` envelope; DELETE mirrors the browser route's response; every ingest write calls `ApiKeyService.requireOwnerInHousehold` first; route handlers use `defineApiKeyProtectedEventHandler` and `toHttpError`, like `server/api/ingest/projects/[id]/documents.post.ts`.
- **Hard limits for workers:** no `prisma migrate` / `db push`; no dev server or script that writes to the hosted database or Blob store; no calls to production; no `git push` (a pushed branch can trigger a Vercel preview wired to shared data). Tests mock Prisma and Blob (`tests/setup.ts`), so the full suite is safe to run in any worktree.
- **Decisions log:**
  - 22 Nov: session `api-gaps` (anchored to the main checkout) works slice `ingest-project` via absolute worktree paths; it must never write in the main checkout.

## Slices

### Slice 1: Read — `GET /api/ingest/projects/[id]`
Return the project with `notes`, `providerCategoryId`, `steps` (id, text, done, estimateMinutes, position), `documents` (id, name, note, contentType, sizeBytes, createdAt), `photos` (id, position, width, height, createdAt) and linked `providers` (id, name, status). Prefer reusing `ProjectService.get`'s `ProjectDetail`, trimmed of anything browser-only (signed URLs). Every later slice's tests and the acceptance run depend on this.

### Slice 2: Project update and delete
- `PATCH /api/ingest/projects/[id]`: title, location, notes, status, path, with the same validation and Done/`completedAt` behavior as `ProjectService.update`. Add an optional `notesAppend` (string; appended on a new paragraph, the result still capped at 5000) so a client can add to notes without a read-modify-write race.
- `DELETE /api/ingest/projects/[id]`: soft delete via `ProjectService.softDelete`. Needed so acceptance runs can remove the scratch projects they create.

### Slice 3: Steps
- `POST /api/ingest/projects/[id]/steps`: batch of 1–100 `{ text, estimateMinutes? }` with the usual `created / skipped / errors` envelope. Skip an **undone** step whose text matches, ignoring case and surrounding spaces (check what `ProjectStepService.addMany` already does and reuse it).
- `PATCH /api/ingest/projects/[id]/steps/[stepId]`: text, estimateMinutes, done.
- `DELETE /api/ingest/projects/[id]/steps/[stepId]`.
- Checking off the last undone step does **not** mark the project Done over the API (the app asks the person; the API leaves it to the caller's PATCH).

### Slice 4: Documents
- `PATCH /api/ingest/projects/[id]/documents/[documentId]`: name, note (same rules as the browser route: blank name refused, `name` must be a string when sent).
- `DELETE /api/ingest/projects/[id]/documents/[documentId]`: removes the row and the stored blob exactly as the browser route does. Deleting an already-deleted document answers 404 (document it as safe to treat as success on retry).

### Slice 5: Photos
- `DELETE /api/ingest/projects/[id]/photos/[photoId]`.
- **Retry-safe upload without a migration:** accept an optional client-supplied `photoId` (UUID) on `POST .../photos`; if a photo with that id already exists in this project, return it instead of adding a copy. `ProjectPhoto.id` is a UUID with a default, so this needs no schema change (documents already use browser-made ids).
- **Cover / order:** `PATCH /api/ingest/projects/[id]/photos/[photoId]` with `position`, or a `PUT .../photos/order` taking the full id list. Lowest position is the cover. Pick one in the spec.

### Slice 6: Docs and client
Fold every route into the ingest doc and the API reference, add the changelog entry, and add a short "Finishing a project from a script" walkthrough (read → update → steps → replace a document → clean up). A stdlib Python client already exists in the owner's Skill Library (worthington-watcher's `adulting_api.py`); propose to the owner whether a shared adulting.diy client should become a Skill Library building block rather than writing a second one. Propose only; don't move it.

## Dependencies, parallelism and serialization points

- Slice 1 lands first (everything else verifies through it). Slices 2–5 are independent routes and can run in parallel. Slice 6 runs last, or the orchestrator resolves doc conflicts at merge, since slices 2–5 all touch `project-task-ingest.md` and `api-endpoints.md`.
- **Shared database:** the local `.env` `DATABASE_URL` points at the hosted CockroachDB. Any `prisma migrate` from a worktree would change the real database. This plan is designed to need **no migration**; if a slice decides it needs one, it stops and asks the orchestrator, who asks the owner.
- **Shared Blob store:** local dev and production share one private Blob store ("a local upload is a real upload"). Tests must mock it; manual checks from a worktree are real uploads and must be cleaned up.
- **Deploy:** the acceptance run calls production (`https://www.adulting.diy`), so it waits until the integration branch is merged to `main` and Vercel has deployed. Merging to `main` and deploying are owner-approved steps.
- **Worktrees:** create them outside the repo directory (for example `~/source/adulting.diy-worktrees/<slice>`); `.gitignore` does not exclude an in-repo worktree folder.

## Acceptance (after deploy, against production)

The owner keeps a **private acceptance checklist outside this public repo** with the real project id, the document and photo ids to remove, and the steps and notes to write. The prompt that starts this initiative gives its path. Acceptance has two parts, and **both must leave production clean**:

1. **Scratch run (edge cases).** Create a throwaway project through `POST /api/ingest/projects`, then exercise every new route on it: read, patch, `notesAppend`, steps add/skip/patch/delete, a document upload/rename/delete, a photo upload with a repeated `photoId` (expect one photo), reorder, delete. Finish by deleting every document and photo it added and soft-deleting the project. Confirm with `GET /api/ingest/projects` that it is gone.
2. **Real cleanup.** Using only the new routes, bring the owner's real project up to date per the private checklist: delete the superseded documents and the stale cover photo, set the new cover, add the checklist steps (re-run to prove they skip), append the notes, and report every write with the project URL. Ask the owner before any status or path change the checklist marks "ask first".

## Out of scope (record in `docs/next-up.md` if not done)

- The project chat advisor reads notes, steps, plan, providers and photos but not documents; letting it read registered PDFs would let it answer from the attached briefs.
- Linking providers to a project over the API.
- Accepting Markdown or plain-text documents (clients currently convert to PDF).
