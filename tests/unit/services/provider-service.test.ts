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

describe('ProviderService.update', () => {
  let service: ProviderService
  beforeEach(() => { service = new ProviderService(); vi.clearAllMocks() })

  it('ignores non-writable keys in the input', async () => {
    db.provider.findFirst.mockResolvedValue({ id: 'p1' })
    db.provider.update.mockResolvedValue({ id: 'p1' })
    await service.update('h1', 'p1', {
      notes: 'hi', householdId: 'h2', metaStatus: 'deleted', nameKey: 'x', id: 'other',
    } as never)
    expect(db.provider.update.mock.calls[0][0].data).toEqual({ notes: 'hi' })
  })

  it('rejects a null categoryId with 400', async () => {
    db.provider.findFirst.mockResolvedValue({ id: 'p1' })
    await expect(service.update('h1', 'p1', { categoryId: null } as never))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(db.provider.update).not.toHaveBeenCalled()
  })
})

describe('ProviderService.softDelete', () => {
  it('404s for a provider in another household', async () => {
    const service = new ProviderService()
    db.provider.findFirst.mockResolvedValue(null)
    await expect(service.softDelete('h1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
  })
})
