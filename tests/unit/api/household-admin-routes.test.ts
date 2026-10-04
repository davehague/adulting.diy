import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/server/utils/prisma/client'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

// Sign in through the dev bypass so the real auth wrappers (verifyAuth, household
// and admin checks) run against the mocked database.
vi.mock('@/server/utils/dev-auth', () => ({
  devAuthService: {
    isDevBypassEnabled: () => true,
    getUserById: vi.fn(),
  },
}))

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { devAuthService } from '@/server/utils/dev-auth'
import updateHousehold from '@/server/api/household/index.put'
import regenerateInviteCode from '@/server/api/household/invite-code/regenerate.post'
import removeUser from '@/server/api/household/users/[userId].delete'
import setAdmin from '@/server/api/household/users/[userId]/admin.put'

const householdId = 'household-1'

interface Member {
  id: string
  name: string
  email: string
  isAdmin: boolean
  householdId: string
}

const member = (id: string, isAdmin: boolean): Member => ({
  id,
  name: id,
  email: `${id}@example.com`,
  isAdmin,
  householdId,
})

let members: Member[] = []

const callAs = (handler: any, userId: string, params: Record<string, string> = {}) =>
  handler({
    node: { req: { headers: { 'x-dev-user-id': userId } } },
    context: { params },
  })

describe('household admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    members = [member('admin-1', true), member('member-1', false), member('member-2', false)]

    vi.mocked(devAuthService.getUserById).mockImplementation(
      async (id: string) => (members.find(m => m.id === id) ?? null) as any
    )
    // Mimics Prisma: a filter whose value is undefined is ignored.
    vi.mocked(prisma.user.findFirst).mockImplementation((async ({ where }: any) =>
      members.find(m =>
        (where.id === undefined || m.id === where.id) &&
        (where.householdId === undefined || m.householdId === where.householdId)
      ) ?? null) as any)
    vi.mocked(prisma.user.findMany).mockImplementation((async () => members) as any)
    ;(prisma.user as any).count = vi.fn(async () => members.filter(m => m.isAdmin).length)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)
    ;(prisma.household as any).update = vi.fn().mockResolvedValue({
      id: householdId, name: 'Home', inviteCode: 'NEWCODE', timezone: 'UTC', updatedAt: new Date(),
    })
  })

  describe('PUT /api/household', () => {
    beforeEach(() => vi.mocked(readBody).mockResolvedValue({ name: 'New name' }))

    it('rejects a non-admin with 403 and does not update', async () => {
      await expect(callAs(updateHousehold, 'member-1')).rejects.toMatchObject({ statusCode: 403 })
      expect((prisma.household as any).update).not.toHaveBeenCalled()
    })

    it('allows an admin', async () => {
      await expect(callAs(updateHousehold, 'admin-1')).resolves.toMatchObject({ id: householdId })
      expect((prisma.household as any).update).toHaveBeenCalled()
    })
  })

  describe('POST /api/household/invite-code/regenerate', () => {
    it('rejects a non-admin with 403', async () => {
      await expect(callAs(regenerateInviteCode, 'member-1')).rejects.toMatchObject({ statusCode: 403 })
      expect((prisma.household as any).update).not.toHaveBeenCalled()
    })

    it('allows an admin', async () => {
      await expect(callAs(regenerateInviteCode, 'admin-1')).resolves.toMatchObject({ success: true })
    })
  })

  describe('DELETE /api/household/users/:userId', () => {
    it('rejects a non-admin with 403', async () => {
      await expect(callAs(removeUser, 'member-1', { userId: 'member-2' }))
        .rejects.toMatchObject({ statusCode: 403 })
    })

    it('blocks an admin from removing themselves (400)', async () => {
      await expect(callAs(removeUser, 'admin-1', { userId: 'admin-1' }))
        .rejects.toMatchObject({ statusCode: 400 })
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('lets an admin remove another member', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'member-2', householdId } as any)
      vi.mocked(prisma.taskDefinition.findMany).mockResolvedValue([])
      vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([])
      vi.mocked((prisma as any).formerHouseholdMember.upsert).mockResolvedValue({} as any)

      await expect(callAs(removeUser, 'admin-1', { userId: 'member-2' }))
        .resolves.toMatchObject({ success: true })
    })
  })

  describe('PUT /api/household/users/:userId/admin', () => {
    beforeEach(() => vi.mocked(readBody).mockResolvedValue({ isAdmin: true }))

    it('rejects a non-admin with 403 and does not promote anyone', async () => {
      await expect(callAs(setAdmin, 'member-1', { userId: 'member-1' }))
        .rejects.toMatchObject({ statusCode: 403 })
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('lets an admin promote a member', async () => {
      await expect(callAs(setAdmin, 'admin-1', { userId: 'member-1' }))
        .resolves.toMatchObject({ success: true })
      expect(prisma.user.update).toHaveBeenCalled()
    })

    it('stops the only admin demoting themselves (400)', async () => {
      vi.mocked(readBody).mockResolvedValue({ isAdmin: false })

      await expect(callAs(setAdmin, 'admin-1', { userId: 'admin-1' }))
        .rejects.toMatchObject({ statusCode: 400 })
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })
})
