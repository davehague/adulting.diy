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
    expect(db.provider.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(db.providerCategory.delete.mock.invocationCallOrder[0])
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
