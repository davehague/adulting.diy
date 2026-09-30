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
