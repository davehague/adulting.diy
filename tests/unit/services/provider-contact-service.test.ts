import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    provider: { findFirst: vi.fn() },
    providerContact: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderContactService } from '@/server/services/ProviderContactService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

describe('ProviderContactService', () => {
  let service: ProviderContactService
  beforeEach(() => { service = new ProviderContactService(); vi.clearAllMocks() })

  it('add 404s for a provider in another household', async () => {
    db.provider.findFirst.mockResolvedValue(null)
    await expect(service.add('h1', 'p1', { name: 'A' })).rejects.toMatchObject({ statusCode: 404 })
    expect(db.providerContact.create).not.toHaveBeenCalled()
  })

  it('update scopes the lookup by household and ignores providerId in input', async () => {
    db.providerContact.findFirst.mockResolvedValue({ id: 'c1' })
    db.providerContact.update.mockResolvedValue({ id: 'c1' })
    await service.update('h1', 'c1', { name: 'B', providerId: 'foreign' } as never)
    expect(db.providerContact.findFirst.mock.calls[0][0].where.provider).toEqual({ householdId: 'h1' })
    expect(db.providerContact.update.mock.calls[0][0].data).toEqual({ name: 'B' })
  })

  it('remove scopes the lookup by household and 404s when missing', async () => {
    db.providerContact.findFirst.mockResolvedValue(null)
    await expect(service.remove('h1', 'c1')).rejects.toMatchObject({ statusCode: 404 })
    expect(db.providerContact.findFirst.mock.calls[0][0].where.provider).toEqual({ householdId: 'h1' })
    expect(db.providerContact.delete).not.toHaveBeenCalled()
  })
})
