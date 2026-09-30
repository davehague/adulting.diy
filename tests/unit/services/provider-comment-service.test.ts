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
    expect(db.providerComment.findFirst.mock.calls[0][0].where.provider).toEqual({ householdId: 'h1' })
    expect(db.providerComment.update).not.toHaveBeenCalled()
  })

  it('only the author can delete', async () => {
    db.providerComment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'someone-else' })
    await expect(service.remove('h1', 'c1', 'u1')).rejects.toMatchObject({ statusCode: 403 })
    expect(db.providerComment.findFirst.mock.calls[0][0].where.provider).toEqual({ householdId: 'h1' })
  })
})
