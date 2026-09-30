# Providers (Contractor & Service Tracking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a household a shared, admin-configurable list of contractors and service providers that the Worthington watcher can feed through an API.

**Architecture:** New household-scoped Prisma models (`Provider`, `ProviderCategory`, `ProviderStatus`, `ProviderContact`, `ProviderEvidence`, `ProviderComment`, `TaskProvider`, `ApiKey`) behind service classes that follow the existing `CategoryService` pattern (Prisma singleton, try/catch with logging). Nitro routes stay thin. Pure logic (name normalization, evidence summary, key hashing) lives in `server/utils/` so it is unit-testable without a database. Machine ingest authenticates with a hashed per-household API key, not `CRON_SECRET`.

**Tech Stack:** Nuxt 3 / Nitro, Prisma 5 on CockroachDB, Zod 3, Vitest (services tested with a mocked Prisma client, as in `tests/unit/services/dashboard-service.test.ts`), Tailwind with the stone/amber brand palette.

**Spec:** `docs/superpowers/specs/2026-09-29-providers-design.md`

## Global Constraints

- Every provider-related row is scoped by `householdId`; every service method takes `householdId` and never trusts an id alone.
- Only `name` and category are required on a provider; every other field is optional.
- Household admins (`User.isAdmin`) manage categories, statuses, and API keys; any household member can create, edit, and comment on providers.
- Deleting a category or status that is in use requires moving its providers first; it must never orphan them.
- Provider deletion is soft (`metaStatus = 'deleted'`), matching `TaskDefinition`.
- The ingest endpoint never overwrites `rating`, `notes`, `hiredAt`, `statusId`, or `categoryId` on an existing provider, and never resurrects a soft-deleted provider.
- API keys are stored only as SHA-256 hashes and shown to the user once, at creation.
- Code style per `CLAUDE.md`: TypeScript with explicit types, arrow functions, `import { type X }`, camelCase/PascalCase, no `any`.
- UI uses the brand guide (`docs/brand.md`): `stone` scale, `amber-600` primary buttons, `bg-white rounded-xl shadow-sm border border-stone-200` cards.
- Out of scope: quotes/engagements, file attachments, a cross-household pool, Google Places lookup, ledger diffing.

## Review Focus

- A watcher re-run with identical input must create nothing new and add zero evidence (idempotency).
- A provider the household soft-deleted must stay deleted when the watcher sends it again.
- A watcher item whose name differs only by case, punctuation, or a parenthetical (`"Best Exteriors (Drew Paetow)"` vs `"best exteriors"`) matches the same provider.
- One malformed item in a batch of 100 must fail alone; the other 99 are ingested.
- Household A's API key or session must never read or write household B's providers, categories, statuses, or comments.
- Deleting a category/status with providers and no `moveToId` must fail with a clear 409, not delete or orphan.

---

## File Structure

**Create**
- `prisma/migrations/<timestamp>_add_providers/migration.sql` (generated) — tables for all new models.
- `types/provider.ts` — shared TS types (`ProviderListItem`, `ProviderDetail`, `IngestItem`, `IngestResult`, ...).
- `server/utils/provider-matching.ts` — `normalizeProviderName`.
- `server/utils/provider-evidence.ts` — `summarizeEvidence`.
- `server/utils/api-key.ts` — `generateApiKey`, `hashApiKey`.
- `server/utils/api-errors.ts` — `HttpError`, `toHttpError`.
- `server/utils/admin.ts` — `assertHouseholdAdmin`.
- `server/utils/api-key-auth.ts` — `defineApiKeyProtectedEventHandler`.
- `server/utils/provider-schemas.ts` — Zod schemas for provider input, contacts, comments, ingest batch.
- `server/services/ProviderCategoryService.ts`, `ProviderStatusService.ts`, `ProviderService.ts`, `ProviderCommentService.ts`, `ProviderContactService.ts`, `ApiKeyService.ts`, `ProviderIngestService.ts`, `TaskProviderService.ts`.
- Routes under `server/api/provider-categories/`, `provider-statuses/`, `providers/`, `api-keys/`, `ingest/`, `tasks/[id]/providers*`.
- `composables/useProviders.ts` — client API wrapper.
- `pages/providers/index.vue`, `pages/providers/[id].vue`, `pages/household/providers-settings.vue`.
- `components/providers/ProviderForm.vue`, `ProviderCommentList.vue`, `TaskProviderPicker.vue`.
- Tests under `tests/unit/utils/` and `tests/unit/services/`.
- `scripts-and-agents/scripts/providers_ingest.py` (separate repo, Task 13).

**Modify**
- `prisma/schema.prisma` — new models + back-relations on `Household`, `User`, `TaskDefinition`.
- `server/utils/auth.ts` — add `defineHouseholdAdminEventHandler`.
- `components/AppHeader.vue` — Providers nav link.
- `pages/household/index.vue` — link to provider settings.
- `components/TaskDetails.vue` (or the task detail page) — Providers section.
- `docs/` — via the `update-docs` skill at the end.

---

### Task 1: Schema, migration, types

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `types/provider.ts`, `prisma/migrations/<timestamp>_add_providers/migration.sql`
- Modify: `docs/superpowers/specs/2026-09-29-providers-design.md` (amendment)

**Interfaces:**
- Produces: Prisma models `Provider`, `ProviderCategory`, `ProviderStatus`, `ProviderContact`, `ProviderEvidence`, `ProviderComment`, `TaskProvider`, `ApiKey`, plus the TS types in `types/provider.ts` used by every later task.

- [ ] **Step 1: Add back-relations to existing models**

In `prisma/schema.prisma`, add to `model User` (after `taskHistoryLogs`):

```prisma
  providerComments       ProviderComment[]
```

Add to `model Household` (after `tasks`):

```prisma
  providerCategories ProviderCategory[]
  providerStatuses   ProviderStatus[]
  providers          Provider[]
  apiKeys            ApiKey[]
```

Add to `model TaskDefinition` (after `historyLogs`):

```prisma
  providers         TaskProvider[]
```

- [ ] **Step 2: Append the new models to `prisma/schema.prisma`**

```prisma
// Provider category (household-managed, e.g. "Roofing, Siding & Gutters")
model ProviderCategory {
  id          String     @id @default(uuid())
  household   Household  @relation(fields: [householdId], references: [id])
  householdId String
  name        String
  sortOrder   Int        @default(0)
  providers   Provider[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([householdId, name])
  @@map("provider_categories")
}

// Provider status (household-managed, e.g. Lead / Recommended / Hired)
model ProviderStatus {
  id              String     @id @default(uuid())
  household       Household  @relation(fields: [householdId], references: [id])
  householdId     String
  name            String
  kind            String     @default("neutral") // neutral, positive, negative
  hiddenByDefault Boolean    @default(false)     // list page hides these unless toggled
  sortOrder       Int        @default(0)
  providers       Provider[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@unique([householdId, name])
  @@map("provider_statuses")
}

// Provider: a contractor or service provider owned by a household
model Provider {
  id                 String           @id @default(uuid())
  household          Household        @relation(fields: [householdId], references: [id])
  householdId        String
  category           ProviderCategory @relation(fields: [categoryId], references: [id])
  categoryId         String
  status             ProviderStatus   @relation(fields: [statusId], references: [id])
  statusId           String
  name               String
  nameKey            String           // normalized name, used to match watcher input
  company            String?
  primaryContactName String?
  phone              String?
  email              String?
  website            String?
  address            String?
  licenseNumber      String?
  googlePlaceId      String?
  rating             Int?             // private, 1-5
  hiredAt            DateTime?
  notes              String?          // private
  metaStatus         String           @default("active") // active, deleted
  contacts           ProviderContact[]
  evidence           ProviderEvidence[]
  comments           ProviderComment[]
  tasks              TaskProvider[]
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@unique([householdId, googlePlaceId])
  @@index([householdId, metaStatus])
  @@index([householdId, categoryId, nameKey])
  @@map("providers")
}

model ProviderContact {
  id         String   @id @default(uuid())
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  providerId String
  name       String
  role       String?
  phone      String?
  email      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([providerId])
  @@map("provider_contacts")
}

// One row per neighbor sighting from the watcher
model ProviderEvidence {
  id          String    @id @default(uuid())
  provider    Provider  @relation(fields: [providerId], references: [id], onDelete: Cascade)
  providerId  String
  sourceUrl   String
  sourceGroup String?
  sourceDate  DateTime?
  snippet     String?
  kind        String    // third_party, self_promo, lead
  createdAt   DateTime  @default(now())

  @@unique([providerId, sourceUrl])
  @@map("provider_evidence")
}

model ProviderComment {
  id         String   @id @default(uuid())
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  providerId String
  author     User     @relation(fields: [authorId], references: [id])
  authorId   String
  body       String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([providerId, createdAt])
  @@map("provider_comments")
}

model TaskProvider {
  id         String         @id @default(uuid())
  task       TaskDefinition @relation(fields: [taskId], references: [id])
  taskId     String
  provider   Provider       @relation(fields: [providerId], references: [id], onDelete: Cascade)
  providerId String
  createdAt  DateTime       @default(now())

  @@unique([taskId, providerId])
  @@map("task_providers")
}

// Per-household API key for machine ingest (only the hash is stored)
model ApiKey {
  id              String    @id @default(uuid())
  household       Household @relation(fields: [householdId], references: [id])
  householdId     String
  name            String
  prefix          String    // first characters, shown in the UI to identify the key
  hashedKey       String    @unique
  createdByUserId String
  lastUsedAt      DateTime?
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())

  @@index([householdId])
  @@map("api_keys")
}
```

- [ ] **Step 3: Create the migration**

Run: `npx prisma migrate dev --name add_providers`
Expected: a new folder `prisma/migrations/<timestamp>_add_providers/` containing `CREATE TABLE` statements for the 8 new tables, and "Your database is now in sync with your schema." If the CockroachDB shadow database is unavailable, run `npx prisma migrate dev --create-only --name add_providers`, review the SQL against `prisma/migrations/20260218150000_add_former_household_members/migration.sql` for style (`STRING`, `TIMESTAMP(3)`), then `npx prisma migrate deploy`.

- [ ] **Step 4: Write the shared types**

Create `types/provider.ts`:

```ts
export type ProviderStatusKind = 'neutral' | 'positive' | 'negative';
export type EvidenceKind = 'third_party' | 'self_promo' | 'lead';

export interface ProviderCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ProviderStatusDto {
  id: string;
  name: string;
  kind: ProviderStatusKind;
  hiddenByDefault: boolean;
  sortOrder: number;
}

export interface EvidenceSummary {
  mentionCount: number;
  neighborCount: number;
  lastSightingAt: Date | null;
}

export interface ProviderListItem extends EvidenceSummary {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  rating: number | null;
  category: ProviderCategoryDto;
  status: ProviderStatusDto;
}

export type ProviderSort = 'name' | 'mentions' | 'lastSighting' | 'rating';

export interface ProviderListFilters {
  search?: string;
  categoryId?: string;
  statusId?: string;
  includeHidden?: boolean;
  sort?: ProviderSort;
}

export interface ProviderInput {
  name: string;
  categoryId: string;
  statusId?: string;
  company?: string | null;
  primaryContactName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  licenseNumber?: string | null;
  googlePlaceId?: string | null;
  rating?: number | null;
  hiredAt?: Date | null;
  notes?: string | null;
}

export interface IngestEvidence {
  sourceUrl: string;
  sourceGroup?: string;
  sourceDate?: string;
  snippet?: string;
  kind: EvidenceKind;
}

export interface IngestItem {
  name: string;
  category: string;
  status?: string;
  company?: string;
  primaryContactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  licenseNumber?: string;
  googlePlaceId?: string;
  evidence: IngestEvidence[];
}

export interface IngestResult {
  created: number;
  updated: number;
  skippedDeleted: number;
  evidenceAdded: number;
  errors: { index: number; name: string; message: string }[];
}
```

- [ ] **Step 5: Amend the spec for `hiddenByDefault`**

In `docs/superpowers/specs/2026-09-29-providers-design.md`, change the `ProviderStatus` bullet to add: "`hiddenByDefault` (boolean; the list page hides providers in such statuses unless toggled; Lead defaults to true)."

- [ ] **Step 6: Verify and commit**

Run: `npx prisma generate && npx vitest run`
Expected: client generates; existing tests still pass.

```bash
git add prisma types docs
git commit -m "feat: add provider schema and types"
```

---

### Task 2: Pure utilities (name matching, evidence summary, API keys, errors)

**Files:**
- Create: `server/utils/provider-matching.ts`, `server/utils/provider-evidence.ts`, `server/utils/api-key.ts`, `server/utils/api-errors.ts`
- Test: `tests/unit/utils/provider-matching.test.ts`, `tests/unit/utils/provider-evidence.test.ts`, `tests/unit/utils/api-key.test.ts`, `tests/unit/utils/api-errors.test.ts`

**Interfaces:**
- Produces:
  - `normalizeProviderName(name: string): string`
  - `summarizeEvidence(evidence: { kind: string; sourceDate: Date | null }[]): EvidenceSummary`
  - `generateApiKey(): { key: string; prefix: string; hashedKey: string }`, `hashApiKey(key: string): string`
  - `class HttpError extends Error { statusCode: number }`, `toHttpError(error: unknown, context: string): never`

- [ ] **Step 1: Write the failing tests**

`tests/unit/utils/provider-matching.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeProviderName } from '@/server/utils/provider-matching'

describe('normalizeProviderName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeProviderName('  Best   Exteriors ')).toBe('best exteriors')
  })
  it('drops parenthetical text', () => {
    expect(normalizeProviderName('Best Exteriors (Drew Paetow)')).toBe('best exteriors')
  })
  it('strips punctuation and treats & as and', () => {
    expect(normalizeProviderName("Bob's Heating & Cooling, LLC.")).toBe('bobs heating and cooling llc')
  })
  it('returns empty string for punctuation-only input', () => {
    expect(normalizeProviderName('()!!')).toBe('')
  })
})
```

`tests/unit/utils/provider-evidence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { summarizeEvidence } from '@/server/utils/provider-evidence'

describe('summarizeEvidence', () => {
  it('handles no evidence', () => {
    expect(summarizeEvidence([])).toEqual({ mentionCount: 0, neighborCount: 0, lastSightingAt: null })
  })
  it('counts all rows as mentions and only third_party as neighbors', () => {
    const result = summarizeEvidence([
      { kind: 'third_party', sourceDate: new Date('2026-07-05') },
      { kind: 'third_party', sourceDate: new Date('2026-07-21') },
      { kind: 'self_promo', sourceDate: null },
    ])
    expect(result.mentionCount).toBe(3)
    expect(result.neighborCount).toBe(2)
    expect(result.lastSightingAt).toEqual(new Date('2026-07-21'))
  })
})
```

`tests/unit/utils/api-key.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey } from '@/server/utils/api-key'

describe('api keys', () => {
  it('generates a prefixed key whose hash matches hashApiKey', () => {
    const { key, prefix, hashedKey } = generateApiKey()
    expect(key.startsWith('adk_')).toBe(true)
    expect(key.startsWith(prefix)).toBe(true)
    expect(hashedKey).toBe(hashApiKey(key))
    expect(hashedKey).toMatch(/^[0-9a-f]{64}$/)
  })
  it('generates unique keys', () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key)
  })
})
```

`tests/unit/utils/api-errors.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { HttpError, toHttpError } from '@/server/utils/api-errors'

describe('toHttpError', () => {
  it('rethrows HttpError with its status code', () => {
    try { toHttpError(new HttpError('nope', 409), 'ctx') } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(409)
      return
    }
    throw new Error('did not throw')
  })
  it('passes through errors that already carry a statusCode', () => {
    try { toHttpError({ statusCode: 403, message: 'no' }, 'ctx') } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(403)
      return
    }
    throw new Error('did not throw')
  })
  it('maps unknown errors to 500', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try { toHttpError(new Error('boom'), 'ctx') } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(500)
      return
    }
    throw new Error('did not throw')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/utils/provider-matching.test.ts tests/unit/utils/provider-evidence.test.ts tests/unit/utils/api-key.test.ts tests/unit/utils/api-errors.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`server/utils/provider-matching.ts`:

```ts
/**
 * Normalize a provider name so watcher input matches an existing provider
 * regardless of case, punctuation, or a trailing "(Owner Name)" parenthetical.
 */
export const normalizeProviderName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
```

`server/utils/provider-evidence.ts`:

```ts
import { type EvidenceSummary } from '@/types/provider';

export const summarizeEvidence = (
  evidence: { kind: string; sourceDate: Date | null }[]
): EvidenceSummary => {
  let lastSightingAt: Date | null = null;
  for (const row of evidence) {
    if (row.sourceDate && (!lastSightingAt || row.sourceDate > lastSightingAt)) {
      lastSightingAt = row.sourceDate;
    }
  }
  return {
    mentionCount: evidence.length,
    neighborCount: evidence.filter((row) => row.kind === 'third_party').length,
    lastSightingAt,
  };
};
```

`server/utils/api-key.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

export const hashApiKey = (key: string): string =>
  createHash('sha256').update(key).digest('hex');

export const generateApiKey = (): { key: string; prefix: string; hashedKey: string } => {
  const key = `adk_${randomBytes(32).toString('base64url')}`;
  return { key, prefix: key.slice(0, 8), hashedKey: hashApiKey(key) };
};
```

`server/utils/api-errors.ts`:

```ts
import { createError } from 'h3';

export class HttpError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Convert any thrown value into an H3 error. Always throws.
 * Errors that already carry a statusCode (H3 errors) pass through untouched.
 */
export const toHttpError = (error: unknown, context: string): never => {
  if (error instanceof HttpError) {
    throw createError({ statusCode: error.statusCode, message: error.message });
  }
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    throw error;
  }
  console.error(`[API] ${context}:`, error);
  throw createError({ statusCode: 500, message: 'Server error' });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils tests/unit/utils
git commit -m "feat: add provider matching, evidence, api key, and error utils"
```

---

### Task 3: Category and status services

**Files:**
- Create: `server/services/ProviderCategoryService.ts`, `server/services/ProviderStatusService.ts`
- Test: `tests/unit/services/provider-category-service.test.ts`, `tests/unit/services/provider-status-service.test.ts`

**Interfaces:**
- Consumes: `HttpError` (Task 2), Prisma models (Task 1).
- Produces:
  - `ProviderCategoryService`: `listForHousehold(householdId)`, `create(householdId, name)`, `rename(householdId, id, name)`, `reorder(householdId, orderedIds)`, `remove(householdId, id, moveToId?)`, `findOrCreateByName(householdId, name)`.
  - `ProviderStatusService`: `listForHousehold(householdId)` (seeds defaults when the household has none), `create(householdId, input)`, `update(householdId, id, input)`, `reorder(householdId, orderedIds)`, `remove(householdId, id, moveToId?)`, `findOrCreateByName(householdId, name)`.
  - Exported constant `DEFAULT_PROVIDER_STATUSES`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/services/provider-category-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    providerCategory: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), aggregate: vi.fn(),
    },
    provider: { count: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderCategoryService } from '@/server/services/ProviderCategoryService'

const db = prisma as unknown as {
  providerCategory: Record<string, ReturnType<typeof vi.fn>>
  provider: Record<string, ReturnType<typeof vi.fn>>
  $transaction: ReturnType<typeof vi.fn>
}

describe('ProviderCategoryService', () => {
  let service: ProviderCategoryService
  beforeEach(() => {
    service = new ProviderCategoryService()
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => unknown)(db))
  })

  it('creates with the next sortOrder', async () => {
    db.providerCategory.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } })
    db.providerCategory.create.mockResolvedValue({ id: 'c1' })
    await service.create('h1', 'HVAC')
    expect(db.providerCategory.create).toHaveBeenCalledWith({
      data: { householdId: 'h1', name: 'HVAC', sortOrder: 5 },
    })
  })

  it('refuses to remove a category in use without moveToId', async () => {
    db.providerCategory.findFirst.mockResolvedValue({ id: 'c1', householdId: 'h1' })
    db.provider.count.mockResolvedValue(3)
    await expect(service.remove('h1', 'c1')).rejects.toMatchObject({ statusCode: 409 })
    expect(db.providerCategory.delete).not.toHaveBeenCalled()
  })

  it('moves providers then deletes when moveToId is given', async () => {
    db.providerCategory.findFirst
      .mockResolvedValueOnce({ id: 'c1', householdId: 'h1' })
      .mockResolvedValueOnce({ id: 'c2', householdId: 'h1' })
    db.provider.count.mockResolvedValue(3)
    await service.remove('h1', 'c1', 'c2')
    expect(db.provider.updateMany).toHaveBeenCalledWith({
      where: { householdId: 'h1', categoryId: 'c1' },
      data: { categoryId: 'c2' },
    })
    expect(db.providerCategory.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it('404s when the category belongs to another household', async () => {
    db.providerCategory.findFirst.mockResolvedValue(null)
    await expect(service.remove('h1', 'other')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('findOrCreateByName matches case-insensitively before creating', async () => {
    db.providerCategory.findFirst.mockResolvedValue({ id: 'c1', name: 'HVAC' })
    const result = await service.findOrCreateByName('h1', 'hvac')
    expect(result.id).toBe('c1')
    expect(db.providerCategory.findFirst).toHaveBeenCalledWith({
      where: { householdId: 'h1', name: { equals: 'hvac', mode: 'insensitive' } },
    })
    expect(db.providerCategory.create).not.toHaveBeenCalled()
  })
})
```

`tests/unit/services/provider-status-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    providerStatus: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), createMany: vi.fn(),
      update: vi.fn(), delete: vi.fn(), aggregate: vi.fn(),
    },
    provider: { count: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderStatusService, DEFAULT_PROVIDER_STATUSES } from '@/server/services/ProviderStatusService'

const db = prisma as unknown as {
  providerStatus: Record<string, ReturnType<typeof vi.fn>>
  provider: Record<string, ReturnType<typeof vi.fn>>
  $transaction: ReturnType<typeof vi.fn>
}

describe('ProviderStatusService', () => {
  let service: ProviderStatusService
  beforeEach(() => {
    service = new ProviderStatusService()
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => unknown)(db))
  })

  it('seeds the default statuses when a household has none', async () => {
    db.providerStatus.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 's1', name: 'Lead' }])
    await service.listForHousehold('h1')
    expect(db.providerStatus.createMany).toHaveBeenCalledWith({
      data: DEFAULT_PROVIDER_STATUSES.map((s, i) => ({ ...s, householdId: 'h1', sortOrder: i })),
      skipDuplicates: true,
    })
  })

  it('does not seed when statuses already exist', async () => {
    db.providerStatus.findMany.mockResolvedValue([{ id: 's1' }])
    await service.listForHousehold('h1')
    expect(db.providerStatus.createMany).not.toHaveBeenCalled()
  })

  it('marks Lead as hiddenByDefault in the defaults', () => {
    const lead = DEFAULT_PROVIDER_STATUSES.find((s) => s.name === 'Lead')
    expect(lead?.hiddenByDefault).toBe(true)
    expect(DEFAULT_PROVIDER_STATUSES.map((s) => s.name)).toEqual(
      ['Lead', 'Recommended', 'Hired', 'Passed', 'Avoid'])
  })

  it('refuses to remove a status in use without moveToId', async () => {
    db.providerStatus.findFirst.mockResolvedValue({ id: 's1', householdId: 'h1' })
    db.provider.count.mockResolvedValue(2)
    await expect(service.remove('h1', 's1')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects an invalid kind on create', async () => {
    await expect(service.create('h1', { name: 'X', kind: 'weird' as never }))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/provider-category-service.test.ts tests/unit/services/provider-status-service.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `ProviderCategoryService`**

```ts
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export class ProviderCategoryService {
  async listForHousehold(householdId: string) {
    return prisma.providerCategory.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(householdId: string, name: string) {
    const max = await prisma.providerCategory.aggregate({
      where: { householdId },
      _max: { sortOrder: true },
    });
    return prisma.providerCategory.create({
      data: { householdId, name, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }

  async rename(householdId: string, id: string, name: string) {
    await this.requireOwned(householdId, id);
    return prisma.providerCategory.update({ where: { id }, data: { name } });
  }

  async reorder(householdId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.providerCategory.update({
          where: { id, householdId },
          data: { sortOrder: index },
        })
      )
    );
  }

  /**
   * Delete a category. If providers use it, moveToId must name another category
   * in the same household; providers are reassigned first.
   */
  async remove(householdId: string, id: string, moveToId?: string) {
    await this.requireOwned(householdId, id);
    const inUse = await prisma.provider.count({ where: { householdId, categoryId: id } });
    if (inUse > 0) {
      if (!moveToId) {
        throw new HttpError(`Category is used by ${inUse} provider(s); choose a category to move them to`, 409);
      }
      if (moveToId === id) {
        throw new HttpError('Cannot move providers to the category being deleted', 400);
      }
      await this.requireOwned(householdId, moveToId);
      await prisma.$transaction([
        prisma.provider.updateMany({
          where: { householdId, categoryId: id },
          data: { categoryId: moveToId },
        }),
        prisma.providerCategory.delete({ where: { id } }),
      ]);
      return;
    }
    await prisma.providerCategory.delete({ where: { id } });
  }

  async findOrCreateByName(householdId: string, name: string) {
    const existing = await prisma.providerCategory.findFirst({
      where: { householdId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;
    return this.create(householdId, name);
  }

  private async requireOwned(householdId: string, id: string) {
    const category = await prisma.providerCategory.findFirst({ where: { id, householdId } });
    if (!category) throw new HttpError('Category not found', 404);
    return category;
  }
}
```

Note: the `remove` test with `moveToId` expects `updateMany` and `delete` to be called; with the mocked `$transaction` (which resolves an array of already-invoked mock calls) both are invoked. Confirm the test asserts on the mocks, not the return value.

- [ ] **Step 4: Implement `ProviderStatusService`**

```ts
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { type ProviderStatusKind } from '@/types/provider';

export const DEFAULT_PROVIDER_STATUSES: {
  name: string;
  kind: ProviderStatusKind;
  hiddenByDefault: boolean;
}[] = [
  { name: 'Lead', kind: 'neutral', hiddenByDefault: true },
  { name: 'Recommended', kind: 'positive', hiddenByDefault: false },
  { name: 'Hired', kind: 'positive', hiddenByDefault: false },
  { name: 'Passed', kind: 'neutral', hiddenByDefault: false },
  { name: 'Avoid', kind: 'negative', hiddenByDefault: false },
];

const VALID_KINDS: ProviderStatusKind[] = ['neutral', 'positive', 'negative'];

interface StatusInput {
  name: string;
  kind?: ProviderStatusKind;
  hiddenByDefault?: boolean;
}

export class ProviderStatusService {
  /** Lists statuses, seeding the defaults the first time a household asks. */
  async listForHousehold(householdId: string) {
    const existing = await prisma.providerStatus.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (existing.length > 0) return existing;

    await prisma.providerStatus.createMany({
      data: DEFAULT_PROVIDER_STATUSES.map((s, i) => ({ ...s, householdId, sortOrder: i })),
      skipDuplicates: true,
    });
    return prisma.providerStatus.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(householdId: string, input: StatusInput) {
    this.validateKind(input.kind);
    const max = await prisma.providerStatus.aggregate({
      where: { householdId },
      _max: { sortOrder: true },
    });
    return prisma.providerStatus.create({
      data: {
        householdId,
        name: input.name,
        kind: input.kind ?? 'neutral',
        hiddenByDefault: input.hiddenByDefault ?? false,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async update(householdId: string, id: string, input: Partial<StatusInput>) {
    this.validateKind(input.kind);
    await this.requireOwned(householdId, id);
    return prisma.providerStatus.update({ where: { id }, data: input });
  }

  async reorder(householdId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.providerStatus.update({ where: { id, householdId }, data: { sortOrder: index } })
      )
    );
  }

  async remove(householdId: string, id: string, moveToId?: string) {
    await this.requireOwned(householdId, id);
    const inUse = await prisma.provider.count({ where: { householdId, statusId: id } });
    if (inUse > 0) {
      if (!moveToId) {
        throw new HttpError(`Status is used by ${inUse} provider(s); choose a status to move them to`, 409);
      }
      if (moveToId === id) {
        throw new HttpError('Cannot move providers to the status being deleted', 400);
      }
      await this.requireOwned(householdId, moveToId);
      await prisma.$transaction([
        prisma.provider.updateMany({
          where: { householdId, statusId: id },
          data: { statusId: moveToId },
        }),
        prisma.providerStatus.delete({ where: { id } }),
      ]);
      return;
    }
    await prisma.providerStatus.delete({ where: { id } });
  }

  async findOrCreateByName(householdId: string, name: string) {
    const existing = await prisma.providerStatus.findFirst({
      where: { householdId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;
    return this.create(householdId, { name });
  }

  private validateKind(kind?: string) {
    if (kind !== undefined && !VALID_KINDS.includes(kind as ProviderStatusKind)) {
      throw new HttpError(`kind must be one of ${VALID_KINDS.join(', ')}`, 400);
    }
  }

  private async requireOwned(householdId: string, id: string) {
    const status = await prisma.providerStatus.findFirst({ where: { id, householdId } });
    if (!status) throw new HttpError('Status not found', 404);
    return status;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/services/provider-category-service.test.ts tests/unit/services/provider-status-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services tests/unit/services
git commit -m "feat: add provider category and status services"
```

---

### Task 4: Provider, comment, and contact services

**Files:**
- Create: `server/services/ProviderService.ts`, `server/services/ProviderCommentService.ts`, `server/services/ProviderContactService.ts`
- Test: `tests/unit/services/provider-service.test.ts`, `tests/unit/services/provider-comment-service.test.ts`

**Interfaces:**
- Consumes: `normalizeProviderName`, `summarizeEvidence`, `HttpError`, `ProviderStatusService.listForHousehold`, types from `types/provider.ts`.
- Produces:
  - `ProviderService`: `list(householdId, filters): Promise<ProviderListItem[]>`, `findById(householdId, id)`, `create(householdId, input: ProviderInput)`, `update(householdId, id, input: Partial<ProviderInput>)`, `softDelete(householdId, id)`.
  - `ProviderCommentService`: `add(householdId, providerId, authorId, body)`, `update(householdId, commentId, authorId, body)`, `remove(householdId, commentId, authorId)`.
  - `ProviderContactService`: `add(householdId, providerId, input)`, `update(householdId, contactId, input)`, `remove(householdId, contactId)`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/services/provider-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    provider: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    providerCategory: { findFirst: vi.fn() },
    providerStatus: { findFirst: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderService } from '@/server/services/ProviderService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const row = (over: Record<string, unknown>) => ({
  id: 'p', name: 'X', company: null, phone: null, rating: null,
  category: { id: 'c1', name: 'Roofing', sortOrder: 0 },
  status: { id: 's1', name: 'Recommended', kind: 'positive', hiddenByDefault: false, sortOrder: 1 },
  evidence: [], ...over,
})

describe('ProviderService.list', () => {
  let service: ProviderService
  beforeEach(() => { service = new ProviderService(); vi.clearAllMocks() })

  it('always scopes by household and excludes deleted providers', async () => {
    db.provider.findMany.mockResolvedValue([])
    await service.list('h1', {})
    const where = db.provider.findMany.mock.calls[0][0].where
    expect(where.householdId).toBe('h1')
    expect(where.metaStatus).toBe('active')
  })

  it('hides hiddenByDefault statuses unless includeHidden is set', async () => {
    db.provider.findMany.mockResolvedValue([])
    await service.list('h1', {})
    expect(db.provider.findMany.mock.calls[0][0].where.status).toEqual({ hiddenByDefault: false })
    await service.list('h1', { includeHidden: true })
    expect(db.provider.findMany.mock.calls[1][0].where.status).toBeUndefined()
  })

  it('an explicit statusId filter overrides the hidden-by-default rule', async () => {
    db.provider.findMany.mockResolvedValue([])
    await service.list('h1', { statusId: 's9' })
    const where = db.provider.findMany.mock.calls[0][0].where
    expect(where.statusId).toBe('s9')
    expect(where.status).toBeUndefined()
  })

  it('derives mention and neighbor counts and sorts by mentions', async () => {
    db.provider.findMany.mockResolvedValue([
      row({ id: 'a', name: 'A', evidence: [{ kind: 'third_party', sourceDate: new Date('2026-07-01') }] }),
      row({ id: 'b', name: 'B', evidence: [
        { kind: 'third_party', sourceDate: new Date('2026-07-05') },
        { kind: 'third_party', sourceDate: new Date('2026-07-21') },
        { kind: 'self_promo', sourceDate: null },
      ] }),
    ])
    const result = await service.list('h1', { sort: 'mentions' })
    expect(result.map((r) => r.id)).toEqual(['b', 'a'])
    expect(result[0].mentionCount).toBe(3)
    expect(result[0].neighborCount).toBe(2)
  })

  it('sorts rating descending with unrated last', async () => {
    db.provider.findMany.mockResolvedValue([
      row({ id: 'a', rating: null }), row({ id: 'b', rating: 5 }), row({ id: 'c', rating: 3 }),
    ])
    const result = await service.list('h1', { sort: 'rating' })
    expect(result.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('ProviderService.create', () => {
  let service: ProviderService
  beforeEach(() => { service = new ProviderService(); vi.clearAllMocks() })

  it('rejects a category from another household', async () => {
    db.providerCategory.findFirst.mockResolvedValue(null)
    await expect(service.create('h1', { name: 'X', categoryId: 'foreign' }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(db.provider.create).not.toHaveBeenCalled()
  })

  it('stores the normalized nameKey and defaults the status to the first status', async () => {
    db.providerCategory.findFirst.mockResolvedValue({ id: 'c1' })
    db.providerStatus.findMany.mockResolvedValue([{ id: 's1' }])
    db.provider.create.mockResolvedValue({ id: 'p1' })
    await service.create('h1', { name: 'Best Exteriors (Drew)', categoryId: 'c1' })
    expect(db.provider.create.mock.calls[0][0].data).toMatchObject({
      householdId: 'h1', nameKey: 'best exteriors', statusId: 's1',
    })
  })
})

describe('ProviderService.softDelete', () => {
  it('404s for a provider in another household', async () => {
    const service = new ProviderService()
    db.provider.findFirst.mockResolvedValue(null)
    await expect(service.softDelete('h1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
  })
})
```

`tests/unit/services/provider-comment-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    provider: { findFirst: vi.fn() },
    providerComment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderCommentService } from '@/server/services/ProviderCommentService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

describe('ProviderCommentService', () => {
  let service: ProviderCommentService
  beforeEach(() => { service = new ProviderCommentService(); vi.clearAllMocks() })

  it('rejects a blank comment', async () => {
    await expect(service.add('h1', 'p1', 'u1', '   ')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('cannot comment on another household\'s provider', async () => {
    db.provider.findFirst.mockResolvedValue(null)
    await expect(service.add('h1', 'p1', 'u1', 'hi')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('only the author can edit', async () => {
    db.providerComment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'someone-else' })
    await expect(service.update('h1', 'c1', 'u1', 'x')).rejects.toMatchObject({ statusCode: 403 })
    expect(db.providerComment.update).not.toHaveBeenCalled()
  })

  it('only the author can delete', async () => {
    db.providerComment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'someone-else' })
    await expect(service.remove('h1', 'c1', 'u1')).rejects.toMatchObject({ statusCode: 403 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/provider-service.test.ts tests/unit/services/provider-comment-service.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `ProviderService`**

```ts
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { normalizeProviderName } from '@/server/utils/provider-matching';
import { summarizeEvidence } from '@/server/utils/provider-evidence';
import { ProviderStatusService } from '@/server/services/ProviderStatusService';
import {
  type ProviderInput,
  type ProviderListFilters,
  type ProviderListItem,
  type ProviderStatusKind,
} from '@/types/provider';

const statusService = new ProviderStatusService();

export class ProviderService {
  async list(householdId: string, filters: ProviderListFilters): Promise<ProviderListItem[]> {
    const where: Record<string, unknown> = { householdId, metaStatus: 'active' };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.statusId) {
      where.statusId = filters.statusId;
    } else if (!filters.includeHidden) {
      where.status = { hiddenByDefault: false };
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { company: { contains: term, mode: 'insensitive' } },
        { primaryContactName: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.provider.findMany({
      where,
      include: {
        category: true,
        status: true,
        evidence: { select: { kind: true, sourceDate: true } },
      },
    });

    const items: ProviderListItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company,
      phone: row.phone,
      rating: row.rating,
      category: {
        id: row.category.id, name: row.category.name, sortOrder: row.category.sortOrder,
      },
      status: {
        id: row.status.id,
        name: row.status.name,
        kind: row.status.kind as ProviderStatusKind,
        hiddenByDefault: row.status.hiddenByDefault,
        sortOrder: row.status.sortOrder,
      },
      ...summarizeEvidence(row.evidence),
    }));

    return this.sort(items, filters.sort ?? 'name');
  }

  async findById(householdId: string, id: string) {
    const provider = await prisma.provider.findFirst({
      where: { id, householdId, metaStatus: 'active' },
      include: {
        category: true,
        status: true,
        contacts: { orderBy: { createdAt: 'asc' } },
        evidence: { orderBy: { sourceDate: 'desc' } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, picture: true } } },
        },
        tasks: { include: { task: { select: { id: true, name: true } } } },
      },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return { ...provider, ...summarizeEvidence(provider.evidence) };
  }

  async create(householdId: string, input: ProviderInput) {
    await this.assertCategoryOwned(householdId, input.categoryId);
    const statusId = input.statusId
      ? (await this.assertStatusOwned(householdId, input.statusId), input.statusId)
      : (await statusService.listForHousehold(householdId))[0]?.id;
    if (!statusId) throw new HttpError('No provider statuses configured', 400);

    return prisma.provider.create({
      data: {
        ...input,
        statusId,
        householdId,
        nameKey: normalizeProviderName(input.name),
      },
    });
  }

  async update(householdId: string, id: string, input: Partial<ProviderInput>) {
    await this.requireOwned(householdId, id);
    if (input.categoryId) await this.assertCategoryOwned(householdId, input.categoryId);
    if (input.statusId) await this.assertStatusOwned(householdId, input.statusId);
    return prisma.provider.update({
      where: { id },
      data: {
        ...input,
        ...(input.name !== undefined ? { nameKey: normalizeProviderName(input.name) } : {}),
      },
    });
  }

  async softDelete(householdId: string, id: string) {
    await this.requireOwned(householdId, id);
    await prisma.provider.update({ where: { id }, data: { metaStatus: 'deleted' } });
  }

  private sort(items: ProviderListItem[], sort: NonNullable<ProviderListFilters['sort']>) {
    const byName = (a: ProviderListItem, b: ProviderListItem) => a.name.localeCompare(b.name);
    const copy = [...items];
    switch (sort) {
      case 'mentions':
        return copy.sort((a, b) => b.mentionCount - a.mentionCount || byName(a, b));
      case 'lastSighting':
        return copy.sort(
          (a, b) => (b.lastSightingAt?.getTime() ?? 0) - (a.lastSightingAt?.getTime() ?? 0) || byName(a, b)
        );
      case 'rating':
        return copy.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b));
      default:
        return copy.sort(byName);
    }
  }

  private async requireOwned(householdId: string, id: string) {
    const provider = await prisma.provider.findFirst({
      where: { id, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return provider;
  }

  private async assertCategoryOwned(householdId: string, categoryId: string) {
    const category = await prisma.providerCategory.findFirst({ where: { id: categoryId, householdId } });
    if (!category) throw new HttpError('Invalid category', 400);
  }

  private async assertStatusOwned(householdId: string, statusId: string) {
    const status = await prisma.providerStatus.findFirst({ where: { id: statusId, householdId } });
    if (!status) throw new HttpError('Invalid status', 400);
  }
}
```

In the `create` test that has no `statusId`, the `providerStatus.findMany` mock returns `[{ id: 's1' }]`, so `listForHousehold` returns without seeding.

- [ ] **Step 4: Implement `ProviderCommentService`**

```ts
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export class ProviderCommentService {
  async add(householdId: string, providerId: string, authorId: string, body: string) {
    const text = this.cleanBody(body);
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return prisma.providerComment.create({
      data: { providerId, authorId, body: text },
      include: { author: { select: { id: true, name: true, picture: true } } },
    });
  }

  async update(householdId: string, commentId: string, authorId: string, body: string) {
    const text = this.cleanBody(body);
    const comment = await this.requireInHousehold(householdId, commentId);
    if (comment.authorId !== authorId) throw new HttpError('You can only edit your own comments', 403);
    return prisma.providerComment.update({ where: { id: commentId }, data: { body: text } });
  }

  async remove(householdId: string, commentId: string, authorId: string) {
    const comment = await this.requireInHousehold(householdId, commentId);
    if (comment.authorId !== authorId) throw new HttpError('You can only delete your own comments', 403);
    await prisma.providerComment.delete({ where: { id: commentId } });
  }

  private cleanBody(body: string) {
    const text = body?.trim();
    if (!text) throw new HttpError('A non-empty comment is required', 400);
    return text;
  }

  private async requireInHousehold(householdId: string, commentId: string) {
    const comment = await prisma.providerComment.findFirst({
      where: { id: commentId, provider: { householdId } },
    });
    if (!comment) throw new HttpError('Comment not found', 404);
    return comment;
  }
}
```

- [ ] **Step 5: Implement `ProviderContactService`**

```ts
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export interface ContactInput {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}

export class ProviderContactService {
  async add(householdId: string, providerId: string, input: ContactInput) {
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return prisma.providerContact.create({ data: { ...input, providerId } });
  }

  async update(householdId: string, contactId: string, input: Partial<ContactInput>) {
    await this.requireInHousehold(householdId, contactId);
    return prisma.providerContact.update({ where: { id: contactId }, data: input });
  }

  async remove(householdId: string, contactId: string) {
    await this.requireInHousehold(householdId, contactId);
    await prisma.providerContact.delete({ where: { id: contactId } });
  }

  private async requireInHousehold(householdId: string, contactId: string) {
    const contact = await prisma.providerContact.findFirst({
      where: { id: contactId, provider: { householdId } },
    });
    if (!contact) throw new HttpError('Contact not found', 404);
    return contact;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/services/provider-service.test.ts tests/unit/services/provider-comment-service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/services tests/unit/services
git commit -m "feat: add provider, comment, and contact services"
```

---

### Task 5: Validation schemas, admin guard, and category/status/provider routes

**Files:**
- Create: `server/utils/provider-schemas.ts`, `server/utils/admin.ts`
- Modify: `server/utils/auth.ts` (append `defineHouseholdAdminEventHandler`)
- Create routes:
  - `server/api/provider-categories/index.get.ts`, `index.post.ts`, `[id].put.ts`, `[id].delete.ts`, `reorder.put.ts`
  - `server/api/provider-statuses/index.get.ts`, `index.post.ts`, `[id].put.ts`, `[id].delete.ts`, `reorder.put.ts`
  - `server/api/providers/index.get.ts`, `index.post.ts`, `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`
  - `server/api/providers/[id]/comments.post.ts`, `server/api/providers/[id]/comments/[commentId].put.ts`, `[commentId].delete.ts`
  - `server/api/providers/[id]/contacts.post.ts`, `server/api/providers/[id]/contacts/[contactId].put.ts`, `[contactId].delete.ts`
- Test: `tests/unit/utils/provider-schemas.test.ts`, `tests/unit/utils/admin.test.ts`

**Interfaces:**
- Consumes: all services from Tasks 3–4, `toHttpError`.
- Produces:
  - Zod schemas: `providerInputSchema`, `providerUpdateSchema`, `categoryInputSchema`, `statusInputSchema`, `reorderSchema`, `deleteWithMoveSchema`, `commentSchema`, `contactSchema`, `ingestBatchSchema` (defined here, used in Task 7).
  - `assertHouseholdAdmin(userId: string, householdId: string, isAdmin?: (userId: string, householdId: string) => Promise<boolean>): Promise<void>`
  - `defineHouseholdAdminEventHandler(handler)` with the same handler signature as `defineHouseholdProtectedEventHandler`.
  - HTTP API: see the route list above; list query params `search`, `categoryId`, `statusId`, `includeHidden=true`, `sort`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/utils/provider-schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  providerInputSchema, ingestBatchSchema, deleteWithMoveSchema, commentSchema,
} from '@/server/utils/provider-schemas'

describe('providerInputSchema', () => {
  it('requires name and categoryId only', () => {
    expect(providerInputSchema.safeParse({ name: 'A', categoryId: 'c1' }).success).toBe(true)
    expect(providerInputSchema.safeParse({ name: '', categoryId: 'c1' }).success).toBe(false)
    expect(providerInputSchema.safeParse({ name: 'A' }).success).toBe(false)
  })
  it('bounds rating to 1-5', () => {
    expect(providerInputSchema.safeParse({ name: 'A', categoryId: 'c', rating: 6 }).success).toBe(false)
    expect(providerInputSchema.safeParse({ name: 'A', categoryId: 'c', rating: 5 }).success).toBe(true)
  })
})

describe('ingestBatchSchema', () => {
  const item = { name: 'Best Exteriors', category: 'Roofing', evidence: [{ sourceUrl: 'https://x.test/1', kind: 'third_party' }] }
  it('accepts a valid batch', () => {
    expect(ingestBatchSchema.safeParse({ providers: [item] }).success).toBe(true)
  })
  it('rejects more than 500 items', () => {
    expect(ingestBatchSchema.safeParse({ providers: Array(501).fill(item) }).success).toBe(false)
  })
  it('does not reject the batch for a single bad item at the schema level', () => {
    // Per-item validation happens in the ingest service so one bad row cannot fail the batch.
    expect(ingestBatchSchema.safeParse({ providers: [item, { nonsense: true }] }).success).toBe(true)
  })
})

describe('other schemas', () => {
  it('deleteWithMoveSchema allows an optional moveToId', () => {
    expect(deleteWithMoveSchema.safeParse({}).success).toBe(true)
    expect(deleteWithMoveSchema.safeParse({ moveToId: 'c2' }).success).toBe(true)
  })
  it('commentSchema rejects blank bodies', () => {
    expect(commentSchema.safeParse({ body: '   ' }).success).toBe(false)
  })
})
```

`tests/unit/utils/admin.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { assertHouseholdAdmin } from '@/server/utils/admin'

describe('assertHouseholdAdmin', () => {
  it('resolves for admins', async () => {
    await expect(assertHouseholdAdmin('u', 'h', vi.fn().mockResolvedValue(true))).resolves.toBeUndefined()
  })
  it('throws 403 for non-admins', async () => {
    await expect(assertHouseholdAdmin('u', 'h', vi.fn().mockResolvedValue(false)))
      .rejects.toMatchObject({ statusCode: 403 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/utils/provider-schemas.test.ts tests/unit/utils/admin.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement schemas**

`server/utils/provider-schemas.ts`:

```ts
import { z } from 'zod';

const optionalText = z.string().trim().max(500).nullish();

export const providerInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().min(1),
  statusId: z.string().min(1).optional(),
  company: optionalText,
  primaryContactName: optionalText,
  phone: optionalText,
  email: optionalText,
  website: optionalText,
  address: optionalText,
  licenseNumber: optionalText,
  googlePlaceId: optionalText,
  rating: z.number().int().min(1).max(5).nullish(),
  hiredAt: z.coerce.date().nullish(),
  notes: z.string().max(10000).nullish(),
});

export const providerUpdateSchema = providerInputSchema.partial();

export const categoryInputSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const statusInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(['neutral', 'positive', 'negative']).optional(),
  hiddenByDefault: z.boolean().optional(),
});

export const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });

export const deleteWithMoveSchema = z.object({ moveToId: z.string().min(1).optional() });

export const commentSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: optionalText,
  phone: optionalText,
  email: optionalText,
});

// Items are validated one at a time inside ProviderIngestService so a single bad row
// cannot fail the whole batch; the envelope only checks shape and size.
export const ingestBatchSchema = z.object({
  providers: z.array(z.unknown()).min(1).max(500),
});

export const ingestItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  status: z.string().trim().min(1).max(100).optional(),
  company: optionalText,
  primaryContactName: optionalText,
  phone: optionalText,
  email: optionalText,
  website: optionalText,
  address: optionalText,
  licenseNumber: optionalText,
  googlePlaceId: optionalText,
  evidence: z
    .array(
      z.object({
        sourceUrl: z.string().url(),
        sourceGroup: z.string().max(200).optional(),
        sourceDate: z.string().optional(),
        snippet: z.string().max(5000).optional(),
        kind: z.enum(['third_party', 'self_promo', 'lead']),
      })
    )
    .default([]),
});
```

Note: the "one bad item" test passes because `ingestBatchSchema` uses `z.unknown()` for items. `ingestItemSchema` is used in Task 7.

- [ ] **Step 4: Implement admin guard and wrapper**

`server/utils/admin.ts`:

```ts
import { HttpError } from '@/server/utils/api-errors';
import { HouseholdService } from '@/server/services/HouseholdService';

export const assertHouseholdAdmin = async (
  userId: string,
  householdId: string,
  isAdmin: (userId: string, householdId: string) => Promise<boolean> = (u, h) =>
    new HouseholdService().isUserAdmin(u, h)
): Promise<void> => {
  if (!(await isAdmin(userId, householdId))) {
    throw new HttpError('Only household admins can do this', 403);
  }
};
```

Append to `server/utils/auth.ts`:

```ts
// Wrapper for household routes that only admins may call
export function defineHouseholdAdminEventHandler(
  handler: (
    event: H3Event,
    authenticatedUser: AuthenticatedUser,
    householdId: string
  ) => Promise<any>
) {
  return defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
    try {
      await assertHouseholdAdmin(authUser.userId, householdId);
    } catch (error) {
      toHttpError(error, 'admin check');
    }
    return handler(event, authUser, householdId);
  });
}
```

and add imports at the top of `server/utils/auth.ts`:

```ts
import { assertHouseholdAdmin } from "@/server/utils/admin";
import { toHttpError } from "@/server/utils/api-errors";
```

- [ ] **Step 5: Implement the routes**

Every route follows this shape (shown once in full; the rest differ only in the service call). `server/api/provider-categories/index.get.ts`:

```ts
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (_event, _authUser, householdId) => {
  try {
    return await new ProviderCategoryService().listForHousehold(householdId);
  } catch (error) {
    return toHttpError(error, 'listing provider categories');
  }
});
```

`server/api/provider-categories/index.post.ts` (admin):

```ts
import { readBody } from "h3";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";
import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { categoryInputSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const parsed = categoryInputSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError('Category name is required', 400);
    return await new ProviderCategoryService().create(householdId, parsed.data.name);
  } catch (error) {
    return toHttpError(error, 'creating provider category');
  }
});
```

`server/api/provider-categories/[id].put.ts` (admin) — same wrapper; body `categoryInputSchema`; call `rename(householdId, event.context.params!.id, parsed.data.name)`.

`server/api/provider-categories/[id].delete.ts` (admin) — body `deleteWithMoveSchema` (a missing body must be treated as `{}`: `const body = await readBody(event).catch(() => ({})) ?? {}`); call `remove(householdId, id, parsed.data.moveToId)`; return `{ success: true }`.

`server/api/provider-categories/reorder.put.ts` (admin) — body `reorderSchema`; call `reorder(householdId, parsed.data.orderedIds)`; return `{ success: true }`.

Statuses mirror categories under `server/api/provider-statuses/`: `index.get.ts` uses `ProviderStatusService.listForHousehold`; `index.post.ts` (admin, `statusInputSchema`, `create(householdId, parsed.data)`); `[id].put.ts` (admin, `statusInputSchema.partial()`, `update(householdId, id, parsed.data)`); `[id].delete.ts` and `reorder.put.ts` as for categories.

Providers, `server/api/providers/index.get.ts`:

```ts
import { getQuery } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProviderService } from "@/server/services/ProviderService";
import { toHttpError } from "@/server/utils/api-errors";
import { type ProviderSort } from "@/types/provider";

const SORTS: ProviderSort[] = ['name', 'mentions', 'lastSighting', 'rating'];

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const q = getQuery(event);
    const sort = SORTS.includes(q.sort as ProviderSort) ? (q.sort as ProviderSort) : undefined;
    return await new ProviderService().list(householdId, {
      search: typeof q.search === 'string' ? q.search : undefined,
      categoryId: typeof q.categoryId === 'string' ? q.categoryId : undefined,
      statusId: typeof q.statusId === 'string' ? q.statusId : undefined,
      includeHidden: q.includeHidden === 'true',
      sort,
    });
  } catch (error) {
    return toHttpError(error, 'listing providers');
  }
});
```

`index.post.ts` (household member): parse `providerInputSchema`; on failure throw `HttpError(parsed.error.issues[0].message, 400)`; call `ProviderService.create(householdId, parsed.data)`. `[id].get.ts`: `findById(householdId, id)`. `[id].put.ts`: `providerUpdateSchema`, `update(...)`. `[id].delete.ts`: `softDelete(...)`, return `{ success: true }`.

Comments: `comments.post.ts` — `commentSchema`, `ProviderCommentService.add(householdId, providerId, authUser.userId, parsed.data.body)`. `comments/[commentId].put.ts` — `update(householdId, commentId, authUser.userId, body)`. `comments/[commentId].delete.ts` — `remove(householdId, commentId, authUser.userId)`.

Contacts: `contacts.post.ts` — `contactSchema`, `ProviderContactService.add(householdId, providerId, parsed.data)`; `contacts/[contactId].put.ts` — `contactSchema.partial()`, `update`; `contacts/[contactId].delete.ts` — `remove`.

All routes read ids via `event.context.params?.id` / `.commentId` / `.contactId` and 400 if missing, as in `server/api/occurrences/[id]/comments.post.ts`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run tests/unit/utils/provider-schemas.test.ts tests/unit/utils/admin.test.ts && npx nuxi typecheck`
Expected: tests PASS; no new type errors in the files this task touched.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`, sign in with the dev bypass, then in the browser console call `fetch('/api/provider-statuses').then(r => r.json())`. Expected: five default statuses (Lead, Recommended, Hired, Passed, Avoid). Then POST a category and a provider and GET `/api/providers?includeHidden=true`.

- [ ] **Step 8: Commit**

```bash
git add server tests
git commit -m "feat: add provider validation, admin guard, and CRUD routes"
```

---

### Task 6: API keys and ingest endpoint

**Files:**
- Create: `server/services/ApiKeyService.ts`, `server/services/ProviderIngestService.ts`, `server/utils/api-key-auth.ts`
- Create routes: `server/api/api-keys/index.get.ts`, `index.post.ts`, `[id].delete.ts`, `server/api/ingest/providers.post.ts`
- Test: `tests/unit/services/api-key-service.test.ts`, `tests/unit/services/provider-ingest-service.test.ts`

**Interfaces:**
- Consumes: `generateApiKey`, `hashApiKey`, `normalizeProviderName`, `ProviderCategoryService.findOrCreateByName`, `ProviderStatusService.findOrCreateByName`, `ingestItemSchema`, `ingestBatchSchema`, `IngestItem`/`IngestResult` types.
- Produces:
  - `ApiKeyService`: `create(householdId, userId, name): Promise<{ id: string; name: string; prefix: string; key: string }>`, `list(householdId)`, `revoke(householdId, id)`, `authenticate(key: string): Promise<{ householdId: string; apiKeyId: string } | null>`.
  - `defineApiKeyProtectedEventHandler(handler: (event: H3Event, ctx: { householdId: string; apiKeyId: string }) => Promise<any>)`.
  - `ProviderIngestService.ingestBatch(householdId: string, rawItems: unknown[]): Promise<IngestResult>`.
  - `POST /api/ingest/providers` body `{ providers: IngestItem[] }`, header `Authorization: Bearer adk_...`, returns `IngestResult`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/services/api-key-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    apiKey: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ApiKeyService } from '@/server/services/ApiKeyService'
import { hashApiKey } from '@/server/utils/api-key'

const db = prisma as unknown as { apiKey: Record<string, ReturnType<typeof vi.fn>> }

describe('ApiKeyService', () => {
  let service: ApiKeyService
  beforeEach(() => { service = new ApiKeyService(); vi.clearAllMocks() })

  it('stores only the hash and returns the plaintext key once', async () => {
    db.apiKey.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'k1', ...data }))
    const result = await service.create('h1', 'u1', 'watcher')
    const stored = db.apiKey.create.mock.calls[0][0].data
    expect(stored.hashedKey).toBe(hashApiKey(result.key))
    expect(JSON.stringify(stored)).not.toContain(result.key)
    expect(result.key.startsWith('adk_')).toBe(true)
  })

  it('authenticate looks up by hash and ignores revoked keys', async () => {
    db.apiKey.findFirst.mockResolvedValue({ id: 'k1', householdId: 'h1' })
    const result = await service.authenticate('adk_abc')
    expect(db.apiKey.findFirst).toHaveBeenCalledWith({
      where: { hashedKey: hashApiKey('adk_abc'), revokedAt: null },
    })
    expect(result).toEqual({ householdId: 'h1', apiKeyId: 'k1' })
  })

  it('authenticate returns null for an unknown key', async () => {
    db.apiKey.findFirst.mockResolvedValue(null)
    expect(await service.authenticate('adk_nope')).toBeNull()
  })

  it('list never returns hashedKey', async () => {
    db.apiKey.findMany.mockResolvedValue([])
    await service.list('h1')
    const args = db.apiKey.findMany.mock.calls[0][0]
    expect(args.select.hashedKey).toBeUndefined()
    expect(args.where).toEqual({ householdId: 'h1' })
  })
})
```

`tests/unit/services/provider-ingest-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    provider: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    providerEvidence: { createMany: vi.fn() },
  },
}))
vi.mock('@/server/services/ProviderCategoryService', () => ({
  ProviderCategoryService: vi.fn().mockImplementation(() => ({
    findOrCreateByName: vi.fn().mockResolvedValue({ id: 'c1' }),
  })),
}))
vi.mock('@/server/services/ProviderStatusService', () => ({
  ProviderStatusService: vi.fn().mockImplementation(() => ({
    findOrCreateByName: vi.fn().mockResolvedValue({ id: 's-lead' }),
  })),
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderIngestService } from '@/server/services/ProviderIngestService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const item = (over: Record<string, unknown> = {}) => ({
  name: 'Best Exteriors (Drew Paetow)',
  category: 'Roofing',
  phone: '614-555-0100',
  evidence: [{ sourceUrl: 'https://fb.test/1', kind: 'third_party' }],
  ...over,
})

describe('ProviderIngestService', () => {
  let service: ProviderIngestService
  beforeEach(() => {
    service = new ProviderIngestService()
    vi.clearAllMocks()
    db.provider.create.mockResolvedValue({ id: 'p1' })
    db.providerEvidence.createMany.mockResolvedValue({ count: 1 })
  })

  it('creates a new provider with a normalized nameKey and the Lead status by default', async () => {
    db.provider.findFirst.mockResolvedValue(null)
    const result = await service.ingestBatch('h1', [item()])
    expect(result).toMatchObject({ created: 1, updated: 0, evidenceAdded: 1, errors: [] })
    expect(db.provider.create.mock.calls[0][0].data).toMatchObject({
      householdId: 'h1', nameKey: 'best exteriors', categoryId: 'c1', statusId: 's-lead',
    })
  })

  it('matches an existing provider by nameKey within the category', async () => {
    db.provider.findFirst.mockResolvedValue({ id: 'p1', metaStatus: 'active', phone: null, email: null })
    await service.ingestBatch('h1', [item({ name: 'best exteriors' })])
    expect(db.provider.findFirst.mock.calls[0][0].where).toMatchObject({
      householdId: 'h1', categoryId: 'c1', nameKey: 'best exteriors',
    })
    expect(db.provider.create).not.toHaveBeenCalled()
  })

  it('prefers googlePlaceId when supplied', async () => {
    db.provider.findFirst.mockResolvedValue({ id: 'p1', metaStatus: 'active' })
    await service.ingestBatch('h1', [item({ googlePlaceId: 'ChIJabc' })])
    expect(db.provider.findFirst.mock.calls[0][0].where).toEqual({ householdId: 'h1', googlePlaceId: 'ChIJabc' })
  })

  it('never overwrites private fields or status on an existing provider', async () => {
    db.provider.findFirst.mockResolvedValue({
      id: 'p1', metaStatus: 'active', phone: null, email: 'keep@x.test',
      rating: 5, notes: 'mine', statusId: 's-hired', hiredAt: new Date(),
    })
    await service.ingestBatch('h1', [item({ email: 'new@x.test', phone: '614-555-0100' })])
    const data = db.provider.update.mock.calls[0][0].data
    expect(data).toEqual({ phone: '614-555-0100' }) // email already set, not overwritten
    expect(data).not.toHaveProperty('rating')
    expect(data).not.toHaveProperty('notes')
    expect(data).not.toHaveProperty('statusId')
    expect(data).not.toHaveProperty('hiredAt')
    expect(data).not.toHaveProperty('categoryId')
  })

  it('does not resurrect a soft-deleted provider but still counts it', async () => {
    db.provider.findFirst.mockResolvedValue({ id: 'p1', metaStatus: 'deleted' })
    const result = await service.ingestBatch('h1', [item()])
    expect(result.skippedDeleted).toBe(1)
    expect(db.provider.create).not.toHaveBeenCalled()
    expect(db.providerEvidence.createMany).not.toHaveBeenCalled()
  })

  it('a re-run adds zero evidence (dedupe via skipDuplicates)', async () => {
    db.provider.findFirst.mockResolvedValue({ id: 'p1', metaStatus: 'active' })
    db.providerEvidence.createMany.mockResolvedValue({ count: 0 })
    const result = await service.ingestBatch('h1', [item()])
    expect(result.evidenceAdded).toBe(0)
    expect(db.providerEvidence.createMany.mock.calls[0][0].skipDuplicates).toBe(true)
  })

  it('isolates a malformed item: others still ingest and the error is reported by index', async () => {
    db.provider.findFirst.mockResolvedValue(null)
    const result = await service.ingestBatch('h1', [item(), { nonsense: true }, item({ name: 'Other Co' })])
    expect(result.created).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].index).toBe(1)
  })

  it('a database error on one item is reported and does not stop the batch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.provider.findFirst.mockResolvedValue(null)
    db.provider.create.mockRejectedValueOnce(new Error('db down')).mockResolvedValue({ id: 'p2' })
    const result = await service.ingestBatch('h1', [item(), item({ name: 'Other Co' })])
    expect(result.created).toBe(1)
    expect(result.errors[0]).toMatchObject({ index: 0, message: 'db down' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/services/api-key-service.test.ts tests/unit/services/provider-ingest-service.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `ApiKeyService`**

```ts
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { generateApiKey, hashApiKey } from '@/server/utils/api-key';

export class ApiKeyService {
  /** Creates a key. The plaintext `key` is returned here and never retrievable again. */
  async create(householdId: string, userId: string, name: string) {
    const { key, prefix, hashedKey } = generateApiKey();
    const record = await prisma.apiKey.create({
      data: { householdId, name, prefix, hashedKey, createdByUserId: userId },
    });
    return { id: record.id, name, prefix, key };
  }

  async list(householdId: string) {
    return prisma.apiKey.findMany({
      where: { householdId },
      select: {
        id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(householdId: string, id: string) {
    const existing = await prisma.apiKey.findFirst({ where: { id, householdId } });
    if (!existing) throw new HttpError('API key not found', 404);
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async authenticate(key: string): Promise<{ householdId: string; apiKeyId: string } | null> {
    const record = await prisma.apiKey.findFirst({
      where: { hashedKey: hashApiKey(key), revokedAt: null },
    });
    if (!record) return null;
    await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return { householdId: record.householdId, apiKeyId: record.id };
  }
}
```

- [ ] **Step 4: Implement `defineApiKeyProtectedEventHandler`**

`server/utils/api-key-auth.ts`:

```ts
import { H3Event, createError, getHeader } from 'h3';
import { ApiKeyService } from '@/server/services/ApiKeyService';

export interface ApiKeyContext {
  householdId: string;
  apiKeyId: string;
}

export const defineApiKeyProtectedEventHandler = (
  handler: (event: H3Event, ctx: ApiKeyContext) => Promise<any>
) =>
  defineEventHandler(async (event: H3Event) => {
    const key = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '');
    if (!key) {
      throw createError({ statusCode: 401, message: 'Unauthorized: Missing API key' });
    }
    const ctx = await new ApiKeyService().authenticate(key);
    if (!ctx) {
      throw createError({ statusCode: 401, message: 'Unauthorized: Invalid API key' });
    }
    return handler(event, ctx);
  });
```

- [ ] **Step 5: Implement `ProviderIngestService`**

```ts
import prisma from '@/server/utils/prisma/client';
import { ProviderCategoryService } from '@/server/services/ProviderCategoryService';
import { ProviderStatusService } from '@/server/services/ProviderStatusService';
import { normalizeProviderName } from '@/server/utils/provider-matching';
import { ingestItemSchema } from '@/server/utils/provider-schemas';
import { type IngestResult } from '@/types/provider';

const DEFAULT_INGEST_STATUS = 'Lead';
// Contact-style fields the watcher may fill in when they are still empty.
const FILLABLE_FIELDS = [
  'company', 'primaryContactName', 'phone', 'email', 'website', 'address', 'licenseNumber', 'googlePlaceId',
] as const;

export class ProviderIngestService {
  private categories = new ProviderCategoryService();
  private statuses = new ProviderStatusService();

  async ingestBatch(householdId: string, rawItems: unknown[]): Promise<IngestResult> {
    const result: IngestResult = {
      created: 0, updated: 0, skippedDeleted: 0, evidenceAdded: 0, errors: [],
    };

    for (let index = 0; index < rawItems.length; index++) {
      const raw = rawItems[index];
      const parsed = ingestItemSchema.safeParse(raw);
      if (!parsed.success) {
        const name = typeof (raw as { name?: unknown })?.name === 'string' ? (raw as { name: string }).name : '';
        result.errors.push({ index, name, message: parsed.error.issues[0]?.message ?? 'Invalid item' });
        continue;
      }
      const item = parsed.data;
      try {
        const category = await this.categories.findOrCreateByName(householdId, item.category);
        const nameKey = normalizeProviderName(item.name);
        const existing = await prisma.provider.findFirst({
          where: item.googlePlaceId
            ? { householdId, googlePlaceId: item.googlePlaceId }
            : { householdId, categoryId: category.id, nameKey },
        });

        if (existing?.metaStatus === 'deleted') {
          result.skippedDeleted++;
          continue;
        }

        let providerId: string;
        if (existing) {
          const fill: Record<string, string> = {};
          for (const field of FILLABLE_FIELDS) {
            const incoming = item[field];
            if (incoming && !(existing as Record<string, unknown>)[field]) fill[field] = incoming;
          }
          if (Object.keys(fill).length > 0) {
            await prisma.provider.update({ where: { id: existing.id }, data: fill });
          }
          providerId = existing.id;
          result.updated++;
        } else {
          const status = await this.statuses.findOrCreateByName(
            householdId, item.status ?? DEFAULT_INGEST_STATUS
          );
          const created = await prisma.provider.create({
            data: {
              householdId,
              categoryId: category.id,
              statusId: status.id,
              name: item.name,
              nameKey,
              company: item.company ?? null,
              primaryContactName: item.primaryContactName ?? null,
              phone: item.phone ?? null,
              email: item.email ?? null,
              website: item.website ?? null,
              address: item.address ?? null,
              licenseNumber: item.licenseNumber ?? null,
              googlePlaceId: item.googlePlaceId ?? null,
            },
          });
          providerId = created.id;
          result.created++;
        }

        if (item.evidence.length > 0) {
          const added = await prisma.providerEvidence.createMany({
            data: item.evidence.map((e) => ({
              providerId,
              sourceUrl: e.sourceUrl,
              sourceGroup: e.sourceGroup ?? null,
              sourceDate: e.sourceDate ? new Date(e.sourceDate) : null,
              snippet: e.snippet ?? null,
              kind: e.kind,
            })),
            skipDuplicates: true,
          });
          result.evidenceAdded += added.count;
        }
      } catch (error) {
        console.error(`[ProviderIngestService] item ${index} failed:`, error);
        result.errors.push({
          index,
          name: item.name,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return result;
  }
}
```

- [ ] **Step 6: Implement the routes**

`server/api/ingest/providers.post.ts`:

```ts
import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProviderIngestService } from "@/server/services/ProviderIngestService";
import { ingestBatchSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineApiKeyProtectedEventHandler(async (event, { householdId }) => {
  try {
    const parsed = ingestBatchSchema.safeParse(await readBody(event));
    if (!parsed.success) {
      throw new HttpError(`Body must be { providers: [...] } with 1-500 items`, 400);
    }
    return await new ProviderIngestService().ingestBatch(householdId, parsed.data.providers);
  } catch (error) {
    return toHttpError(error, 'ingesting providers');
  }
});
```

`server/api/api-keys/index.get.ts` (admin) — `ApiKeyService.list(householdId)`.
`server/api/api-keys/index.post.ts` (admin) — body `z.object({ name: z.string().trim().min(1).max(100) })`; `create(householdId, authUser.userId, name)`; the response includes the plaintext `key`.
`server/api/api-keys/[id].delete.ts` (admin) — `revoke(householdId, id)`; return `{ success: true }`.

All three use `defineHouseholdAdminEventHandler` and `toHttpError` as in Task 5.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/services/api-key-service.test.ts tests/unit/services/provider-ingest-service.test.ts`
Expected: PASS.

- [ ] **Step 8: Manual end-to-end check of the ingest contract**

Run: `npm run dev`. Create a key with `fetch('/api/api-keys', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name:'watcher'})}).then(r=>r.json())` from the signed-in browser and copy `key`. Then:

```bash
curl -s -X POST http://localhost:3000/api/ingest/providers \
  -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  -d '{"providers":[{"name":"Best Exteriors (Drew Paetow)","category":"Roofing, Siding & Gutters","evidence":[{"sourceUrl":"https://example.test/1","kind":"third_party"}]}]}'
```

Expected: `{"created":1,"updated":0,"skippedDeleted":0,"evidenceAdded":1,"errors":[]}`. Run it again; expected `created:0, updated:1, evidenceAdded:0`. Run with a wrong key; expected 401.

- [ ] **Step 9: Commit**

```bash
git add server tests
git commit -m "feat: add API keys and provider ingest endpoint"
```

---

### Task 7: Client composable, provider list page, and navigation

**Files:**
- Create: `composables/useProviders.ts`, `pages/providers/index.vue`
- Modify: `components/AppHeader.vue` (nav link)

**Interfaces:**
- Consumes: HTTP routes from Tasks 5–6, `useApi()` from `utils/api.ts` (`get`, `post`, `put`, `delete`), types from `types/provider.ts`.
- Produces: `useProviders()` returning `{ listProviders, getProvider, createProvider, updateProvider, deleteProvider, listCategories, listStatuses, addComment, updateComment, deleteComment, addContact, updateContact, deleteContact }` used by Tasks 8–10.

- [ ] **Step 1: Write the composable**

`composables/useProviders.ts`:

```ts
import {
  type ProviderCategoryDto,
  type ProviderInput,
  type ProviderListFilters,
  type ProviderListItem,
  type ProviderStatusDto,
} from '@/types/provider';

export const useProviders = () => {
  const api = useApi();

  const listProviders = (filters: ProviderListFilters = {}) => {
    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.statusId) params.statusId = filters.statusId;
    if (filters.includeHidden) params.includeHidden = 'true';
    if (filters.sort) params.sort = filters.sort;
    return api.get<ProviderListItem[]>('/api/providers', { params });
  };

  const getProvider = (id: string) => api.get<any>(`/api/providers/${id}`);
  const createProvider = (input: ProviderInput) => api.post<{ id: string }>('/api/providers', input);
  const updateProvider = (id: string, input: Partial<ProviderInput>) => api.put(`/api/providers/${id}`, input);
  const deleteProvider = (id: string) => api.delete(`/api/providers/${id}`);

  const listCategories = () => api.get<ProviderCategoryDto[]>('/api/provider-categories');
  const listStatuses = () => api.get<ProviderStatusDto[]>('/api/provider-statuses');

  const addComment = (providerId: string, body: string) =>
    api.post(`/api/providers/${providerId}/comments`, { body });
  const updateComment = (providerId: string, commentId: string, body: string) =>
    api.put(`/api/providers/${providerId}/comments/${commentId}`, { body });
  const deleteComment = (providerId: string, commentId: string) =>
    api.delete(`/api/providers/${providerId}/comments/${commentId}`);

  const addContact = (providerId: string, contact: { name: string; role?: string; phone?: string; email?: string }) =>
    api.post(`/api/providers/${providerId}/contacts`, contact);
  const updateContact = (providerId: string, contactId: string, contact: Record<string, unknown>) =>
    api.put(`/api/providers/${providerId}/contacts/${contactId}`, contact);
  const deleteContact = (providerId: string, contactId: string) =>
    api.delete(`/api/providers/${providerId}/contacts/${contactId}`);

  return {
    listProviders, getProvider, createProvider, updateProvider, deleteProvider,
    listCategories, listStatuses,
    addComment, updateComment, deleteComment,
    addContact, updateContact, deleteContact,
  };
};
```

- [ ] **Step 2: Build `pages/providers/index.vue`**

A `<script setup lang="ts">` page (follow the header/card/loading/error structure of `pages/household/index.vue`) with:
- State: `providers`, `categories`, `statuses`, `loading`, `error`, `search`, `categoryId`, `statusId`, `sort` (default `'mentions'`), `includeHidden` (default `false`).
- `onMounted`: load categories and statuses, then providers.
- A `watch` on `[search, categoryId, statusId, sort, includeHidden]` that reloads with a 250 ms debounce on `search`.
- Toolbar: search input, category `<select>`, status `<select>`, sort `<select>` (options: Most mentioned, Recently mentioned, Highest rated, Name), a "Show hidden statuses (e.g. Leads)" checkbox, and an amber "Add provider" button linking to `/providers/new` (handled by Task 8).
- Empty state: "No providers yet. Add one, or point the watcher at your ingest API."
- Rows (white cards): name (link to `/providers/${id}`), company, category chip, status badge colored by `status.kind` (`positive` → `bg-green-100 text-green-800`, `negative` → `bg-red-50 text-red-700`, `neutral` → `bg-stone-100 text-stone-700`), phone (as a `tel:` link), star rating when present, and a "Recommended by N neighbors" badge when `neighborCount > 0` (`bg-amber-100 text-amber-800`).
- Page `definePageMeta` and any auth guard should match the other authenticated pages (`middleware/auth.global.ts` covers auth; confirm by loading the page signed out).

- [ ] **Step 3: Add the navigation link**

In `components/AppHeader.vue`, add `<NuxtLink to="/providers">Providers</NuxtLink>` beside the Dashboard link, using the same classes as the existing link.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`. Load `/providers`, confirm it lists the provider ingested in Task 6, that the Lead status is hidden until the checkbox is on, and that search, filters, and sorting change the list. Check at phone width.

- [ ] **Step 5: Commit**

```bash
git add composables pages components
git commit -m "feat: add providers list page and client composable"
```

---

### Task 8: Provider detail page, create/edit form, comments, contacts

**Files:**
- Create: `pages/providers/[id].vue`, `components/providers/ProviderForm.vue`, `components/providers/ProviderCommentList.vue`

**Interfaces:**
- Consumes: `useProviders()` (Task 7), `useAuthStore` for the current user id (to show edit/delete on your own comments).
- Produces: routes `/providers/new` and `/providers/[id]` (the `[id]` page treats `id === 'new'` as create mode).

- [ ] **Step 1: Build `ProviderForm.vue`**

Props: `modelValue: ProviderInput`, `categories`, `statuses`, `saving: boolean`. Emits `submit`, `cancel`. Fields: name (required), category select (required), status select, company, primary contact, phone, email, website, address, license number, Google Place ID (label it "Google Place ID"), rating (1–5 select with a blank option), hired date, and private notes textarea (label it "Private notes (only your household sees these)"). Inline validation: name and category required before emitting `submit`.

- [ ] **Step 2: Build `ProviderCommentList.vue`**

Props: `comments` (with `author.name`), `currentUserId`. Emits `add(body)`, `update(id, body)`, `remove(id)`. Renders oldest first with author name and relative time (`date-fns` `formatDistanceToNow`), a textarea + "Add comment" button, inline edit and delete on the current user's own comments only.

- [ ] **Step 3: Build `pages/providers/[id].vue`**

- Create mode (`id === 'new'`): show `ProviderForm`; on submit call `createProvider`, then `navigateTo('/providers/' + id)`.
- View mode: load with `getProvider`. Sections in white cards: header (name, company, category, status badge, rating, "Edit" and "Delete" buttons; delete asks `confirm('Remove this provider?')` then `deleteProvider` and returns to `/providers`), contact details (phone/email as `tel:`/`mailto:` links, website, address, license, Google Place ID), additional contacts (list, add, edit, remove via `addContact`/`updateContact`/`deleteContact`), neighbor evidence (each row: date, group, kind chip, snippet, and the source link opening in a new tab with `rel="noopener noreferrer"`; heading shows "N mentions · M neighbor recommendations"), private fields (hired date, notes), and the comments component.
- Edit mode toggles `ProviderForm` in place of the details card and calls `updateProvider`.
- A linked-tasks list from `provider.tasks` (links to `/tasks/${task.id}`); the linking UI itself comes in Task 10.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`. Create a provider by hand, edit it, add a contact, add/edit/delete a comment, then open the ingested provider and confirm the evidence links open. Switch users with the dev switcher and confirm the second user can comment but cannot edit or delete the first user's comment.

- [ ] **Step 5: Commit**

```bash
git add pages components
git commit -m "feat: add provider detail page with contacts and comments"
```

---

### Task 9: Admin settings page (categories, statuses, API keys)

**Files:**
- Create: `pages/household/providers-settings.vue`
- Modify: `pages/household/index.vue` (add a "Provider settings" link visible to admins only)

**Interfaces:**
- Consumes: `/api/provider-categories*`, `/api/provider-statuses*`, `/api/api-keys*` via `useApi()`; `householdInfo.isCurrentUserAdmin` pattern from `pages/household/index.vue`.

- [ ] **Step 1: Build the settings page**

Three white cards. Non-admins who load the page see "Only household admins can manage these settings" and nothing else (the API also enforces this with 403).

1. **Categories:** list with inline rename, up/down buttons that call `PUT /api/provider-categories/reorder` with the new `orderedIds`, an add-category input, and delete. When delete returns an error (409 means in use), open a small dialog "Move providers to:" with a `<select>` of the other categories, then re-call `DELETE /api/provider-categories/:id` with body `{ moveToId }`. Because `useApi` throws a generic message on non-OK responses, detect the 409 by calling `fetch` directly for delete and reading `response.status`, or by first checking usage: use the provider list already loaded on the page (`GET /api/providers?includeHidden=true`) to count providers per category and open the dialog up front when the count is above zero.
2. **Statuses:** same list/rename/reorder/add/delete-with-move behavior, plus a `kind` select (neutral/positive/negative) and a "Hide from list by default" checkbox per status.
3. **API keys:** table of name, prefix (`adk_xxxx…`), created, last used, revoked. "Create key" prompts for a name, calls `POST /api/api-keys`, and shows the returned `key` once in a highlighted box with a copy button and the warning "Copy this now — it won't be shown again." "Revoke" calls `DELETE /api/api-keys/:id`.

- [ ] **Step 2: Link from the household page**

In `pages/household/index.vue`, add a card or link "Provider settings" (`/household/providers-settings`) rendered only when `householdInfo.isCurrentUserAdmin`.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`. As an admin: rename a category, reorder two statuses, delete a category in use and confirm the move dialog appears and providers end up in the target, create then revoke an API key, and confirm a revoked key now gets 401 from the ingest curl in Task 6. As a non-admin (dev switcher): confirm the page is locked and a direct `POST /api/provider-categories` returns 403.

- [ ] **Step 4: Commit**

```bash
git add pages
git commit -m "feat: add admin settings for provider categories, statuses, and API keys"
```

---

### Task 10: Task-to-provider link

**Files:**
- Create: `server/services/TaskProviderService.ts`, `server/api/tasks/[id]/providers.get.ts`, `providers.post.ts`, `server/api/tasks/[id]/providers/[providerId].delete.ts`, `components/providers/TaskProviderPicker.vue`
- Modify: `components/TaskDetails.vue` (or the task detail page that renders it)
- Test: `tests/unit/services/task-provider-service.test.ts`

**Interfaces:**
- Consumes: `TaskProvider` model (Task 1), `HttpError`.
- Produces: `TaskProviderService`: `listForTask(householdId, taskId)`, `link(householdId, taskId, providerId)`, `unlink(householdId, taskId, providerId)`. Routes `GET/POST /api/tasks/:id/providers` (POST body `{ providerId }`) and `DELETE /api/tasks/:id/providers/:providerId`.

- [ ] **Step 1: Write the failing test**

`tests/unit/services/task-provider-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    taskDefinition: { findFirst: vi.fn() },
    provider: { findFirst: vi.fn() },
    taskProvider: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { TaskProviderService } from '@/server/services/TaskProviderService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

describe('TaskProviderService', () => {
  let service: TaskProviderService
  beforeEach(() => { service = new TaskProviderService(); vi.clearAllMocks() })

  it('refuses to link a task from another household', async () => {
    db.taskDefinition.findFirst.mockResolvedValue(null)
    await expect(service.link('h1', 't1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses to link a provider from another household', async () => {
    db.taskDefinition.findFirst.mockResolvedValue({ id: 't1' })
    db.provider.findFirst.mockResolvedValue(null)
    await expect(service.link('h1', 't1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
    expect(db.taskProvider.upsert).not.toHaveBeenCalled()
  })

  it('linking twice is idempotent (upsert on the unique pair)', async () => {
    db.taskDefinition.findFirst.mockResolvedValue({ id: 't1' })
    db.provider.findFirst.mockResolvedValue({ id: 'p1' })
    await service.link('h1', 't1', 'p1')
    expect(db.taskProvider.upsert.mock.calls[0][0].where).toEqual({
      taskId_providerId: { taskId: 't1', providerId: 'p1' },
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/services/task-provider-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```ts
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export class TaskProviderService {
  async listForTask(householdId: string, taskId: string) {
    await this.requireTask(householdId, taskId);
    return prisma.taskProvider.findMany({
      where: { taskId, provider: { householdId, metaStatus: 'active' } },
      include: {
        provider: {
          select: {
            id: true, name: true, phone: true,
            category: { select: { id: true, name: true } },
            status: { select: { id: true, name: true, kind: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async link(householdId: string, taskId: string, providerId: string) {
    await this.requireTask(householdId, taskId);
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return prisma.taskProvider.upsert({
      where: { taskId_providerId: { taskId, providerId } },
      create: { taskId, providerId },
      update: {},
    });
  }

  async unlink(householdId: string, taskId: string, providerId: string) {
    await this.requireTask(householdId, taskId);
    await prisma.taskProvider.deleteMany({ where: { taskId, providerId } });
  }

  private async requireTask(householdId: string, taskId: string) {
    const task = await prisma.taskDefinition.findFirst({ where: { id: taskId, householdId } });
    if (!task) throw new HttpError('Task not found', 404);
    return task;
  }
}
```

- [ ] **Step 4: Implement the routes**

All three use `defineHouseholdProtectedEventHandler` and `toHttpError`:
- `providers.get.ts` — `listForTask(householdId, event.context.params!.id)`.
- `providers.post.ts` — body `z.object({ providerId: z.string().min(1) })`; `link(...)`; returns `{ success: true }`.
- `providers/[providerId].delete.ts` — `unlink(householdId, params.id, params.providerId)`; returns `{ success: true }`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/services/task-provider-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Build the picker and wire it into task details**

`components/providers/TaskProviderPicker.vue`: props `taskId`. Loads `GET /api/tasks/:id/providers`, renders linked providers as chips (name linking to `/providers/:id`, an × to unlink), and an "Add provider" `<select>` fed by `listProviders({ includeHidden: true, sort: 'name' })` that excludes already-linked ones and calls `POST /api/tasks/:id/providers`. Render it in a "Providers" section in `components/TaskDetails.vue`. Also make the provider detail page's linked-tasks list (Task 8) refresh from `getProvider`.

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`. Open a task, link two providers, unlink one, open the provider and confirm the task appears in its linked-tasks list, and confirm linking the same provider twice does not duplicate it.

- [ ] **Step 8: Commit**

```bash
git add server components tests
git commit -m "feat: link providers to tasks"
```

---

### Task 11: Watcher loader script (scripts-and-agents repo)

**Files (in `/Users/davidhague/source/scripts-and-agents`):**
- Create: `scripts/providers_ingest.py`
- Test: `scripts/tests/test_providers_ingest.py` (use the repo's existing test location and runner if different; check `ls scripts | grep -i test` first)

**Interfaces:**
- Consumes: `POST {ADULTING_URL}/api/ingest/providers` (Task 6) with `Authorization: Bearer $ADULTING_API_KEY`; the ledger format of `logs/worthington-socials/worthington-contractors.md`.
- Produces: `parse_ledger(text: str) -> list[dict]` (returns ingest-ready items), `post_batches(items, url, key, batch_size=100) -> dict` (aggregate counts). CLI: `python scripts/providers_ingest.py [--ledger PATH] [--dry-run]`.

The ledger structure (verified against the live file): `## Category` headings; `### Name` entries; per-entry `- **Mentions:**`, `- **Context:**`, `- **Links:**` (semicolon-separated URLs), `- **Status:** lead (...)`; and, for merged entries, a `- **Provenance (original entries, unedited):**` block whose sub-entries are `  - *Name* [...] — N mention(s), last DATE in GROUP, third-party recommendation|self-promo / lead` followed by `    - Context:` and `    - Links:` lines. The top-level `## Open requests` and `## Archived` sections are not providers and must be skipped.

- [ ] **Step 1: Locate the watcher job**

Run: `grep -rIl "worthington-contractors" ~/.claude ~/source/scripts-and-agents --include=SKILL.md --include=*.md 2>/dev/null | grep -v logs/`. Expected: the skill or job definition that maintains the ledger. Read it. The watcher's own change (calling the API instead of writing markdown) is made there, using the same payload shape the loader produces; this task only builds the loader and the initial bulk load. If the job definition cannot be found, stop and ask David where the watcher lives before changing it.

- [ ] **Step 2: Write failing tests for `parse_ledger`**

Cover, using small inline fixtures copied from the real ledger:
- a plain entry becomes one item with `category` from its `##` heading, `name` from `###`, `phone` extracted from a trailing `(614-678-8885)`, `evidence` built from the `Links` line (one row per URL, `kind: "third_party"`, `snippet` from `Context`, `sourceGroup` from `in <group>` in the mentions line, `sourceDate` from `last: YYYY-MM-DD`);
- `**Status:** lead (not a verified recommendation)` maps to `status: "Lead"`, entries without it map to `status: "Recommended"`;
- a merged entry with a Provenance block produces one evidence row per provenance sub-entry link, with `kind` `third_party` or `self_promo` per the sub-entry's trailing label;
- `Best Exteriors (Drew Paetow)` splits into `name: "Best Exteriors"` and `primaryContactName: "Drew Paetow"` when the parenthetical is not a phone number;
- `## Open requests` and `## Archived` sections yield no items;
- an entry with no links yields an item with an empty `evidence` list (still valid for the API).

- [ ] **Step 3: Implement `parse_ledger` and `post_batches`**

`parse_ledger` is a line-oriented state machine over the headings and bullet prefixes above. `post_batches` chunks into batches of 100, POSTs each with `urllib.request` (no new dependencies) and the bearer key, raises on non-2xx, and sums `created/updated/skippedDeleted/evidenceAdded` while collecting `errors`. The CLI reads `ADULTING_URL` (default `http://localhost:3000`) and `ADULTING_API_KEY` from the environment, supports `--dry-run` (prints counts and the first three items as JSON without posting), and prints the aggregate result.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest scripts/tests/test_providers_ingest.py -v` (or the repo's runner).
Expected: PASS.

- [ ] **Step 5: Dry-run against the real ledger**

Run: `python scripts/providers_ingest.py --dry-run`
Expected: roughly 388 minus the non-provider sections' entries; per-category counts printed; no exceptions. Spot-check three items against the ledger by eye.

- [ ] **Step 6: Load into local adulting.diy, then re-run to prove idempotency**

Create a key in the settings page (Task 9), then:

```bash
ADULTING_URL=http://localhost:3000 ADULTING_API_KEY=<key> python scripts/providers_ingest.py
ADULTING_URL=http://localhost:3000 ADULTING_API_KEY=<key> python scripts/providers_ingest.py
```

Expected: first run reports the created count and evidence added; the second run reports `created: 0`, `evidenceAdded: 0`, `errors: []`. Open `/providers` and confirm the categories and roughly 300 non-lead providers appear, and that "Show hidden statuses" reveals the leads.

- [ ] **Step 7: Production load (only after David confirms)**

Do not run against production without David's go-ahead. Once confirmed, create a production key from the deployed settings page, run once with `ADULTING_URL` set to the production URL, and re-run to confirm zero changes. Never commit the key.

- [ ] **Step 8: Commit (in the scripts-and-agents repo)**

```bash
git add scripts/providers_ingest.py scripts/tests/test_providers_ingest.py
git commit -m "feat: add adulting.diy provider ingest loader for the Worthington ledger"
```

---

### Task 12: Documentation

**Files:**
- Modify/Create via the `update-docs` skill: `docs/functionality/` (new `providers.md`, `changelog.md`), `docs/tech/api-endpoints.md`, `docs/tech/` (new `provider-ingest.md`), `docs/next-up.md`, `CLAUDE.md` (data models list, project structure), `docs/plans/` (move this plan to `completed/` if that is the convention for `docs/superpowers/plans/`; otherwise leave it).

- [ ] **Step 1: Run the `update-docs` skill**

Invoke `update-docs`. Ensure the docs cover: the provider feature from a product view; the ingest API contract (payload, auth, idempotency, never-overwrite rules, soft-delete respect, limits of 500 items per request); the API key workflow; the new models; and the deferred items (quotes/engagements, attachments, cross-household pool) added to `docs/next-up.md`.

- [ ] **Step 2: Full test run and commit**

Run: `npx vitest run`
Expected: all tests pass (existing 416 plus the new ones).

```bash
git add docs CLAUDE.md
git commit -m "docs: document providers feature and ingest API"
```

---

## Self-Review

**Spec coverage**
- Data model (all 8 models plus `ProviderAttachment` deferral): Task 1. `hiddenByDefault` addition is recorded as a spec amendment in Task 1 Step 5.
- Categories/statuses admin-managed, in-use delete requires move, ingest auto-creates: Tasks 3, 5, 9, 6.
- Provider fields, contacts, private fields: Tasks 1, 4, 8.
- Comments by either spouse, author-only edit/delete: Tasks 4, 8.
- Evidence table, derived mention/neighbor counts, badge: Tasks 2, 4, 7, 8.
- Ingest API (auth, upsert keys, never overwrite, evidence dedupe, per-item errors, counts): Task 6.
- Per-household hashed API keys, shown once, revocable: Tasks 2, 6, 9.
- List/detail/settings UI and task-detail provider section: Tasks 7–10.
- Task link (many-to-many): Task 10.
- Watcher script and bulk load, idempotent: Task 11.
- Testing plan: unit tests in Tasks 2–6, 10, 11; household isolation is asserted in the service tests (`householdId` in every `where`, 404 for foreign ids).
- Docs: Task 12.

**Placeholder scan:** The route files in Tasks 5, 6, and 10 that "mirror" a fully shown route name the exact service call, schema, and status per route. No "TBD" or "add error handling" steps remain. The two UI pages in Tasks 7–9 describe structure and behavior rather than full markup because they follow the existing page conventions; each ends in a concrete browser verification.

**Type consistency:** `ProviderListItem`, `ProviderInput`, `IngestItem`, `IngestResult`, and `EvidenceSummary` are defined in Task 1 and used unchanged afterward. Service method names match across tasks (`findOrCreateByName`, `listForHousehold`, `remove(householdId, id, moveToId?)`). `HttpError`/`toHttpError` names are consistent. The `taskId_providerId` compound key matches the `@@unique([taskId, providerId])` declaration.

**Review Focus coverage:** re-run idempotency and zero-evidence (Task 6 tests), soft-deleted providers stay deleted (Task 6 test), name variants match (Tasks 2 and 6 tests), one bad item isolated (Tasks 5 and 6 tests), cross-household isolation (Tasks 3, 4, 10 tests), and delete-in-use returns 409 (Task 3 tests).

## Parallelism note (for the orchestrator)

Tasks 1–6 are sequential (each builds on the previous interfaces). After Task 6, Tasks 7→8 (list then detail), 9 (settings), 10 (task link), and 11 (watcher script, in a different repo) touch mostly disjoint files and can run in parallel; Task 8 depends on Task 7's composable, and Task 11's live verification depends on Task 9 for key creation (or a key made through the API in Task 6). Task 12 runs last.
