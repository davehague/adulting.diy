# Home Projects Slice 1 (Capture and List) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let David and Amanda capture home projects from a phone (title, location, photos), then see, filter and edit them in a shared list.

**Architecture:** Two new household-scoped tables (`projects`, `project_photos`) behind two services, following the providers patterns. Photos are shrunk in the browser, uploaded as multipart form data to a Nitro route, stored in a private Vercel Blob store through one thin wrapper, and served back only through an authenticated route. Three new pages (`/projects`, `/projects/new`, `/projects/:id`) and a nav link.

**Tech Stack:** Nuxt 3.21 / Vue 3 `<script setup>` / TypeScript, Nitro (h3 1.15), Prisma 5 on CockroachDB, Zod 3, `@vercel/blob` >= 2.3, Tailwind, Vitest with mocked Prisma.

**Spec:** `docs/superpowers/specs/2026-10-03-projects-design.md`. Read it before starting any task.

## Execution rules (set by David)

- Subagent-driven development: one implementer per task, an independent reviewer after each task, a fix round when the reviewer finds problems, and a final whole-branch review.
- Implementer subagents run on **Sonnet** (`model: "sonnet"`). Reviewer subagents, including the final whole-branch review, run on **Opus** (`model: "opus"`).
- Work in the main checkout on branch `feat/projects`. Do **not** use git worktrees: a symlinked `node_modules` breaks this repo's Vitest setup. Tasks therefore run one at a time.
- Commit with explicit paths only. Never `git add -A` or `git add .`; `.claude/settings.local.json` is modified locally and must not be committed.
- **Local dev uses the production database.** No task may run `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, a seed script, or the dev server. `npx prisma generate` is safe (it does not contact the database).
- These need David's explicit go-ahead and are done by the controller, never by a subagent: creating the Vercel Blob store, adding `BLOB_READ_WRITE_TOKEN`, applying the migration, any `git push`, any merge.
- When reporting, say plainly what was only unit-tested and what was not exercised at all.

## Global Constraints

- Statuses are exactly `planning`, `active`, `future`, `done`. New projects start as `planning`.
- Paths are exactly `diy`, `hire`, `unsure`, or null (not yet decided).
- Title is required, 1 to 200 characters after trimming. Location is optional, up to 100 characters.
- At most 10 photos per project. Full image at most 3 MB, thumbnail at most 200 KB, both JPEG (checked by magic bytes `FF D8 FF`).
- Browser resize targets: full image long side at most 2000 px at JPEG quality 0.85; thumbnail long side at most 400 px at quality 0.8.
- Blob pathnames: `households/{householdId}/projects/{projectId}/{photoId}-full.jpg` and `...-thumb.jpg`. A Blob pathname is only ever read from a database row, never from a request.
- Every query filters by `householdId`. Another household's project or photo returns 404, the same as a missing one.
- Project deletion is soft (`metaStatus = 'deleted'`). Deleted projects and their photos are unreachable through every route.
- Upload error messages, verbatim: `This project already has 10 photos`, `Photo is too large`, `Only JPEG photos are accepted`.
- Photo responses carry `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache`, and the blob's `ETag`.
- Code style per `CLAUDE.md`: explicit types, no `any`, arrow functions, `import { type X }`, camelCase / PascalCase.
- UI per `docs/brand.md`: `stone` scale, `amber-600` primary buttons, cards as `bg-white rounded-xl shadow-sm border border-stone-200`. Every screen must work at phone width.
- CockroachDB creates tables schema-locked: each `CREATE TABLE` in the migration is followed by `ALTER TABLE "x" SET (schema_locked = false);`.
- End every commit message with these two lines:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TkAk512TP7hybn76VeifrC
  ```

## Review Focus

- A project or photo id from household B, requested by household A, must return 404 from every service method, including the one that returns photo bytes. (Tests in Tasks 2 and 3.)
- A photo on a soft-deleted project must not be readable, uploadable to, or removable. (Tests in Task 3.)
- A file that is not a JPEG (a PNG, or text renamed `.jpg`) must be rejected before anything is written to Blob. (Test in Task 3.)
- If the database row cannot be created after the blobs are written, both blobs are removed, so no orphan is left. (Test in Task 3.)
- Marking a Done project Done again must keep its original `completedAt`; moving it back to Active must clear it. (Tests in Task 2.)
- A title of only spaces must be rejected, and a location of only spaces must be stored as null. (Tests in Task 1.)
- An 11th photo must be rejected with `This project already has 10 photos`. (Test in Task 3.)

---

## File Structure

**Create**
- `prisma/migrations/20261003120000_add_projects/migration.sql`: the two tables, indexes and foreign keys.
- `types/project.ts`: shared constants and DTO types.
- `server/utils/project-schemas.ts`: Zod schemas and query-filter parsers.
- `server/utils/blob-storage.ts`: the only file that imports `@vercel/blob`.
- `server/services/ProjectService.ts`: list, create, get, update, soft delete, locations.
- `server/services/ProjectPhotoService.ts`: add, read, remove.
- `server/api/projects/index.get.ts`, `index.post.ts`, `locations.get.ts`, `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`, `[id]/photos.post.ts`, `[id]/photos/[photoId].get.ts`, `[id]/photos/[photoId].delete.ts`.
- `utils/image-resize.ts`: `fitWithin` (pure) and `resizePhoto` (canvas).
- `utils/project-labels.ts`: display labels and badge classes.
- `composables/useProjects.ts`: client API wrapper.
- `components/projects/AuthedImage.vue`: loads a private photo through the API client.
- `components/projects/PhotoUploader.vue`: pick, preview, upload, retry.
- `pages/projects/index.vue`, `pages/projects/new.vue`, `pages/projects/[id].vue`.
- Tests: `tests/unit/utils/project-schemas.test.ts`, `tests/unit/utils/blob-storage.test.ts`, `tests/unit/utils/image-resize.test.ts`, `tests/unit/services/project-service.test.ts`, `tests/unit/services/project-photo-service.test.ts`.
- `docs/functionality/projects.md`.

**Modify**
- `prisma/schema.prisma`: two models plus back-relations on `User` and `Household`.
- `package.json` / `package-lock.json`: add `@vercel/blob`.
- `utils/api.ts`: add an `upload` method.
- `layouts/default.vue`: Projects nav link (desktop and mobile).
- `docs/tech/api-endpoints.md`, `docs/functionality/changelog.md`, `CLAUDE.md`.

---

### Task 1: Schema, migration, types and validation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261003120000_add_projects/migration.sql`
- Create: `types/project.ts`
- Create: `server/utils/project-schemas.ts`
- Test: `tests/unit/utils/project-schemas.test.ts`

**Interfaces:**
- Consumes: `HttpError` from `@/server/utils/api-errors` (`new HttpError(message, statusCode)`).
- Produces: Prisma models `Project` and `ProjectPhoto` (client accessors `prisma.project`, `prisma.projectPhoto`); everything exported from `types/project.ts` (below); `projectCreateSchema`, `projectUpdateSchema`, `photoDimensionsSchema`, `parseStatusFilter(raw: unknown): ProjectStatus[]`, `parsePathFilter(raw: unknown): ProjectPathFilter | undefined`.

- [ ] **Step 1: Add the models to `prisma/schema.prisma`**

Append after the `ApiKey` model:

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
  createdBy   User           @relation("ProjectCreatedBy", fields: [createdById], references: [id])
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
  uploadedBy   User     @relation("ProjectPhotoUploadedBy", fields: [uploadedById], references: [id])
  uploadedById String
  createdAt    DateTime @default(now())

  @@index([projectId, position])
  @@map("project_photos")
}
```

In `model User`, add after `providerComments       ProviderComment[]`:

```prisma
  createdProjects        Project[]               @relation("ProjectCreatedBy")
  projectPhotos          ProjectPhoto[]          @relation("ProjectPhotoUploadedBy")
```

In `model Household`, add after `apiKeys            ApiKey[]`:

```prisma
  projects           Project[]
```

- [ ] **Step 2: Write the migration SQL by hand**

Do not run `prisma migrate dev` (it contacts the production database). Create `prisma/migrations/20261003120000_add_projects/migration.sql`. First open `prisma/migrations/20260929120000_add_providers/migration.sql` and mirror its style exactly (column types, the `schema_locked` comment line, statement order: tables, then indexes, then foreign keys).

```sql
-- CreateTable
CREATE TABLE "projects" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "title" STRING NOT NULL,
    "location" STRING,
    "status" STRING NOT NULL DEFAULT 'planning',
    "path" STRING,
    "notes" STRING,
    "completedAt" TIMESTAMP(3),
    "metaStatus" STRING NOT NULL DEFAULT 'active',
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "projects" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "project_photos" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "fullPath" STRING NOT NULL,
    "thumbPath" STRING NOT NULL,
    "width" INT4 NOT NULL,
    "height" INT4 NOT NULL,
    "position" INT4 NOT NULL,
    "uploadedById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_photos_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "project_photos" SET (schema_locked = false);

-- CreateIndex
CREATE INDEX "projects_householdId_metaStatus_status_idx" ON "projects"("householdId", "metaStatus", "status");

-- CreateIndex
CREATE INDEX "project_photos_projectId_position_idx" ON "project_photos"("projectId", "position");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

If the providers migration differs in any convention (for example it re-locks tables at the end), follow the providers migration and say so in your report.

- [ ] **Step 3: Validate the schema and regenerate the client**

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema at prisma/schema.prisma is valid" and "Generated Prisma Client". Neither command contacts the database.

- [ ] **Step 4: Create `types/project.ts`**

```ts
export const PROJECT_STATUSES = ['planning', 'active', 'future', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PATHS = ['diy', 'hire', 'unsure'] as const;
export type ProjectPath = (typeof PROJECT_PATHS)[number];
// 'none' selects projects whose path is not set yet
export type ProjectPathFilter = ProjectPath | 'none';

export const DEFAULT_LIST_STATUSES: ProjectStatus[] = ['planning', 'active'];

export const MAX_PROJECT_PHOTOS = 10;
export const MAX_FULL_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_THUMB_PHOTO_BYTES = 200 * 1024;

export type PhotoVariant = 'full' | 'thumb';

export interface ProjectPhotoDto {
  id: string;
  width: number;
  height: number;
  position: number;
}

export interface ProjectListItem {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  photoCount: number;
  coverPhotoId: string | null;
}

export interface ProjectDetail {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  notes: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  photos: ProjectPhotoDto[];
}

export interface ProjectCreateInput {
  title: string;
  location?: string | null;
}

export interface ProjectUpdateInput {
  title?: string;
  location?: string | null;
  status?: ProjectStatus;
  path?: ProjectPath | null;
  notes?: string | null;
}

export interface ProjectListFilters {
  statuses?: ProjectStatus[];
  path?: ProjectPathFilter;
}
```

- [ ] **Step 5: Write the failing schema tests**

Create `tests/unit/utils/project-schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  projectCreateSchema,
  projectUpdateSchema,
  photoDimensionsSchema,
  parseStatusFilter,
  parsePathFilter,
} from '@/server/utils/project-schemas'

// Returns the statusCode of the error a function throws, or undefined if it does not throw.
const thrownStatus = (fn: () => unknown): number | undefined => {
  try {
    fn()
  } catch (error) {
    return (error as { statusCode?: number }).statusCode
  }
  return undefined
}

describe('projectCreateSchema', () => {
  it('trims the title and accepts a title alone', () => {
    const parsed = projectCreateSchema.parse({ title: '  Paint ceiling spots  ' })
    expect(parsed.title).toBe('Paint ceiling spots')
  })

  it('rejects a title of only spaces', () => {
    const result = projectCreateSchema.safeParse({ title: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Title is required')
  })

  it('rejects a title over 200 characters', () => {
    expect(projectCreateSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false)
  })

  it('stores a location of only spaces as null', () => {
    expect(projectCreateSchema.parse({ title: 'A', location: '   ' }).location).toBeNull()
  })

  it('rejects a location over 100 characters', () => {
    expect(projectCreateSchema.safeParse({ title: 'A', location: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('projectUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(projectUpdateSchema.parse({ status: 'active' })).toEqual({ status: 'active' })
  })

  it('accepts clearing the path with null', () => {
    expect(projectUpdateSchema.parse({ path: null })).toEqual({ path: null })
  })

  it('rejects an unknown status', () => {
    expect(projectUpdateSchema.safeParse({ status: 'someday' }).success).toBe(false)
  })

  it('rejects an unknown path', () => {
    expect(projectUpdateSchema.safeParse({ path: 'contractor' }).success).toBe(false)
  })

  it('stores empty notes as null', () => {
    expect(projectUpdateSchema.parse({ notes: '  ' }).notes).toBeNull()
  })
})

describe('photoDimensionsSchema', () => {
  it('coerces numeric strings from multipart fields', () => {
    expect(photoDimensionsSchema.parse({ width: '2000', height: '1500' })).toEqual({ width: 2000, height: 1500 })
  })

  it('rejects missing or zero dimensions', () => {
    expect(photoDimensionsSchema.safeParse({ width: undefined, height: '10' }).success).toBe(false)
    expect(photoDimensionsSchema.safeParse({ width: '0', height: '10' }).success).toBe(false)
  })
})

describe('parseStatusFilter', () => {
  it('defaults to planning and active', () => {
    expect(parseStatusFilter(undefined)).toEqual(['planning', 'active'])
    expect(parseStatusFilter('')).toEqual(['planning', 'active'])
  })

  it('parses a comma-separated list', () => {
    expect(parseStatusFilter('active,done')).toEqual(['active', 'done'])
  })

  it('rejects an unknown status with a 400', () => {
    expect(thrownStatus(() => parseStatusFilter('active,someday'))).toBe(400)
  })
})

describe('parsePathFilter', () => {
  it('returns undefined when absent', () => {
    expect(parsePathFilter(undefined)).toBeUndefined()
    expect(parsePathFilter('')).toBeUndefined()
  })

  it('accepts the three paths and none', () => {
    expect(parsePathFilter('diy')).toBe('diy')
    expect(parsePathFilter('none')).toBe('none')
  })

  it('rejects an unknown path with a 400', () => {
    expect(thrownStatus(() => parsePathFilter('contractor'))).toBe(400)
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/utils/project-schemas.test.ts`
Expected: FAIL, cannot resolve `@/server/utils/project-schemas`.

- [ ] **Step 7: Create `server/utils/project-schemas.ts`**

```ts
import { z } from 'zod';
import { HttpError } from '@/server/utils/api-errors';
import {
  DEFAULT_LIST_STATUSES,
  PROJECT_PATHS,
  PROJECT_STATUSES,
  type ProjectPathFilter,
  type ProjectStatus,
} from '@/types/project';

const emptyToNull = (value: string): string | null => (value === '' ? null : value);

const title = z
  .string({ required_error: 'Title is required' })
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer');

const location = z
  .string()
  .trim()
  .max(100, 'Location must be 100 characters or fewer')
  .transform(emptyToNull)
  .nullable()
  .optional();

const notes = z
  .string()
  .trim()
  .max(5000, 'Notes must be 5000 characters or fewer')
  .transform(emptyToNull)
  .nullable()
  .optional();

export const projectCreateSchema = z.object({ title, location });

export const projectUpdateSchema = z.object({
  title: title.optional(),
  location,
  status: z.enum(PROJECT_STATUSES, { message: 'Unknown status' }).optional(),
  path: z.enum(PROJECT_PATHS, { message: 'Unknown path' }).nullable().optional(),
  notes,
});

const dimension = z.coerce.number().int().min(1).max(20000);
export const photoDimensionsSchema = z.object({ width: dimension, height: dimension });

const isStatus = (value: string): value is ProjectStatus =>
  (PROJECT_STATUSES as readonly string[]).includes(value);

export const parseStatusFilter = (raw: unknown): ProjectStatus[] => {
  if (typeof raw !== 'string' || raw.trim() === '') return [...DEFAULT_LIST_STATUSES];
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean);
  const statuses: ProjectStatus[] = [];
  for (const value of values) {
    if (!isStatus(value)) throw new HttpError(`Unknown status: ${value}`, 400);
    statuses.push(value);
  }
  return statuses;
};

export const parsePathFilter = (raw: unknown): ProjectPathFilter | undefined => {
  if (typeof raw !== 'string' || raw === '') return undefined;
  if (raw === 'none' || (PROJECT_PATHS as readonly string[]).includes(raw)) return raw as ProjectPathFilter;
  throw new HttpError(`Unknown path: ${raw}`, 400);
};
```

If the installed Zod version rejects `{ message }` as the second argument to `z.enum`, use `{ errorMap: () => ({ message: 'Unknown status' }) }` instead.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/utils/project-schemas.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261003120000_add_projects/migration.sql types/project.ts server/utils/project-schemas.ts tests/unit/utils/project-schemas.test.ts
git commit -m "feat: project and project photo schema, types and validation"
```

---

### Task 2: ProjectService

**Files:**
- Create: `server/services/ProjectService.ts`
- Test: `tests/unit/services/project-service.test.ts`

**Interfaces:**
- Consumes: `prisma.project` (Task 1); types from `@/types/project`; `HttpError`.
- Produces:
  - `list(householdId: string, filters: ProjectListFilters): Promise<ProjectListItem[]>`
  - `create(householdId: string, userId: string, input: ProjectCreateInput): Promise<{ id: string }>`
  - `get(householdId: string, id: string): Promise<ProjectDetail>`
  - `update(householdId: string, id: string, input: ProjectUpdateInput): Promise<ProjectDetail>`
  - `softDelete(householdId: string, id: string): Promise<void>`
  - `locations(householdId: string): Promise<string[]>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/services/project-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectService } from '@/server/services/ProjectService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  householdId: 'h1',
  title: 'Paint ceiling spots',
  location: 'Hallway',
  status: 'planning',
  path: null,
  notes: null,
  completedAt: null,
  metaStatus: 'active',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  photos: [],
  ...overrides,
})

describe('ProjectService', () => {
  let service: ProjectService
  beforeEach(() => { service = new ProjectService(); vi.clearAllMocks() })

  describe('list', () => {
    it('scopes to the household, hides deleted, and defaults to planning and active', async () => {
      db.project.findMany.mockResolvedValue([])
      await service.list('h1', {})
      const where = db.project.findMany.mock.calls[0][0].where
      expect(where.householdId).toBe('h1')
      expect(where.metaStatus).toBe('active')
      expect(where.status).toEqual({ in: ['planning', 'active'] })
    })

    it('filters to projects with no path when path is none', async () => {
      db.project.findMany.mockResolvedValue([])
      await service.list('h1', { path: 'none' })
      expect(db.project.findMany.mock.calls[0][0].where.path).toBeNull()
    })

    it('filters by a specific path', async () => {
      db.project.findMany.mockResolvedValue([])
      await service.list('h1', { path: 'diy' })
      expect(db.project.findMany.mock.calls[0][0].where.path).toBe('diy')
    })

    it('puts active before planning and keeps newest first within a status', async () => {
      db.project.findMany.mockResolvedValue([
        row({ id: 'plan-new', status: 'planning' }),
        row({ id: 'active-new', status: 'active' }),
        row({ id: 'plan-old', status: 'planning' }),
        row({ id: 'active-old', status: 'active' }),
      ])
      const result = await service.list('h1', {})
      expect(result.map((p) => p.id)).toEqual(['active-new', 'active-old', 'plan-new', 'plan-old'])
      expect(db.project.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' })
    })

    it('reports the photo count and the first photo as the cover', async () => {
      db.project.findMany.mockResolvedValue([row({ photos: [{ id: 'ph1' }, { id: 'ph2' }] }), row({ id: 'p2' })])
      const [withPhotos, without] = await service.list('h1', {})
      expect(withPhotos.photoCount).toBe(2)
      expect(withPhotos.coverPhotoId).toBe('ph1')
      expect(without.photoCount).toBe(0)
      expect(without.coverPhotoId).toBeNull()
    })
  })

  describe('create', () => {
    it('stores the household and creator and returns the id', async () => {
      db.project.create.mockResolvedValue({ id: 'new-id' })
      const result = await service.create('h1', 'u1', { title: 'Patch hole', location: 'Kitchen' })
      expect(result).toEqual({ id: 'new-id' })
      expect(db.project.create.mock.calls[0][0].data).toEqual({
        householdId: 'h1', createdById: 'u1', title: 'Patch hole', location: 'Kitchen',
      })
    })

    it('stores a missing location as null', async () => {
      db.project.create.mockResolvedValue({ id: 'new-id' })
      await service.create('h1', 'u1', { title: 'Patch hole' })
      expect(db.project.create.mock.calls[0][0].data.location).toBeNull()
    })
  })

  describe('get', () => {
    it('returns 404 for a project in another household or a deleted one', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.get('h1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
    })

    it('returns the project with its photos', async () => {
      db.project.findFirst.mockResolvedValue(row({ photos: [{ id: 'ph1', width: 2000, height: 1500, position: 0 }] }))
      const result = await service.get('h1', 'p1')
      expect(result.title).toBe('Paint ceiling spots')
      expect(result.photos).toEqual([{ id: 'ph1', width: 2000, height: 1500, position: 0 }])
    })
  })

  describe('update', () => {
    it('returns 404 and writes nothing for another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'p1', { title: 'x' })).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.update).not.toHaveBeenCalled()
    })

    it('sets completedAt when a project becomes done', async () => {
      db.project.findFirst.mockResolvedValue(row({ status: 'active' }))
      db.project.update.mockResolvedValue(row({ status: 'done' }))
      await service.update('h1', 'p1', { status: 'done' })
      expect(db.project.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date)
    })

    it('keeps the original completedAt when a done project is marked done again', async () => {
      const finished = new Date('2026-09-01T00:00:00Z')
      db.project.findFirst.mockResolvedValue(row({ status: 'done', completedAt: finished }))
      db.project.update.mockResolvedValue(row({ status: 'done', completedAt: finished }))
      await service.update('h1', 'p1', { status: 'done' })
      expect(db.project.update.mock.calls[0][0].data.completedAt).toBe(finished)
    })

    it('clears completedAt when a project leaves done', async () => {
      db.project.findFirst.mockResolvedValue(row({ status: 'done', completedAt: new Date() }))
      db.project.update.mockResolvedValue(row({ status: 'active' }))
      await service.update('h1', 'p1', { status: 'active' })
      expect(db.project.update.mock.calls[0][0].data.completedAt).toBeNull()
    })

    it('does not touch completedAt when status is not in the update', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.project.update.mockResolvedValue(row({ notes: 'x' }))
      await service.update('h1', 'p1', { notes: 'x' })
      expect('completedAt' in db.project.update.mock.calls[0][0].data).toBe(false)
    })

    it('writes only the fields that were sent', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.project.update.mockResolvedValue(row({ path: 'diy' }))
      await service.update('h1', 'p1', { path: 'diy' })
      expect(db.project.update.mock.calls[0][0].data).toEqual({ path: 'diy' })
    })
  })

  describe('softDelete', () => {
    it('marks the project deleted', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.project.update.mockResolvedValue(row({ metaStatus: 'deleted' }))
      await service.softDelete('h1', 'p1')
      expect(db.project.update.mock.calls[0][0]).toMatchObject({ where: { id: 'p1' }, data: { metaStatus: 'deleted' } })
    })

    it('returns 404 for another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.softDelete('h1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.update).not.toHaveBeenCalled()
    })
  })

  describe('locations', () => {
    it('returns distinct, sorted locations for the household', async () => {
      db.project.findMany.mockResolvedValue([{ location: 'kitchen' }, { location: 'Hallway' }, { location: null }])
      const result = await service.locations('h1')
      expect(result).toEqual(['Hallway', 'kitchen'])
      const args = db.project.findMany.mock.calls[0][0]
      expect(args.where).toEqual({ householdId: 'h1', metaStatus: 'active', location: { not: null } })
      expect(args.distinct).toEqual(['location'])
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/services/project-service.test.ts`
Expected: FAIL, cannot resolve `@/server/services/ProjectService`.

- [ ] **Step 3: Create `server/services/ProjectService.ts`**

```ts
import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import {
  DEFAULT_LIST_STATUSES,
  type ProjectCreateInput,
  type ProjectDetail,
  type ProjectListFilters,
  type ProjectListItem,
  type ProjectPath,
  type ProjectStatus,
  type ProjectUpdateInput,
} from '@/types/project';

const STATUS_ORDER: Record<ProjectStatus, number> = { active: 0, planning: 1, future: 2, done: 3 };

const detailInclude = {
  photos: {
    orderBy: { position: 'asc' },
    select: { id: true, width: true, height: true, position: true },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithPhotos = Prisma.ProjectGetPayload<{ include: typeof detailInclude }>;

const toDetail = (project: ProjectWithPhotos): ProjectDetail => ({
  id: project.id,
  title: project.title,
  location: project.location,
  status: project.status as ProjectStatus,
  path: project.path as ProjectPath | null,
  notes: project.notes,
  completedAt: project.completedAt,
  createdAt: project.createdAt,
  photos: project.photos,
});

export class ProjectService {
  async list(householdId: string, filters: ProjectListFilters): Promise<ProjectListItem[]> {
    const statuses = filters.statuses?.length ? filters.statuses : DEFAULT_LIST_STATUSES;
    const where: Prisma.ProjectWhereInput = { householdId, metaStatus: 'active', status: { in: statuses } };
    if (filters.path === 'none') where.path = null;
    else if (filters.path) where.path = filters.path;

    const rows = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { photos: { orderBy: { position: 'asc' }, select: { id: true } } },
    });

    // Array.prototype.sort is stable, so newest-first from the query survives within each status.
    return [...rows]
      .sort((a, b) => STATUS_ORDER[a.status as ProjectStatus] - STATUS_ORDER[b.status as ProjectStatus])
      .map((project) => ({
        id: project.id,
        title: project.title,
        location: project.location,
        status: project.status as ProjectStatus,
        path: project.path as ProjectPath | null,
        photoCount: project.photos.length,
        coverPhotoId: project.photos[0]?.id ?? null,
      }));
  }

  async create(householdId: string, userId: string, input: ProjectCreateInput): Promise<{ id: string }> {
    const project = await prisma.project.create({
      data: { householdId, createdById: userId, title: input.title, location: input.location ?? null },
    });
    return { id: project.id };
  }

  async get(householdId: string, id: string): Promise<ProjectDetail> {
    return toDetail(await this.requireProject(householdId, id));
  }

  async update(householdId: string, id: string, input: ProjectUpdateInput): Promise<ProjectDetail> {
    const existing = await this.requireProject(householdId, id);
    const data: Prisma.ProjectUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.location !== undefined) data.location = input.location;
    if (input.path !== undefined) data.path = input.path;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status !== 'done') data.completedAt = null;
      else data.completedAt = existing.status === 'done' ? existing.completedAt : new Date();
    }
    const updated = await prisma.project.update({ where: { id }, data, include: detailInclude });
    return toDetail(updated);
  }

  async softDelete(householdId: string, id: string): Promise<void> {
    await this.requireProject(householdId, id);
    await prisma.project.update({ where: { id }, data: { metaStatus: 'deleted' } });
  }

  async locations(householdId: string): Promise<string[]> {
    const rows = await prisma.project.findMany({
      where: { householdId, metaStatus: 'active', location: { not: null } },
      distinct: ['location'],
      select: { location: true },
    });
    return rows
      .map((r) => r.location)
      .filter((location): location is string => !!location)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  private async requireProject(householdId: string, id: string): Promise<ProjectWithPhotos> {
    const project = await prisma.project.findFirst({
      where: { id, householdId, metaStatus: 'active' },
      include: detailInclude,
    });
    if (!project) throw new HttpError('Project not found', 404);
    return project;
  }
}
```

Note for the "keeps the original completedAt" test: when the existing project is done with a null `completedAt` (should not happen, but old data might), `existing.completedAt` is null and stays null. That is acceptable.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/services/project-service.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add server/services/ProjectService.ts tests/unit/services/project-service.test.ts
git commit -m "feat: ProjectService with household-scoped list, create, update and soft delete"
```

---

### Task 3: Blob wrapper and ProjectPhotoService

**Files:**
- Modify: `package.json`, `package-lock.json` (add `@vercel/blob`)
- Create: `server/utils/blob-storage.ts`
- Create: `server/services/ProjectPhotoService.ts`
- Test: `tests/unit/utils/blob-storage.test.ts`
- Test: `tests/unit/services/project-photo-service.test.ts`

**Interfaces:**
- Consumes: `prisma.project`, `prisma.projectPhoto` (Task 1); `MAX_PROJECT_PHOTOS`, `MAX_FULL_PHOTO_BYTES`, `MAX_THUMB_PHOTO_BYTES`, `PhotoVariant`, `ProjectPhotoDto` from `@/types/project`; `HttpError`.
- Produces:
  - `blob-storage.ts`: `interface PrivateBlobRead { statusCode: 200 | 304; stream: ReadableStream<Uint8Array> | null; etag: string }`, `putPrivate(pathname: string, data: Buffer): Promise<void>`, `getPrivate(pathname: string, ifNoneMatch?: string): Promise<PrivateBlobRead | null>`, `removeBlobs(pathnames: string[]): Promise<void>`.
  - `ProjectPhotoService`: `interface PhotoUpload { full: Buffer; thumb: Buffer; width: number; height: number }`, `add(householdId: string, projectId: string, userId: string, upload: PhotoUpload): Promise<ProjectPhotoDto>`, `read(householdId: string, projectId: string, photoId: string, variant: PhotoVariant, ifNoneMatch?: string): Promise<PrivateBlobRead>`, `remove(householdId: string, projectId: string, photoId: string): Promise<void>`.

- [ ] **Step 1: Install the SDK and check its API**

Run: `npm install @vercel/blob@^2.3.3`
Expected: `package.json` lists `"@vercel/blob"` under dependencies.

Then open `node_modules/@vercel/blob/dist/index.d.ts` and confirm three things: `put` accepts `{ access: 'private' }`; `get(pathname, { access: 'private', ifNoneMatch })` exists and returns an object with `statusCode`, `stream` and `blob.etag` (or null); `del` accepts a pathname or array of pathnames (not only full URLs). If `get` is missing or `del` only accepts URLs, **stop and report**: that changes what the database must store and is a design decision, not something to work around.

- [ ] **Step 2: Write the failing wrapper tests**

Create `tests/unit/utils/blob-storage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }))

import { put, get, del } from '@vercel/blob'
import { putPrivate, getPrivate, removeBlobs } from '@/server/utils/blob-storage'

const sdk = { put: put as unknown as ReturnType<typeof vi.fn>, get: get as unknown as ReturnType<typeof vi.fn>, del: del as unknown as ReturnType<typeof vi.fn> }

describe('blob-storage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes private JPEGs at the exact pathname', async () => {
    const data = Buffer.from([0xff, 0xd8, 0xff])
    await putPrivate('households/h1/projects/p1/x-full.jpg', data)
    expect(sdk.put).toHaveBeenCalledWith('households/h1/projects/p1/x-full.jpg', data, {
      access: 'private', contentType: 'image/jpeg', addRandomSuffix: false,
    })
  })

  it('returns null when the blob does not exist', async () => {
    sdk.get.mockResolvedValue(null)
    expect(await getPrivate('missing.jpg')).toBeNull()
  })

  it('returns the stream and etag on a 200', async () => {
    const stream = new ReadableStream<Uint8Array>()
    sdk.get.mockResolvedValue({ statusCode: 200, stream, blob: { etag: '"abc"' } })
    expect(await getPrivate('a.jpg')).toEqual({ statusCode: 200, stream, etag: '"abc"' })
  })

  it('passes If-None-Match through and returns a 304 with no stream', async () => {
    sdk.get.mockResolvedValue({ statusCode: 304, stream: null, blob: { etag: '"abc"' } })
    expect(await getPrivate('a.jpg', '"abc"')).toEqual({ statusCode: 304, stream: null, etag: '"abc"' })
    expect(sdk.get).toHaveBeenCalledWith('a.jpg', { access: 'private', ifNoneMatch: '"abc"' })
  })

  it('treats any other status as missing', async () => {
    sdk.get.mockResolvedValue({ statusCode: 404, stream: null, blob: { etag: '' } })
    expect(await getPrivate('a.jpg')).toBeNull()
  })

  it('removes several blobs in one call and skips an empty list', async () => {
    await removeBlobs(['a.jpg', 'b.jpg'])
    expect(sdk.del).toHaveBeenCalledWith(['a.jpg', 'b.jpg'])
    sdk.del.mockClear()
    await removeBlobs([])
    expect(sdk.del).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/utils/blob-storage.test.ts`
Expected: FAIL, cannot resolve `@/server/utils/blob-storage`.

- [ ] **Step 4: Create `server/utils/blob-storage.ts`**

```ts
import { put, get, del } from '@vercel/blob';

// The only module that talks to Vercel Blob. Services depend on these three functions so tests can fake storage.

export interface PrivateBlobRead {
  statusCode: 200 | 304;
  stream: ReadableStream<Uint8Array> | null;
  etag: string;
}

export const putPrivate = async (pathname: string, data: Buffer): Promise<void> => {
  await put(pathname, data, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false });
};

export const getPrivate = async (pathname: string, ifNoneMatch?: string): Promise<PrivateBlobRead | null> => {
  const result = await get(pathname, { access: 'private', ifNoneMatch });
  if (!result) return null;
  if (result.statusCode === 304) return { statusCode: 304, stream: null, etag: result.blob.etag };
  if (result.statusCode !== 200) return null;
  return { statusCode: 200, stream: result.stream, etag: result.blob.etag };
};

export const removeBlobs = async (pathnames: string[]): Promise<void> => {
  if (pathnames.length === 0) return;
  await del(pathnames);
};
```

Adjust only the casts needed to satisfy the SDK's real types; keep the three exported signatures exactly as written.

- [ ] **Step 5: Run to verify the wrapper tests pass**

Run: `npx vitest run tests/unit/utils/blob-storage.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the failing service tests**

Create `tests/unit/services/project-photo-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    projectPhoto: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/server/utils/blob-storage', () => ({
  putPrivate: vi.fn(),
  getPrivate: vi.fn(),
  removeBlobs: vi.fn(),
}))

import prisma from '@/server/utils/prisma/client'
import { putPrivate, getPrivate, removeBlobs } from '@/server/utils/blob-storage'
import { ProjectPhotoService } from '@/server/services/ProjectPhotoService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
const blob = {
  put: putPrivate as unknown as ReturnType<typeof vi.fn>,
  get: getPrivate as unknown as ReturnType<typeof vi.fn>,
  remove: removeBlobs as unknown as ReturnType<typeof vi.fn>,
}

const jpeg = (size = 10): Buffer => {
  const data = Buffer.alloc(size)
  data[0] = 0xff; data[1] = 0xd8; data[2] = 0xff
  return data
}
const upload = (overrides: Record<string, unknown> = {}) => ({ full: jpeg(), thumb: jpeg(), width: 2000, height: 1500, ...overrides })

describe('ProjectPhotoService', () => {
  let service: ProjectPhotoService
  beforeEach(() => {
    service = new ProjectPhotoService()
    vi.clearAllMocks()
    blob.put.mockResolvedValue(undefined)
    blob.remove.mockResolvedValue(undefined)
  })

  describe('add', () => {
    it('returns 404 for a project in another household or a deleted project, and stores nothing', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('rejects the 11th photo', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ position: i })))
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toMatchObject({
        statusCode: 409, message: 'This project already has 10 photos',
      })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('rejects a file that is not a JPEG before writing anything', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
      await expect(service.add('h1', 'p1', 'u1', upload({ full: png }))).rejects.toMatchObject({
        statusCode: 400, message: 'Only JPEG photos are accepted',
      })
      await expect(service.add('h1', 'p1', 'u1', upload({ thumb: Buffer.from('hello world') }))).rejects.toMatchObject({ statusCode: 400 })
      await expect(service.add('h1', 'p1', 'u1', upload({ full: Buffer.alloc(0) }))).rejects.toMatchObject({ statusCode: 400 })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('rejects an oversized full image or thumbnail', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      await expect(service.add('h1', 'p1', 'u1', upload({ full: jpeg(3 * 1024 * 1024 + 1) }))).rejects.toMatchObject({
        statusCode: 413, message: 'Photo is too large',
      })
      await expect(service.add('h1', 'p1', 'u1', upload({ thumb: jpeg(200 * 1024 + 1) }))).rejects.toMatchObject({ statusCode: 413 })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('accepts images exactly at the size limits', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      await expect(service.add('h1', 'p1', 'u1', upload({ full: jpeg(3 * 1024 * 1024), thumb: jpeg(200 * 1024) }))).resolves.toBeTruthy()
    })

    it('writes both blobs under the household and project, then the row, at the next position', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([{ position: 0 }, { position: 4 }])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      const result = await service.add('h1', 'p1', 'u1', upload())

      const data = db.projectPhoto.create.mock.calls[0][0].data
      expect(data.position).toBe(5)
      expect(data.projectId).toBe('p1')
      expect(data.uploadedById).toBe('u1')
      expect(data.fullPath).toBe(`households/h1/projects/p1/${data.id}-full.jpg`)
      expect(data.thumbPath).toBe(`households/h1/projects/p1/${data.id}-thumb.jpg`)
      expect(blob.put.mock.calls.map((c) => c[0])).toEqual([data.fullPath, data.thumbPath])
      expect(result).toEqual({ id: data.id, width: 2000, height: 1500, position: 5 })
    })

    it('gives the first photo position 0', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      expect((await service.add('h1', 'p1', 'u1', upload())).position).toBe(0)
    })

    it('removes both blobs when the row cannot be created', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockRejectedValue(new Error('db down'))
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toThrow('db down')
      const removed = blob.remove.mock.calls[0][0] as string[]
      expect(removed).toHaveLength(2)
      expect(removed[0]).toMatch(/-full\.jpg$/)
      expect(removed[1]).toMatch(/-thumb\.jpg$/)
    })

    it('returns 502 and creates no row when storage fails, cleaning up a partial write', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      blob.put.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('blob down'))
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toMatchObject({ statusCode: 502 })
      expect(db.projectPhoto.create).not.toHaveBeenCalled()
      expect(blob.remove).toHaveBeenCalled()
    })
  })

  describe('read', () => {
    it('returns 404 for another household, another project, or a deleted project, without touching storage', async () => {
      db.projectPhoto.findFirst.mockResolvedValue(null)
      await expect(service.read('h1', 'p1', 'ph1', 'full')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectPhoto.findFirst.mock.calls[0][0].where).toEqual({
        id: 'ph1', projectId: 'p1', project: { householdId: 'h1', metaStatus: 'active' },
      })
      expect(blob.get).not.toHaveBeenCalled()
    })

    it('reads the pathname stored on the row for the requested variant', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.get.mockResolvedValue({ statusCode: 200, stream: null, etag: '"e"' })
      await service.read('h1', 'p1', 'ph1', 'thumb', '"e"')
      expect(blob.get).toHaveBeenCalledWith('T.jpg', '"e"')
      await service.read('h1', 'p1', 'ph1', 'full')
      expect(blob.get).toHaveBeenLastCalledWith('F.jpg', undefined)
    })

    it('returns 404 when the row exists but the blob is gone', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.get.mockResolvedValue(null)
      await expect(service.read('h1', 'p1', 'ph1', 'full')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns 502 when storage is unavailable', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.get.mockRejectedValue(new Error('blob down'))
      await expect(service.read('h1', 'p1', 'ph1', 'full')).rejects.toMatchObject({ statusCode: 502 })
    })
  })

  describe('remove', () => {
    it('returns 404 for another household and deletes nothing', async () => {
      db.projectPhoto.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'p1', 'ph1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectPhoto.delete).not.toHaveBeenCalled()
      expect(blob.remove).not.toHaveBeenCalled()
    })

    it('deletes the row and both blobs', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      await service.remove('h1', 'p1', 'ph1')
      expect(db.projectPhoto.delete).toHaveBeenCalledWith({ where: { id: 'ph1' } })
      expect(blob.remove).toHaveBeenCalledWith(['F.jpg', 'T.jpg'])
    })

    it('still succeeds when blob removal fails after the row is gone', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.remove.mockRejectedValue(new Error('blob down'))
      await expect(service.remove('h1', 'p1', 'ph1')).resolves.toBeUndefined()
      expect(db.projectPhoto.delete).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 7: Run to verify failure**

Run: `npx vitest run tests/unit/services/project-photo-service.test.ts`
Expected: FAIL, cannot resolve `@/server/services/ProjectPhotoService`.

- [ ] **Step 8: Create `server/services/ProjectPhotoService.ts`**

```ts
import { randomUUID } from 'node:crypto';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { getPrivate, putPrivate, removeBlobs, type PrivateBlobRead } from '@/server/utils/blob-storage';
import {
  MAX_FULL_PHOTO_BYTES,
  MAX_PROJECT_PHOTOS,
  MAX_THUMB_PHOTO_BYTES,
  type PhotoVariant,
  type ProjectPhotoDto,
} from '@/types/project';

export interface PhotoUpload {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const isJpeg = (data: Buffer): boolean =>
  data.length >= JPEG_MAGIC.length && JPEG_MAGIC.every((byte, i) => data[i] === byte);

export class ProjectPhotoService {
  async add(householdId: string, projectId: string, userId: string, upload: PhotoUpload): Promise<ProjectPhotoDto> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);

    const existing = await prisma.projectPhoto.findMany({ where: { projectId }, select: { position: true } });
    if (existing.length >= MAX_PROJECT_PHOTOS) {
      throw new HttpError(`This project already has ${MAX_PROJECT_PHOTOS} photos`, 409);
    }
    if (!isJpeg(upload.full) || !isJpeg(upload.thumb)) {
      throw new HttpError('Only JPEG photos are accepted', 400);
    }
    if (upload.full.length > MAX_FULL_PHOTO_BYTES || upload.thumb.length > MAX_THUMB_PHOTO_BYTES) {
      throw new HttpError('Photo is too large', 413);
    }

    const id = randomUUID();
    const base = `households/${householdId}/projects/${projectId}/${id}`;
    const fullPath = `${base}-full.jpg`;
    const thumbPath = `${base}-thumb.jpg`;
    const position = existing.reduce((max, photo) => Math.max(max, photo.position), -1) + 1;

    try {
      await putPrivate(fullPath, upload.full);
      await putPrivate(thumbPath, upload.thumb);
    } catch (error) {
      console.error('[ProjectPhotoService] storing photo failed:', error);
      await this.cleanUp([fullPath, thumbPath]);
      throw new HttpError('Photo storage is unavailable. Try again.', 502);
    }

    try {
      const photo = await prisma.projectPhoto.create({
        data: { id, projectId, fullPath, thumbPath, width: upload.width, height: upload.height, position, uploadedById: userId },
      });
      return { id: photo.id, width: photo.width, height: photo.height, position: photo.position };
    } catch (error) {
      await this.cleanUp([fullPath, thumbPath]);
      throw error;
    }
  }

  async read(
    householdId: string,
    projectId: string,
    photoId: string,
    variant: PhotoVariant,
    ifNoneMatch?: string,
  ): Promise<PrivateBlobRead> {
    const photo = await this.requirePhoto(householdId, projectId, photoId);
    const pathname = variant === 'thumb' ? photo.thumbPath : photo.fullPath;
    let result: PrivateBlobRead | null;
    try {
      result = await getPrivate(pathname, ifNoneMatch);
    } catch (error) {
      console.error('[ProjectPhotoService] reading photo failed:', error);
      throw new HttpError('Photo storage is unavailable. Try again.', 502);
    }
    if (!result) throw new HttpError('Photo not found', 404);
    return result;
  }

  async remove(householdId: string, projectId: string, photoId: string): Promise<void> {
    const photo = await this.requirePhoto(householdId, projectId, photoId);
    await prisma.projectPhoto.delete({ where: { id: photo.id } });
    await this.cleanUp([photo.fullPath, photo.thumbPath]);
  }

  // Best effort: an orphaned blob is unreachable (no row points at it), so a failure here must not fail the request.
  private async cleanUp(pathnames: string[]): Promise<void> {
    try {
      await removeBlobs(pathnames);
    } catch (error) {
      console.error('[ProjectPhotoService] removing blobs failed:', pathnames, error);
    }
  }

  private async requirePhoto(householdId: string, projectId: string, photoId: string) {
    const photo = await prisma.projectPhoto.findFirst({
      where: { id: photoId, projectId, project: { householdId, metaStatus: 'active' } },
    });
    if (!photo) throw new HttpError('Photo not found', 404);
    return photo;
  }
}
```

- [ ] **Step 9: Run to verify the service tests pass, then the whole suite**

Run: `npx vitest run tests/unit/services/project-photo-service.test.ts`
Expected: PASS, 16 tests.

Run: `npx vitest run`
Expected: every test passes; no previously passing test fails.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json server/utils/blob-storage.ts server/services/ProjectPhotoService.ts tests/unit/utils/blob-storage.test.ts tests/unit/services/project-photo-service.test.ts
git commit -m "feat: private photo storage wrapper and ProjectPhotoService"
```

---

### Task 4: API routes

**Files:**
- Create: `server/api/projects/index.get.ts`
- Create: `server/api/projects/index.post.ts`
- Create: `server/api/projects/locations.get.ts`
- Create: `server/api/projects/[id].get.ts`
- Create: `server/api/projects/[id].put.ts`
- Create: `server/api/projects/[id].delete.ts`
- Create: `server/api/projects/[id]/photos.post.ts`
- Create: `server/api/projects/[id]/photos/[photoId].get.ts`
- Create: `server/api/projects/[id]/photos/[photoId].delete.ts`

**Interfaces:**
- Consumes: `ProjectService` (Task 2), `ProjectPhotoService` (Task 3), schemas and filter parsers (Task 1), `defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => ...)` from `@/server/utils/auth` (`authUser.userId` is the user id), `HttpError` and `toHttpError(error, context)` from `@/server/utils/api-errors`.
- Produces: the HTTP routes in the spec's API table. `POST /api/projects` returns `{ id }`. `POST /api/projects/:id/photos` expects multipart fields `full` (file), `thumb` (file), `width`, `height` and returns a `ProjectPhotoDto`. `GET .../photos/:photoId?variant=thumb|full` returns JPEG bytes.

These routes are thin and this repo has no route-level tests (see `server/api/providers/`). They are verified by type checking and by the reviewer reading them against the spec. They are **not** exercised against a running server in this task, because the migration is not applied yet.

- [ ] **Step 1: List and create**

`server/api/projects/index.get.ts`:

```ts
import { getQuery } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { parsePathFilter, parseStatusFilter } from "@/server/utils/project-schemas";
import { toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const q = getQuery(event);
    return await new ProjectService().list(householdId, {
      statuses: parseStatusFilter(q.status),
      path: parsePathFilter(q.path),
    });
  } catch (error) {
    return toHttpError(error, 'listing projects');
  }
});
```

`server/api/projects/index.post.ts`:

```ts
import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { projectCreateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const parsed = projectCreateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectService().create(householdId, authUser.userId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'creating project');
  }
});
```

- [ ] **Step 2: Locations, get, update, delete**

`server/api/projects/locations.get.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (_event, _authUser, householdId) => {
  try {
    return await new ProjectService().locations(householdId);
  } catch (error) {
    return toHttpError(error, 'listing project locations');
  }
});
```

`server/api/projects/[id].get.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Project ID is required', 400);
    return await new ProjectService().get(householdId, id);
  } catch (error) {
    return toHttpError(error, 'loading project');
  }
});
```

`server/api/projects/[id].put.ts`:

```ts
import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { projectUpdateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Project ID is required', 400);
    const parsed = projectUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectService().update(householdId, id, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating project');
  }
});
```

`server/api/projects/[id].delete.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Project ID is required', 400);
    await new ProjectService().softDelete(householdId, id);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting project');
  }
});
```

- [ ] **Step 3: Photo upload**

`server/api/projects/[id]/photos.post.ts`:

```ts
import { readMultipartFormData } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPhotoService } from "@/server/services/ProjectPhotoService";
import { photoDimensionsSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);

    const parts = (await readMultipartFormData(event)) ?? [];
    const part = (name: string) => parts.find((p) => p.name === name);
    const full = part('full')?.data;
    const thumb = part('thumb')?.data;
    if (!full || !thumb) throw new HttpError('Both the photo and its thumbnail are required', 400);

    const dimensions = photoDimensionsSchema.safeParse({
      width: part('width')?.data.toString('utf8'),
      height: part('height')?.data.toString('utf8'),
    });
    if (!dimensions.success) throw new HttpError('Photo width and height are required', 400);

    return await new ProjectPhotoService().add(householdId, projectId, authUser.userId, {
      full,
      thumb,
      width: dimensions.data.width,
      height: dimensions.data.height,
    });
  } catch (error) {
    return toHttpError(error, 'uploading project photo');
  }
});
```

- [ ] **Step 4: Photo serve and delete**

`server/api/projects/[id]/photos/[photoId].get.ts`:

```ts
import { getHeader, getQuery, sendNoContent, setResponseHeader } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPhotoService } from "@/server/services/ProjectPhotoService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { type PhotoVariant } from "@/types/project";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const photoId = event.context.params?.photoId;
    if (!projectId || !photoId) throw new HttpError('Project ID and photo ID are required', 400);

    const variant: PhotoVariant = getQuery(event).variant === 'thumb' ? 'thumb' : 'full';
    const result = await new ProjectPhotoService().read(
      householdId, projectId, photoId, variant, getHeader(event, 'if-none-match') ?? undefined,
    );

    // The auth check above runs on every request; 'private, no-cache' lets the browser keep the bytes but always revalidate.
    setResponseHeader(event, 'Cache-Control', 'private, no-cache');
    setResponseHeader(event, 'ETag', result.etag);
    if (result.statusCode === 304 || !result.stream) return sendNoContent(event, 304);

    setResponseHeader(event, 'Content-Type', 'image/jpeg');
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
    return result.stream;
  } catch (error) {
    return toHttpError(error, 'loading project photo');
  }
});
```

`server/api/projects/[id]/photos/[photoId].delete.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPhotoService } from "@/server/services/ProjectPhotoService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const photoId = event.context.params?.photoId;
    if (!projectId || !photoId) throw new HttpError('Project ID and photo ID are required', 400);
    await new ProjectPhotoService().remove(householdId, projectId, photoId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting project photo');
  }
});
```

- [ ] **Step 5: Type check and run the suite**

Run: `npx nuxi typecheck`
Expected: no errors that mention a file under `server/api/projects/`, `server/services/Project*`, `server/utils/project-schemas.ts`, `server/utils/blob-storage.ts` or `types/project.ts`. If the command reports errors in files this plan does not touch, list them in your report as pre-existing and do not fix them. If `nuxi typecheck` cannot run at all (for example `vue-tsc` is not installed), say so in your report and do not install anything.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/api/projects
git commit -m "feat: project and project photo API routes"
```

---

### Task 5: Client plumbing (resize, API client, composable, image component)

**Files:**
- Create: `utils/image-resize.ts`
- Create: `utils/project-labels.ts`
- Modify: `utils/api.ts` (add `upload`, export it from the returned object)
- Create: `composables/useProjects.ts`
- Create: `components/projects/AuthedImage.vue`
- Test: `tests/unit/utils/image-resize.test.ts`

**Interfaces:**
- Consumes: the routes from Task 4; types from `@/types/project`; `useApi()` from `@/utils/api` (its `get<T>(endpoint, { params })` returns the raw `Response` when the response is not JSON).
- Produces:
  - `utils/image-resize.ts`: `interface Size { width: number; height: number }`, `FULL_MAX_EDGE = 2000`, `THUMB_MAX_EDGE = 400`, `fitWithin(size: Size, maxEdge: number): Size`, `interface ResizedPhoto { full: Blob; thumb: Blob; width: number; height: number }`, `resizePhoto(file: File): Promise<ResizedPhoto>`.
  - `utils/project-labels.ts`: `STATUS_LABELS: Record<ProjectStatus, string>`, `PATH_LABELS: Record<ProjectPath, string>`, `statusBadgeClass(status: ProjectStatus): string`.
  - `useApi().upload<T>(endpoint: string, form: FormData): Promise<T>`.
  - `useProjects()` returning `listProjects(filters)`, `getProject(id)`, `createProject(input)`, `updateProject(id, input)`, `deleteProject(id)`, `listLocations()`, `uploadPhoto(projectId, resized)`, `deletePhoto(projectId, photoId)`, `fetchPhotoBlob(projectId, photoId, variant)`.
  - `<AuthedImage :project-id :photo-id :variant alt />`.

- [ ] **Step 1: Write the failing resize tests**

Create `tests/unit/utils/image-resize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fitWithin, FULL_MAX_EDGE, THUMB_MAX_EDGE } from '@/utils/image-resize'

describe('fitWithin', () => {
  it('scales a landscape photo so the long side is the maximum', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, FULL_MAX_EDGE)).toEqual({ width: 2000, height: 1500 })
  })

  it('scales a portrait photo so the long side is the maximum', () => {
    expect(fitWithin({ width: 3024, height: 4032 }, FULL_MAX_EDGE)).toEqual({ width: 1500, height: 2000 })
  })

  it('leaves an image that already fits untouched', () => {
    expect(fitWithin({ width: 800, height: 600 }, FULL_MAX_EDGE)).toEqual({ width: 800, height: 600 })
    expect(fitWithin({ width: 2000, height: 1000 }, FULL_MAX_EDGE)).toEqual({ width: 2000, height: 1000 })
  })

  it('makes thumbnails at the smaller edge', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, THUMB_MAX_EDGE)).toEqual({ width: 400, height: 300 })
  })

  it('never returns a zero dimension for an extreme panorama', () => {
    expect(fitWithin({ width: 20000, height: 10 }, THUMB_MAX_EDGE)).toEqual({ width: 400, height: 1 })
  })

  it('handles a square image', () => {
    expect(fitWithin({ width: 3000, height: 3000 }, FULL_MAX_EDGE)).toEqual({ width: 2000, height: 2000 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/utils/image-resize.test.ts`
Expected: FAIL, cannot resolve `@/utils/image-resize`.

- [ ] **Step 3: Create `utils/image-resize.ts`**

```ts
export interface Size {
  width: number;
  height: number;
}

export interface ResizedPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export const FULL_MAX_EDGE = 2000;
export const THUMB_MAX_EDGE = 400;
const FULL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

export const fitWithin = (size: Size, maxEdge: number): Size => {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge) return { width: size.width, height: size.height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
};

const encodeJpeg = (bitmap: ImageBitmap, size: Size, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Could not process this photo'));
      return;
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process this photo'))),
      'image/jpeg',
      quality,
    );
  });

// Shrinks a picked image in the browser and re-encodes it as JPEG, so uploads stay small on cellular data.
export const resizePhoto = async (file: File): Promise<ResizedPhoto> => {
  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the EXIF rotation phones record, so portrait photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Could not read this file as a photo');
  }
  try {
    const fullSize = fitWithin(bitmap, FULL_MAX_EDGE);
    const thumbSize = fitWithin(bitmap, THUMB_MAX_EDGE);
    const full = await encodeJpeg(bitmap, fullSize, FULL_QUALITY);
    const thumb = await encodeJpeg(bitmap, thumbSize, THUMB_QUALITY);
    return { full, thumb, width: fullSize.width, height: fullSize.height };
  } finally {
    bitmap.close();
  }
};
```

- [ ] **Step 4: Run to verify the resize tests pass**

Run: `npx vitest run tests/unit/utils/image-resize.test.ts`
Expected: PASS, 6 tests. (`resizePhoto` itself needs a real browser canvas and is not unit-tested.)

- [ ] **Step 5: Create `utils/project-labels.ts`**

```ts
import { type ProjectPath, type ProjectStatus } from '@/types/project';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  future: 'Future',
  done: 'Done',
};

export const PATH_LABELS: Record<ProjectPath, string> = {
  diy: 'DIY',
  hire: 'Hire',
  unsure: 'Not sure',
};

export const statusBadgeClass = (status: ProjectStatus): string => {
  if (status === 'active') return 'bg-amber-100 text-amber-800';
  if (status === 'done') return 'bg-green-100 text-green-800';
  return 'bg-stone-100 text-stone-700';
};
```

- [ ] **Step 6: Add `upload` to `utils/api.ts`**

`apiFetch` forces `Content-Type: application/json`, which breaks multipart bodies. Add this function inside `useApi`, directly above the `return {` statement:

```ts
  // Multipart upload. The browser must set the Content-Type itself so it can add the boundary.
  const upload = async <T>(endpoint: string, form: FormData): Promise<T> => {
    const headers = new Headers();
    if (authStore.accessToken) {
      headers.set("Authorization", `Bearer ${authStore.accessToken}`);
    }
    const response = await fetch(new URL(endpoint, window.location.origin).toString(), {
      method: "POST",
      body: form,
      headers,
    });
    if (response.status === 401) {
      authStore.logout();
      window.location.href = "/login";
      throw new Error("Authentication required");
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message || `Upload failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  };
```

And add `upload,` to the returned object, after `patch,`.

- [ ] **Step 7: Create `composables/useProjects.ts`**

```ts
import {
  type PhotoVariant,
  type ProjectCreateInput,
  type ProjectDetail,
  type ProjectListFilters,
  type ProjectListItem,
  type ProjectPhotoDto,
  type ProjectUpdateInput,
} from '@/types/project';
import { type ResizedPhoto } from '@/utils/image-resize';

export const useProjects = () => {
  const api = useApi();

  const listProjects = (filters: ProjectListFilters = {}) => {
    const params: Record<string, string> = {};
    if (filters.statuses?.length) params.status = filters.statuses.join(',');
    if (filters.path) params.path = filters.path;
    return api.get<ProjectListItem[]>('/api/projects', { params });
  };

  const getProject = (id: string) => api.get<ProjectDetail>(`/api/projects/${id}`);
  const createProject = (input: ProjectCreateInput) => api.post<{ id: string }>('/api/projects', input);
  const updateProject = (id: string, input: ProjectUpdateInput) =>
    api.put<ProjectDetail>(`/api/projects/${id}`, input);
  const deleteProject = (id: string) => api.delete(`/api/projects/${id}`);
  const listLocations = () => api.get<string[]>('/api/projects/locations');

  const uploadPhoto = (projectId: string, photo: ResizedPhoto) => {
    const form = new FormData();
    form.append('full', photo.full, 'full.jpg');
    form.append('thumb', photo.thumb, 'thumb.jpg');
    form.append('width', String(photo.width));
    form.append('height', String(photo.height));
    return api.upload<ProjectPhotoDto>(`/api/projects/${projectId}/photos`, form);
  };

  const deletePhoto = (projectId: string, photoId: string) =>
    api.delete(`/api/projects/${projectId}/photos/${photoId}`);

  // Photos are private, so they are fetched with the auth header and shown from an object URL.
  const fetchPhotoBlob = async (projectId: string, photoId: string, variant: PhotoVariant): Promise<Blob> => {
    const response = await api.get<Response>(`/api/projects/${projectId}/photos/${photoId}`, { params: { variant } });
    return response.blob();
  };

  return {
    listProjects, getProject, createProject, updateProject, deleteProject, listLocations,
    uploadPhoto, deletePhoto, fetchPhotoBlob,
  };
};
```

- [ ] **Step 8: Create `components/projects/AuthedImage.vue`**

```vue
<template>
  <img v-if="src" :src="src" :alt="alt" class="w-full h-full object-cover">
  <div v-else class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 text-xs">
    {{ failed ? 'Photo unavailable' : '' }}
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { type PhotoVariant } from '@/types/project';
import { useProjects } from '@/composables/useProjects';

const props = withDefaults(defineProps<{
  projectId: string;
  photoId: string;
  variant?: PhotoVariant;
  alt?: string;
}>(), { variant: 'thumb', alt: '' });

const { fetchPhotoBlob } = useProjects();

const src = ref<string | null>(null);
const failed = ref(false);
let latestRequest = 0;

const release = (): void => {
  if (src.value) URL.revokeObjectURL(src.value);
  src.value = null;
};

const load = async (): Promise<void> => {
  const request = ++latestRequest;
  failed.value = false;
  try {
    const blob = await fetchPhotoBlob(props.projectId, props.photoId, props.variant);
    // A newer request (or unmount) superseded this one; drop the result.
    if (request !== latestRequest) return;
    release();
    src.value = URL.createObjectURL(blob);
  } catch {
    if (request !== latestRequest) return;
    release();
    failed.value = true;
  }
};

watch(() => [props.projectId, props.photoId, props.variant], load, { immediate: true });

onBeforeUnmount(() => {
  latestRequest++;
  release();
});
</script>
```

- [ ] **Step 9: Type check, run the suite, commit**

Run: `npx nuxi typecheck` (same expectations as Task 4 Step 5, now also covering `utils/image-resize.ts`, `utils/project-labels.ts`, `utils/api.ts`, `composables/useProjects.ts`, `components/projects/AuthedImage.vue`).

Run: `npx vitest run`
Expected: all tests pass.

```bash
git add utils/image-resize.ts utils/project-labels.ts utils/api.ts composables/useProjects.ts components/projects/AuthedImage.vue tests/unit/utils/image-resize.test.ts
git commit -m "feat: client-side photo resize, upload client, and private image component"
```

---

### Task 6: Projects list page and nav link

**Files:**
- Create: `pages/projects/index.vue`
- Modify: `layouts/default.vue` (desktop link after the Providers link near line 44-50; mobile link after the Providers link near line 151-158)

**Interfaces:**
- Consumes: `useProjects().listProjects({ statuses, path })`, `AuthedImage`, `STATUS_LABELS`, `PATH_LABELS`, `statusBadgeClass`, types from `@/types/project`.
- Produces: the `/projects` page, linking to `/projects/new` and `/projects/:id`.

Not unit-tested. Read `pages/providers/index.vue` first and match its structure and classes.

- [ ] **Step 1: Create `pages/projects/index.vue`**

```vue
<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-wrap justify-between items-center gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-stone-900 font-heading">Projects</h1>
        <p class="text-stone-600 mt-1">Things to fix, improve or build around the house</p>
      </div>
      <NuxtLink to="/projects/new"
                class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
        <Plus :size="16" />New project
      </NuxtLink>
    </div>

    <!-- Toolbar -->
    <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 mb-6 flex flex-wrap items-center gap-4">
      <select v-model="path"
              aria-label="Path"
              class="rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
        <option value="">All paths</option>
        <option value="diy">DIY</option>
        <option value="hire">Hire</option>
        <option value="unsure">Not sure</option>
        <option value="none">Needs details</option>
      </select>
      <label class="inline-flex items-center gap-2 text-sm text-stone-700">
        <input v-model="showAll" type="checkbox" class="rounded border-stone-300 text-amber-600 focus:ring-amber-500">
        Show future and done
      </label>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
      {{ error }}
    </div>

    <!-- Loading State -->
    <div v-else-if="loading && projects.length === 0" class="text-center py-8">
      <p class="text-stone-600">Loading projects...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="projects.length === 0"
         class="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
      <p class="text-stone-700">
        {{ hasActiveFilter ? 'No projects match these filters.' : 'No projects yet. Capture the first one.' }}
      </p>
      <NuxtLink v-if="!hasActiveFilter" to="/projects/new"
                class="inline-flex items-center gap-1.5 mt-4 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
        <Plus :size="16" />New project
      </NuxtLink>
    </div>

    <!-- List -->
    <ul v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <li v-for="project in projects" :key="project.id">
        <NuxtLink :to="`/projects/${project.id}`"
                  class="block bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden hover:border-amber-400 transition-colors">
          <div class="aspect-[4/3] bg-stone-100">
            <AuthedImage v-if="project.coverPhotoId"
                         :project-id="project.id"
                         :photo-id="project.coverPhotoId"
                         variant="thumb"
                         :alt="project.title" />
            <div v-else class="w-full h-full flex items-center justify-center text-stone-400">
              <ImageOff :size="28" aria-hidden="true" />
            </div>
          </div>
          <div class="p-4">
            <h2 class="font-medium text-stone-900 break-words">{{ project.title }}</h2>
            <p v-if="project.location" class="text-sm text-stone-600 mt-0.5">{{ project.location }}</p>
            <div class="flex flex-wrap items-center gap-2 mt-3">
              <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="statusBadgeClass(project.status)">
                {{ STATUS_LABELS[project.status] }}
              </span>
              <span v-if="project.path" class="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                {{ PATH_LABELS[project.path] }}
              </span>
              <span v-else class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Needs details
              </span>
              <span v-if="project.photoCount > 1" class="text-xs text-stone-500">{{ project.photoCount }} photos</span>
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Plus, ImageOff } from 'lucide-vue-next';
import {
  PROJECT_STATUSES,
  type ProjectListItem,
  type ProjectPathFilter,
  type ProjectStatus,
} from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { PATH_LABELS, STATUS_LABELS, statusBadgeClass } from '@/utils/project-labels';
import AuthedImage from '@/components/projects/AuthedImage.vue';

const { listProjects } = useProjects();

const projects = ref<ProjectListItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const path = ref<ProjectPathFilter | ''>('');
const showAll = ref(false);
const hasActiveFilter = computed(() => path.value !== '' || showAll.value);

// Ignore a slow response that arrives after a newer filter change.
let latestRequestId = 0;

const loadProjects = async (): Promise<void> => {
  const requestId = ++latestRequestId;
  loading.value = true;
  try {
    const statuses: ProjectStatus[] | undefined = showAll.value ? [...PROJECT_STATUSES] : undefined;
    const result = await listProjects({ statuses, path: path.value || undefined });
    if (requestId !== latestRequestId) return;
    projects.value = result;
    error.value = null;
  } catch (e) {
    if (requestId !== latestRequestId) return;
    error.value = e instanceof Error ? e.message : 'Failed to load projects';
  } finally {
    if (requestId === latestRequestId) loading.value = false;
  }
};

watch([path, showAll], loadProjects);
onMounted(loadProjects);
</script>
```

- [ ] **Step 2: Add the nav links in `layouts/default.vue`**

Directly after the desktop Providers `NuxtLink` (the one with `to="/providers"` and `border-b-2` classes), add:

```vue
              <NuxtLink
                to="/projects"
                class="inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-150"
                :class="route.path.startsWith('/projects') ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'"
              >
                Projects
              </NuxtLink>
```

Directly after the mobile Providers `NuxtLink` (the one with `to="/providers"` and `block px-3 py-2`), add:

```vue
        <NuxtLink
          to="/projects"
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150"
          :class="route.path.startsWith('/projects') ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
          @click="showMobileMenu = false"
        >
          Projects
        </NuxtLink>
```

Confirm both links are inside `layouts/default.vue` and that this layout is the one the Providers page actually renders with (an earlier Providers link was once added to a dead component). Search the repo for any other nav that lists Providers: `grep -rn 'to="/providers"' layouts components` and report what you find.

- [ ] **Step 3: Type check, run the suite, commit**

Run: `npx nuxi typecheck` and `npx vitest run` (same expectations as before).

```bash
git add pages/projects/index.vue layouts/default.vue
git commit -m "feat: projects list page and nav link"
```

---

### Task 7: New project page and photo uploader

**Files:**
- Create: `components/projects/PhotoUploader.vue`
- Create: `pages/projects/new.vue`

**Interfaces:**
- Consumes: `useProjects().createProject`, `listLocations`, `uploadPhoto`; `resizePhoto` from `@/utils/image-resize`; `MAX_PROJECT_PHOTOS`, `ProjectPhotoDto` from `@/types/project`.
- Produces: `<PhotoUploader :remaining="number" :project-id="string | undefined" :auto-upload="boolean" @uploaded="(photo: ProjectPhotoDto) => void" />` with an exposed method `uploadAll(projectId: string): Promise<boolean>` (true when every picked photo is uploaded) and exposed ref `hasPending: boolean`. Task 8 uses the same component with `auto-upload`.

Not unit-tested.

- [ ] **Step 1: Create `components/projects/PhotoUploader.vue`**

```vue
<template>
  <div>
    <ul v-if="items.length" class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
      <li v-for="item in items" :key="item.key" class="relative">
        <img :src="item.previewUrl" alt="" class="w-full aspect-square object-cover rounded-lg border border-stone-200">
        <span class="absolute bottom-1 left-1 text-xs font-medium px-1.5 py-0.5 rounded bg-white/90"
              :class="item.state === 'failed' ? 'text-red-700' : 'text-stone-700'">
          {{ STATE_LABELS[item.state] }}
        </span>
        <button v-if="item.state === 'waiting' || item.state === 'failed'"
                type="button"
                class="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-stone-700 text-sm leading-none hover:bg-white"
                aria-label="Remove photo"
                @click="removeItem(item.key)">
          &times;
        </button>
        <button v-if="item.state === 'failed' && targetProjectId"
                type="button"
                class="mt-1 w-full text-xs font-medium text-amber-700 hover:text-amber-800"
                @click="retry(item.key)">
          Retry
        </button>
        <p v-if="item.error" class="mt-1 text-xs text-red-700 break-words">{{ item.error }}</p>
      </li>
    </ul>

    <label v-if="roomLeft > 0"
           class="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 transition-colors cursor-pointer">
      <Camera :size="16" />Add photo
      <input type="file" accept="image/*" multiple class="sr-only" @change="onPick">
    </label>
    <p v-else class="text-sm text-stone-600">This project has the maximum of {{ MAX_PROJECT_PHOTOS }} photos.</p>
    <p v-if="notice" class="mt-2 text-sm text-stone-600">{{ notice }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import { Camera } from 'lucide-vue-next';
import { MAX_PROJECT_PHOTOS, type ProjectPhotoDto } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { resizePhoto } from '@/utils/image-resize';

type UploadState = 'waiting' | 'uploading' | 'done' | 'failed';

interface UploadItem {
  key: number;
  file: File;
  previewUrl: string;
  state: UploadState;
  error: string | null;
}

const STATE_LABELS: Record<UploadState, string> = {
  waiting: 'Ready',
  uploading: 'Uploading...',
  done: 'Uploaded',
  failed: 'Failed',
};

const props = withDefaults(defineProps<{
  // How many more photos the project can take, not counting ones picked here.
  remaining: number;
  projectId?: string;
  // Upload as soon as photos are picked (used on an existing project).
  autoUpload?: boolean;
}>(), { projectId: undefined, autoUpload: false });

const emit = defineEmits<{ uploaded: [photo: ProjectPhotoDto] }>();

const { uploadPhoto } = useProjects();

const items = ref<UploadItem[]>([]);
const notice = ref<string | null>(null);
const targetProjectId = ref<string | null>(props.projectId ?? null);
let nextKey = 0;

const unsent = computed(() => items.value.filter((item) => item.state !== 'done'));
const roomLeft = computed(() => props.remaining - unsent.value.length);
const hasPending = computed(() => unsent.value.length > 0);

const uploadOne = async (item: UploadItem, projectId: string): Promise<void> => {
  item.state = 'uploading';
  item.error = null;
  try {
    const resized = await resizePhoto(item.file);
    const photo = await uploadPhoto(projectId, resized);
    item.state = 'done';
    emit('uploaded', photo);
  } catch (e) {
    item.state = 'failed';
    item.error = e instanceof Error ? e.message : 'Upload failed';
  }
};

// One at a time: phone uploads on cellular data are more reliable in sequence, and photo order is kept.
const uploadAll = async (projectId: string): Promise<boolean> => {
  targetProjectId.value = projectId;
  for (const item of items.value) {
    if (item.state === 'waiting' || item.state === 'failed') await uploadOne(item, projectId);
  }
  const allDone = items.value.every((item) => item.state === 'done');
  if (props.autoUpload) clearDone();
  return allDone;
};

const clearDone = (): void => {
  for (const item of items.value) {
    if (item.state === 'done') URL.revokeObjectURL(item.previewUrl);
  }
  items.value = items.value.filter((item) => item.state !== 'done');
};

const onPick = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  // Reset so picking the same file again still fires a change event.
  input.value = '';
  notice.value = null;
  const room = Math.max(0, roomLeft.value);
  if (files.length > room) {
    notice.value = `Only ${room} more photo${room === 1 ? '' : 's'} can be added (limit ${MAX_PROJECT_PHOTOS}).`;
  }
  for (const file of files.slice(0, room)) {
    items.value.push({ key: nextKey++, file, previewUrl: URL.createObjectURL(file), state: 'waiting', error: null });
  }
  if (props.autoUpload && props.projectId) await uploadAll(props.projectId);
};

const removeItem = (key: number): void => {
  const item = items.value.find((candidate) => candidate.key === key);
  if (item) URL.revokeObjectURL(item.previewUrl);
  items.value = items.value.filter((candidate) => candidate.key !== key);
};

const retry = async (key: number): Promise<void> => {
  const item = items.value.find((candidate) => candidate.key === key);
  if (!item || !targetProjectId.value) return;
  await uploadOne(item, targetProjectId.value);
  if (props.autoUpload) clearDone();
};

onBeforeUnmount(() => {
  for (const item of items.value) URL.revokeObjectURL(item.previewUrl);
});

defineExpose({ uploadAll, hasPending });
</script>
```

- [ ] **Step 2: Create `pages/projects/new.vue`**

```vue
<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <NuxtLink to="/projects" class="text-sm text-amber-700 hover:text-amber-800">&larr; All projects</NuxtLink>
    <h1 class="text-2xl font-bold text-stone-900 font-heading mt-2 mb-6">New project</h1>

    <form class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 space-y-5" @submit.prevent="save">
      <div>
        <label for="project-title" class="block text-sm font-medium text-stone-700">Title</label>
        <input id="project-title"
               v-model="title"
               type="text"
               maxlength="200"
               :disabled="!!createdId"
               placeholder="Paint ceiling blemish spots"
               class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm disabled:bg-stone-50 disabled:text-stone-500">
      </div>

      <div>
        <label for="project-location" class="block text-sm font-medium text-stone-700">Location <span class="font-normal text-stone-500">(optional)</span></label>
        <input id="project-location"
               v-model="location"
               type="text"
               maxlength="100"
               list="project-locations"
               :disabled="!!createdId"
               placeholder="Hallway"
               class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm disabled:bg-stone-50 disabled:text-stone-500">
        <datalist id="project-locations">
          <option v-for="known in locations" :key="known" :value="known" />
        </datalist>
      </div>

      <div>
        <p class="block text-sm font-medium text-stone-700 mb-2">Photos <span class="font-normal text-stone-500">(optional)</span></p>
        <PhotoUploader ref="uploader" :remaining="MAX_PROJECT_PHOTOS" />
      </div>

      <p v-if="error" class="text-sm text-red-700">{{ error }}</p>

      <div v-if="createdId && !saving" class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-stone-700">
        The project is saved, but some photos did not upload. Retry them above, or
        <NuxtLink :to="`/projects/${createdId}`" class="font-medium text-amber-700 hover:text-amber-800">go to the project</NuxtLink>
        and add them later.
      </div>

      <div class="flex items-center gap-3">
        <button type="submit"
                :disabled="saving"
                class="inline-flex items-center bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-60">
          {{ saving ? 'Saving...' : createdId ? 'Retry photos' : 'Save' }}
        </button>
        <NuxtLink v-if="!createdId" to="/projects" class="text-sm text-stone-600 hover:text-stone-900">Cancel</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { MAX_PROJECT_PHOTOS } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import PhotoUploader from '@/components/projects/PhotoUploader.vue';

const { createProject, listLocations } = useProjects();

const title = ref('');
const location = ref('');
const locations = ref<string[]>([]);
const saving = ref(false);
const error = ref<string | null>(null);
// Set once the project exists, so a second Save only retries photos and never creates a duplicate.
const createdId = ref<string | null>(null);
const uploader = ref<InstanceType<typeof PhotoUploader> | null>(null);

const save = async (): Promise<void> => {
  if (saving.value) return;
  error.value = null;
  if (!createdId.value && !title.value.trim()) {
    error.value = 'Title is required';
    return;
  }
  saving.value = true;
  try {
    if (!createdId.value) {
      const created = await createProject({ title: title.value.trim(), location: location.value.trim() || null });
      createdId.value = created.id;
    }
    const allUploaded = uploader.value ? await uploader.value.uploadAll(createdId.value) : true;
    if (allUploaded) await navigateTo(`/projects/${createdId.value}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not save the project';
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  try {
    locations.value = await listLocations();
  } catch {
    // Suggestions are a convenience; the form works without them.
    locations.value = [];
  }
});
</script>
```

- [ ] **Step 3: Type check, run the suite, commit**

Run: `npx nuxi typecheck` and `npx vitest run` (same expectations as before).

```bash
git add components/projects/PhotoUploader.vue pages/projects/new.vue
git commit -m "feat: new project page with photo capture and per-photo retry"
```

---

### Task 8: Project page

**Files:**
- Create: `pages/projects/[id].vue`

**Interfaces:**
- Consumes: `useProjects().getProject`, `updateProject`, `deleteProject`, `deletePhoto`, `listLocations`; `PhotoUploader` (Task 7) with `auto-upload`; `AuthedImage`; `STATUS_LABELS`, `PATH_LABELS`; `MAX_PROJECT_PHOTOS`, `PROJECT_STATUSES`, `PROJECT_PATHS` and types from `@/types/project`.
- Produces: the `/projects/:id` page.

Not unit-tested. `pages/projects/new.vue` exists beside this file; Nuxt matches the static `new` route first, so `/projects/new` never reaches this page.

- [ ] **Step 1: Create `pages/projects/[id].vue`**

```vue
<template>
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <NuxtLink to="/projects" class="text-sm text-amber-700 hover:text-amber-800">&larr; All projects</NuxtLink>

    <div v-if="loadError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      {{ loadError }}
    </div>
    <p v-else-if="!project" class="mt-4 text-stone-600">Loading project...</p>

    <div v-else class="mt-4 space-y-6">
      <!-- Details -->
      <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 space-y-4">
        <div>
          <label for="project-title" class="block text-sm font-medium text-stone-700">Title</label>
          <input id="project-title"
                 v-model="form.title"
                 type="text"
                 maxlength="200"
                 class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                 @change="saveTitle">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label for="project-location" class="block text-sm font-medium text-stone-700">Location</label>
            <input id="project-location"
                   v-model="form.location"
                   type="text"
                   maxlength="100"
                   list="project-locations"
                   class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                   @change="save({ location: form.location.trim() || null })">
            <datalist id="project-locations">
              <option v-for="known in locations" :key="known" :value="known" />
            </datalist>
          </div>
          <div>
            <label for="project-status" class="block text-sm font-medium text-stone-700">Status</label>
            <select id="project-status"
                    v-model="form.status"
                    class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                    @change="save({ status: form.status })">
              <option v-for="status in PROJECT_STATUSES" :key="status" :value="status">{{ STATUS_LABELS[status] }}</option>
            </select>
          </div>
          <div>
            <label for="project-path" class="block text-sm font-medium text-stone-700">Path</label>
            <select id="project-path"
                    v-model="form.path"
                    class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                    @change="save({ path: form.path === '' ? null : form.path })">
              <option value="">Not decided</option>
              <option v-for="path in PROJECT_PATHS" :key="path" :value="path">{{ PATH_LABELS[path] }}</option>
            </select>
          </div>
        </div>

        <div>
          <label for="project-notes" class="block text-sm font-medium text-stone-700">Notes</label>
          <textarea id="project-notes"
                    v-model="form.notes"
                    rows="4"
                    maxlength="5000"
                    class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                    @change="save({ notes: form.notes.trim() || null })" />
        </div>

        <p class="text-sm h-5" :class="saveError ? 'text-red-700' : 'text-stone-500'" aria-live="polite">
          {{ saveError ?? (saving ? 'Saving...' : savedAt ? 'Saved' : '') }}
        </p>
      </section>

      <!-- Photos -->
      <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
        <h2 class="text-lg font-medium text-stone-900 mb-3">Photos</h2>
        <p v-if="project.photos.length === 0" class="text-sm text-stone-600 mb-3">No photos yet.</p>
        <ul v-else class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
          <li v-for="photo in project.photos" :key="photo.id" class="relative">
            <button type="button"
                    class="block w-full aspect-square rounded-lg overflow-hidden border border-stone-200"
                    aria-label="View photo full size"
                    @click="viewing = photo.id">
              <AuthedImage :project-id="project.id" :photo-id="photo.id" variant="thumb" :alt="project.title" />
            </button>
            <button type="button"
                    class="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-stone-700 text-sm leading-none hover:bg-white"
                    aria-label="Remove photo"
                    @click="removePhoto(photo.id)">
              &times;
            </button>
          </li>
        </ul>
        <p v-if="photoError" class="text-sm text-red-700 mb-3">{{ photoError }}</p>
        <PhotoUploader :project-id="project.id"
                       :remaining="MAX_PROJECT_PHOTOS - project.photos.length"
                       auto-upload
                       @uploaded="onUploaded" />
      </section>

      <!-- Danger zone -->
      <section class="flex justify-end">
        <button type="button"
                class="text-sm font-medium text-red-700 hover:text-red-800 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 transition-colors"
                @click="removeProject">
          Delete project
        </button>
      </section>
    </div>

    <!-- Full-size viewer -->
    <div v-if="project && viewing"
         class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
         role="dialog"
         aria-label="Photo"
         @click="viewing = null">
      <div class="max-w-full max-h-full">
        <AuthedImage :project-id="project.id" :photo-id="viewing" variant="full" :alt="project.title"
                     class="!object-contain max-h-[90vh] max-w-full" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import {
  MAX_PROJECT_PHOTOS,
  PROJECT_PATHS,
  PROJECT_STATUSES,
  type ProjectDetail,
  type ProjectPath,
  type ProjectPhotoDto,
  type ProjectStatus,
  type ProjectUpdateInput,
} from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { PATH_LABELS, STATUS_LABELS } from '@/utils/project-labels';
import AuthedImage from '@/components/projects/AuthedImage.vue';
import PhotoUploader from '@/components/projects/PhotoUploader.vue';

const route = useRoute();
const id = computed(() => String(route.params.id));

const { getProject, updateProject, deleteProject, deletePhoto, listLocations } = useProjects();

const project = ref<ProjectDetail | null>(null);
const locations = ref<string[]>([]);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const photoError = ref<string | null>(null);
const saving = ref(false);
const savedAt = ref<number | null>(null);
const viewing = ref<string | null>(null);

const form = reactive<{ title: string; location: string; status: ProjectStatus; path: ProjectPath | ''; notes: string }>({
  title: '', location: '', status: 'planning', path: '', notes: '',
});

const fillForm = (detail: ProjectDetail): void => {
  form.title = detail.title;
  form.location = detail.location ?? '';
  form.status = detail.status;
  form.path = detail.path ?? '';
  form.notes = detail.notes ?? '';
};

const save = async (patch: ProjectUpdateInput): Promise<void> => {
  saving.value = true;
  saveError.value = null;
  try {
    const updated = await updateProject(id.value, patch);
    project.value = updated;
    fillForm(updated);
    savedAt.value = Date.now();
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Could not save';
    // Put the fields back to what the server has, so the screen never shows an unsaved value as saved.
    if (project.value) fillForm(project.value);
  } finally {
    saving.value = false;
  }
};

const saveTitle = async (): Promise<void> => {
  const title = form.title.trim();
  if (!title) {
    saveError.value = 'Title is required';
    if (project.value) form.title = project.value.title;
    return;
  }
  await save({ title });
};

const onUploaded = (photo: ProjectPhotoDto): void => {
  if (project.value) project.value.photos = [...project.value.photos, photo];
};

const removePhoto = async (photoId: string): Promise<void> => {
  if (!project.value) return;
  if (!window.confirm('Remove this photo? This cannot be undone.')) return;
  photoError.value = null;
  try {
    await deletePhoto(id.value, photoId);
    project.value.photos = project.value.photos.filter((photo) => photo.id !== photoId);
  } catch (e) {
    photoError.value = e instanceof Error ? e.message : 'Could not remove the photo';
  }
};

const removeProject = async (): Promise<void> => {
  if (!window.confirm('Delete this project? It will be removed from the list.')) return;
  try {
    await deleteProject(id.value);
    await navigateTo('/projects');
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Could not delete the project';
  }
};

onMounted(async () => {
  try {
    const detail = await getProject(id.value);
    project.value = detail;
    fillForm(detail);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not load this project';
    return;
  }
  try {
    locations.value = await listLocations();
  } catch {
    // Suggestions are a convenience; the page works without them.
    locations.value = [];
  }
});
</script>
```

`AuthedImage` renders a single root element in each branch, so the `class` passed in the viewer falls through to it. Check in the rendered markup (by reading the component) that `!object-contain` overrides the component's `object-cover`; if Tailwind's important modifier is not enabled in this project's config, add a boolean prop `contain` to `AuthedImage` that switches `object-cover` to `object-contain` and removes `w-full h-full`, and use it here instead.

- [ ] **Step 2: Type check, run the suite, commit**

Run: `npx nuxi typecheck` and `npx vitest run` (same expectations as before).

```bash
git add pages/projects/[id].vue components/projects/AuthedImage.vue
git commit -m "feat: project page with inline editing, photo viewer and delete"
```

(Include `components/projects/AuthedImage.vue` in the `git add` only if you changed it.)

---

### Task 9: Documentation

**Files:**
- Create: `docs/functionality/projects.md`
- Modify: `docs/tech/api-endpoints.md`, `docs/functionality/changelog.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: the finished feature and the spec.
- Produces: docs matching what was built.

- [ ] **Step 1: Use the `update-docs` skill**

Invoke the repo's `update-docs` skill and follow it. Markdown rule for this repo's owner: do not hard-wrap prose; one paragraph per line.

- [ ] **Step 2: Write `docs/functionality/projects.md`**

Model it on `docs/functionality/providers.md` (product perspective, short sections). It must cover: what a project is and its fields; the four statuses and that new captures land in Planning; the path label and the "Needs details" marker; capture from a phone (title required, location and photos optional, photos shrunk before upload, per-photo retry while the form is open); the list's default view and filters; the project page; photo limits (10 per project) and privacy (only signed-in household members can load photos); deleting (a project is hidden and kept, a single photo is removed for good); and a "Not yet" section listing steps, the next-step list, provider links and AI help.

- [ ] **Step 3: Update the other docs**

- `docs/tech/api-endpoints.md`: add a Projects section with the nine routes from the spec's API table, including the multipart field names (`full`, `thumb`, `width`, `height`) and the `variant` query parameter.
- `docs/functionality/changelog.md`: add an entry for home projects slice 1, in the file's existing format.
- `CLAUDE.md`: add `Project` and `ProjectPhoto` to the Data Models list with a link to the new functionality doc; add `pages/projects/`, `components/projects/`, `Project*Service.ts`, `blob-storage.ts` to the project structure; add `Storage: Vercel Blob (private store, project photos)` under Backend in the tech stack; note `BLOB_READ_WRITE_TOKEN` under Development Setup.

- [ ] **Step 4: Commit**

```bash
git add docs/functionality/projects.md docs/tech/api-endpoints.md docs/functionality/changelog.md CLAUDE.md
git commit -m "docs: home projects slice 1"
```

---

## After the tasks (controller, with David)

1. **Final whole-branch review** on Opus, against the spec and the Review Focus list.
2. **Report to David**, stating plainly: services, schemas, the Blob wrapper mapping and the resize arithmetic are unit-tested; the API routes, all Vue pages and components, the canvas resize, the camera picker and every real Blob call have not been run at all.
3. **Ask David before each of these**, separately:
   - Create a private Blob store named for adulting.diy in Vercel, connect it to the project, and put `BLOB_READ_WRITE_TOKEN` in the local `.env`.
   - Apply the migration: `npx prisma migrate deploy` (this writes to the production database). Before running, check how Vercel builds apply migrations, so merging does not try to apply it twice or deploy code ahead of the tables.
   - Push the branch, and merge.
4. **Click-through script for David** (phone and desktop), written from the final code with the expected result per step: nav link; empty state; capture with a title only; capture with location and three photos; a portrait photo stays upright; list thumbnails; filters; "Needs details" disappears after setting a path; edit each field and reload; mark Done and see it leave the default list; view a photo full size; remove a photo; the 11th photo is refused; a photo URL opened in a private window returns an error, not the image; Amanda's account sees and can edit the same projects; delete a project.
5. Offer `/project-status` (the draft is in the spec) and `/shelloverflow`, per David's standing instructions. Neither is done without his yes.
