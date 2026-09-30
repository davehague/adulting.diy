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
