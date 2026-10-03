# Home projects, slice 1: capture and list (design spec)

Status: design agreed in conversation on 2026-10-03, awaiting David's review of this written spec. No code is written until this spec and a written implementation plan are both approved.

This replaces the brainstorm handoff `2026-10-02-projects-brainstorm-state.md`.

## Goal

Make adulting.diy the place where David and Amanda track their home projects. They have about a dozen real ones, ranging from a 15-minute chore (clean the hallway light fixtures) to a multi-contractor build (replace the raised deck with a covered porch and dig out storage below it). One list has to hold all of them.

Slice 1 delivers capture and the list: stand in front of the problem, give it a title, a location and a photo, save, and come back later to fill in the rest.

Success for slice 1: David can capture all of his current projects from his phone, with photos, and both he and Amanda can see, filter and edit them.

## Decisions made in the brainstorm

- adulting.diy is the home. `~/source/havemoneywantthingwhatdo` is a design reference only. None of slice 1's features exist there (it has no stored photos, no room or location, no DIY/hire label), so this design follows the providers patterns in this repo.
- Every captured thing is its own project, however small. "DIY" is a label (the path), not a container.
- Intake needs only a title. Location and photos are optional so a thought captured away from home still saves.
- Four fixed statuses: Planning, Active, Future, Done. New captures land in Planning. Statuses are not configurable per household.
- Path is DIY, hire, or not sure. A project with no path set shows a "needs details" marker.
- Both household members can create, edit and delete everything. There are no admin-only parts.
- Photos are private: only signed-in members of the owning household can load them. Storage is a private Vercel Blob store. The phone shrinks each photo before upload.
- Delivery is in two slices. Slice 2 (steps and the cross-project next-step list) gets its own spec and plan.

## Out of scope for slice 1

- Steps, time estimates and the cross-project action list (slice 2).
- Linking providers to projects, engagement status and quotes (after slice 2).
- Any AI help: suggested next steps, time estimates, problem-to-category routing (after slice 2).
- Comments on projects, assignees, due dates, reminders, budget, priority.
- Reordering photos or choosing a cover photo. The first photo uploaded is the cover.
- Purging stored photos when a project is deleted (see Deleting below).

## Data model

Two new tables. Status and path are strings validated by Zod, matching how `metaStatus` is handled elsewhere in the schema (the schema has no Prisma enums).

```prisma
model Project {
  id          String         @id @default(uuid())
  household   Household      @relation(fields: [householdId], references: [id])
  householdId String
  title       String
  location    String?        // free text, e.g. "Master bathroom"
  status      String         @default("planning") // planning, active, future, done
  path        String?        // diy, hire, unsure; null means not yet decided
  notes       String?
  completedAt DateTime?      // set when status becomes done, cleared when it leaves done
  metaStatus  String         @default("active") // active, deleted
  createdBy   User           @relation(fields: [createdById], references: [id])
  createdById String
  photos      ProjectPhoto[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([householdId, metaStatus, status])
  @@map("projects")
}

model ProjectPhoto {
  id           String   @id @default(uuid())
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId    String
  fullPath     String   // Blob pathname of the full-size JPEG
  thumbPath    String   // Blob pathname of the thumbnail JPEG
  width        Int      // pixel size of the full-size image
  height       Int
  position     Int      // display order; lowest is the cover
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
  uploadedById String
  createdAt    DateTime @default(now())

  @@index([projectId, position])
  @@map("project_photos")
}
```

`Household` and `User` gain the matching relation fields.

Migration notes:
- CockroachDB v26 creates tables schema-locked. The migration SQL must include `ALTER TABLE "projects" SET (schema_locked = false);` and the same for `project_photos` straight after each `CREATE TABLE`, before indexes and foreign keys, as the providers migration does.
- Local dev uses the production database. The migration is applied by hand with `npx prisma migrate deploy`, and only after David says to.

## Photo storage

- A private Vercel Blob store, connected to the adulting.diy Vercel project. Dependency: `@vercel/blob` 2.3 or later.
- Blob pathnames: `households/{householdId}/projects/{projectId}/{photoId}-full.jpg` and `...-thumb.jpg`.
- All Blob calls go through one thin wrapper, `server/utils/blob-storage.ts`, exposing `putPrivate`, `getPrivate` and `remove`. Services depend on the wrapper, not on the SDK, so tests can fake it.
- On Vercel the SDK authenticates through the connected store. Local dev needs `BLOB_READ_WRITE_TOKEN` in `.env`. Local dev and production share the one store, the same way they share the database, so every local upload is a real upload.
- Creating the store and adding the token are changes to an external service and need David's go-ahead.

### Upload

1. In the browser, each chosen image is drawn to a canvas and re-encoded twice as JPEG: a full-size copy with the long side at most 2000 px (quality 0.85), and a thumbnail with the long side at most 400 px (quality 0.8). The target-dimension calculation is a pure function in `utils/image-resize.ts`.
2. The browser posts both files as multipart form data to `POST /api/projects/:id/photos`, with the full image's width and height.
3. The server checks, in order: the project belongs to the caller's household and is not deleted; the project has fewer than 10 photos; both parts are present; each starts with the JPEG magic bytes; the full image is at most 3 MB and the thumbnail at most 200 KB. Both limits sit under Vercel's 4.5 MB request cap.
4. The server writes both blobs, then creates the `ProjectPhoto` row with `position` one higher than the current maximum. If the row cannot be created, it removes the two blobs (best effort) and returns an error.

`useApi()` currently forces `Content-Type: application/json` on every request, which breaks multipart uploads. It gains an `upload` method that sends `FormData` with the auth header and lets the browser set the content type.

### Serving

`GET /api/projects/:id/photos/:photoId?variant=thumb|full` (default `full`):

1. Authenticates the caller and resolves their household, using `defineHouseholdProtectedEventHandler`.
2. Loads the photo row by `photoId` and `projectId`, joined to a project in the caller's household that is not deleted. Anything else is a 404. The Blob pathname always comes from the database row and never from the request.
3. Streams the blob with `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache` and the blob's `ETag`. It forwards `If-None-Match` and returns 304 when the blob is unchanged.

The app signs requests with a bearer token in a header, which `<img src>` cannot send. A small component, `components/projects/AuthedImage.vue`, fetches the image through the API client, shows it from an object URL, and revokes the URL when unmounted.

## API

All routes use `defineHouseholdProtectedEventHandler`, validate input with Zod schemas in `server/utils/project-schemas.ts`, and map errors with the existing `HttpError` / `toHttpError` helpers.

| Route | Purpose |
|---|---|
| `GET /api/projects` | List. Query: `status` (comma-separated; defaults to `planning,active`), `path` (`diy`, `hire`, `unsure`, or `none` for not set). Returns each project with its photo count and cover photo id. Sorted Active first, then Planning, Future, Done; newest first within each. |
| `POST /api/projects` | Create. Body: `title` (required, 1 to 200 characters), `location` (optional, up to 100). Status starts as `planning`, path as null. |
| `GET /api/projects/locations` | Distinct locations already used by the household's non-deleted projects, for suggestions. |
| `GET /api/projects/:id` | One project with its photos in order. |
| `PUT /api/projects/:id` | Update any of title, location, status, path, notes. Moving to `done` sets `completedAt`; moving away clears it. |
| `DELETE /api/projects/:id` | Soft delete (`metaStatus = deleted`). |
| `POST /api/projects/:id/photos` | Upload one photo (see Upload). |
| `GET /api/projects/:id/photos/:photoId` | Serve a photo (see Serving). |
| `DELETE /api/projects/:id/photos/:photoId` | Remove the row and both blobs. |

Services: `server/services/ProjectService.ts` (projects, locations) and `server/services/ProjectPhotoService.ts` (upload, read, remove). Every query filters by `householdId`; a project or photo from another household is indistinguishable from one that does not exist (404).

## Screens

All screens follow `docs/brand.md` and the layout of the providers pages, and must work at phone width.

### Projects list (`/projects`)

- A **New project** button at the top.
- One card per project: cover thumbnail (or a placeholder), title, location, a status badge, a path badge, and a "needs details" marker when path is not set.
- Shows Active and Planning by default. A "Show future and done" toggle adds the other two. A path filter narrows to DIY, hire, not sure, or not set.
- Empty state: a short line and the New project button.
- A **Projects** link is added to `layouts/default.vue` beside Providers, in both the desktop and the mobile menu.

### New project (`/projects/new`)

- Fields: title (required), location (text input with suggestions from `GET /api/projects/locations`), and an **Add photo** control built on `<input type="file" accept="image/*" multiple>`, which offers the camera or the photo library on a phone.
- Chosen photos show as previews and can be removed before saving.
- **Save** creates the project, then uploads photos one at a time while the form stays on screen, each photo showing its own state (waiting, uploading, done, failed). When every photo has uploaded it goes to the project page.
- If a photo upload fails, the project is still saved. The failed photo shows a **Retry** button, and a **Go to project** link lets David move on without it. Leaving or reloading the page drops any unsent photo; it can be added again from the project page.

### Project page (`/projects/:id`)

- Photos in order; tapping one shows it full size.
- Every field is editable in place: title, location, status, path, notes.
- Add photos (same control and upload path as the new-project form, up to the cap of 10) and remove a photo, with a confirmation.
- Delete project, with a confirmation.

## Deleting

- Deleting a project is a soft delete. Its photos stay in the Blob store and their rows stay in the database, but nothing can load them, because every route excludes deleted projects.
- Deleting a single photo removes its row and both blobs.
- A clean-up job that purges blobs for long-deleted projects is not part of this slice.

## Error handling

- Validation failures return 400 with a message the form can show next to the field.
- Upload rejections use specific messages: "This project already has 10 photos", "Photo is too large", "Only JPEG photos are accepted".
- A Blob outage on upload returns 502 and leaves no database row. A Blob outage on read returns 502 and `AuthedImage` shows a broken-image placeholder.
- Requests for another household's project or photo return 404.

## Testing

Automated (Vitest, mocked Prisma, faked Blob wrapper, in `tests/unit/`):
- `ProjectService`: household isolation on every method; defaults on create; status transitions set and clear `completedAt`; list filters and sort; soft delete hides the project; distinct locations.
- `ProjectPhotoService`: household isolation; the 10-photo cap; JPEG magic-byte and size checks; position assignment; blob clean-up when the row write fails; remove deletes the row and both blobs; reads refuse photos on deleted projects.
- `project-schemas`: accepted and rejected inputs.
- `image-resize`: the target-dimension calculation for landscape, portrait and already-small images.

Not automated, and to be stated plainly when the work is reported:
- The camera and photo-library picker on a phone.
- The canvas shrinking itself (only its arithmetic is unit-tested).
- Real uploads to and reads from Vercel Blob.
- The pages as rendered, including the nav link.

David will get a numbered click-through script for these, with the expected result for each step.

## Delivery

- Subagent-driven development, as for providers: one implementer per task, an independent review after each task, a fix round when needed, and a final whole-branch review. Implementers run on Sonnet and reviewers on Opus.
- Work happens on a feature branch in the main checkout. Git worktrees are not used, because a symlinked `node_modules` breaks this repo's Vitest setup.
- David's go-ahead is required before: creating the Blob store, applying the migration, any push, and any merge.
- After the build, documentation is updated with the `update-docs` skill (a new `docs/functionality/projects.md`, API reference, changelog, `CLAUDE.md`).

## Later slices (not designed here)

2. Steps on each project (a line of text, a done checkbox, an order, an optional time estimate in minutes) and the cross-project list showing the next undone step of each Active project. A project with no steps appears as itself.
3. Provider links on a project with a status (considering, contacted, chosen, passed), then quotes.
4. AI help: suggested next steps and time estimates, and problem-to-category routing with a reason for each shortlisted provider. Ranking stays deterministic. Lessons to carry from havemoneywantthingwhatdo: never wipe existing steps when regenerating, and do not run the planning call inside a single web request.

## Open items carried from the brainstorm brief

These are offers to David, not part of the build. None is done without his yes.

- His click-through results for the providers screens.
- A `/project-status` card for adulting.diy (doc: `_Projects/_/Top of the projects TO YOU!.md`). Proposed slug `adulting-diy`, kind `build`. Draft status: "Household task scheduler (Nuxt, Prisma, CockroachDB, Google sign-in) running in prod for me and my wife. Added a shared providers list (352 contractors and services with neighbor-recommendation evidence, admin-managed categories and statuses), fed by the Worthington watcher through a per-household API (Sep 30). Direction: the home for tracking home projects, absorbing the ideas in havemoneywantthingwhatdo. Shifts: providers and watcher ingest shipped (Sep 30)." Draft next: "build project capture with photos (slice 1), then steps and the next-step list."
- `/shelloverflow` for the worktree and CockroachDB `schema_locked` lessons.
- The watcher logged-out detector.
