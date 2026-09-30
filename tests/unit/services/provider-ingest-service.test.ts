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

  it('stores a null sourceDate when the date string is unparseable', async () => {
    db.provider.findFirst.mockResolvedValue(null)
    const evidence = [
      { sourceUrl: 'https://fb.test/1', kind: 'third_party', sourceDate: 'not a date' },
      { sourceUrl: 'https://fb.test/2', kind: 'third_party', sourceDate: '2026-01-15T00:00:00Z' },
    ]
    const result = await service.ingestBatch('h1', [item({ evidence })])
    expect(result.errors).toEqual([])
    const rows = db.providerEvidence.createMany.mock.calls[0][0].data
    expect(rows[0].sourceDate).toBeNull()
    expect(rows[1].sourceDate).toEqual(new Date('2026-01-15T00:00:00Z'))
  })
})
