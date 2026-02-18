import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HouseholdService } from '@/server/services/HouseholdService'
import prisma from '@/server/utils/prisma/client'

describe('HouseholdService', () => {
  let service: HouseholdService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new HouseholdService()
  })

  describe('removeUser', () => {
    const userId = 'user-1'
    const householdId = 'household-1'

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        name: 'Jane Doe',
        householdId,
      } as any)
    })

    it('creates a former member record with the user name', async () => {
      vi.mocked(prisma.taskDefinition.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)
      vi.mocked((prisma as any).formerHouseholdMember.upsert).mockResolvedValue({} as any)

      await service.removeUser(userId)

      expect(vi.mocked((prisma as any).formerHouseholdMember.upsert)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_householdId: { userId, householdId } },
          create: expect.objectContaining({ userId, householdId, name: 'Jane Doe' }),
          update: expect.objectContaining({ name: 'Jane Doe' }),
        })
      )
    })

    it('removes user from defaultAssigneeIds on task definitions', async () => {
      vi.mocked(prisma.taskDefinition.findMany).mockResolvedValue([
        { id: 'task-1', defaultAssigneeIds: [userId, 'user-2'] },
        { id: 'task-2', defaultAssigneeIds: ['user-2'] },
        { id: 'task-3', defaultAssigneeIds: [userId] },
      ] as any)
      vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([])
      vi.mocked(prisma.taskDefinition.update).mockResolvedValue({} as any)
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)
      vi.mocked((prisma as any).formerHouseholdMember.upsert).mockResolvedValue({} as any)

      await service.removeUser(userId)

      const updateCalls = vi.mocked(prisma.taskDefinition.update).mock.calls
      // Should update task-1 and task-3 (which contain the user), not task-2
      expect(updateCalls).toHaveLength(2)
      expect(updateCalls[0][0]).toEqual(expect.objectContaining({
        where: { id: 'task-1' },
        data: { defaultAssigneeIds: ['user-2'] },
      }))
      expect(updateCalls[1][0]).toEqual(expect.objectContaining({
        where: { id: 'task-3' },
        data: { defaultAssigneeIds: [] },
      }))
    })

    it('removes user from future actionable occurrences', async () => {
      vi.mocked(prisma.taskDefinition.findMany).mockResolvedValue([
        { id: 'task-1', defaultAssigneeIds: [] },
      ] as any)
      vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([
        { id: 'occ-1', assigneeIds: [userId, 'user-2'] },
        { id: 'occ-2', assigneeIds: ['user-2'] },
      ] as any)
      vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)
      vi.mocked((prisma as any).formerHouseholdMember.upsert).mockResolvedValue({} as any)

      await service.removeUser(userId)

      const occUpdateCalls = vi.mocked(prisma.taskOccurrence.update).mock.calls
      // Only occ-1 should be updated (contains the user)
      expect(occUpdateCalls).toHaveLength(1)
      expect(occUpdateCalls[0][0]).toEqual(expect.objectContaining({
        where: { id: 'occ-1' },
        data: { assigneeIds: ['user-2'] },
      }))
    })

    it('queries only future actionable occurrences', async () => {
      vi.mocked(prisma.taskDefinition.findMany).mockResolvedValue([
        { id: 'task-1', defaultAssigneeIds: [] },
      ] as any)
      vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)
      vi.mocked((prisma as any).formerHouseholdMember.upsert).mockResolvedValue({} as any)

      await service.removeUser(userId)

      expect(vi.mocked(prisma.taskOccurrence.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            taskId: { in: ['task-1'] },
            status: { in: ['created', 'assigned'] },
            dueDate: { gte: expect.any(Date) },
          }),
        })
      )
    })

    it('nulls householdId and sets isAdmin false', async () => {
      vi.mocked(prisma.taskDefinition.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)
      vi.mocked((prisma as any).formerHouseholdMember.upsert).mockResolvedValue({} as any)

      await service.removeUser(userId)

      expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({
            householdId: null,
            isAdmin: false,
          }),
        })
      )
    })

    it('throws if user is not in a household', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        name: 'Jane Doe',
        householdId: null,
      } as any)

      await expect(service.removeUser(userId)).rejects.toThrow('User not found or not in a household')
    })

    it('throws if user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(service.removeUser(userId)).rejects.toThrow('User not found or not in a household')
    })
  })

  describe('addUser', () => {
    it('deletes former member record when user rejoins', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)
      vi.mocked((prisma as any).formerHouseholdMember.deleteMany).mockResolvedValue({ count: 1 })

      await service.addUser('household-1', 'user-1', false)

      expect(vi.mocked((prisma as any).formerHouseholdMember.deleteMany)).toHaveBeenCalledWith({
        where: { userId: 'user-1', householdId: 'household-1' },
      })
    })
  })

  describe('getFormerMembers', () => {
    it('returns former members ordered by leftAt desc', async () => {
      const mockFormer = [
        { id: 'fm-1', userId: 'user-1', householdId: 'h-1', name: 'Jane', leftAt: new Date() },
      ]
      vi.mocked((prisma as any).formerHouseholdMember.findMany).mockResolvedValue(mockFormer)

      const result = await service.getFormerMembers('h-1')

      expect(result).toEqual(mockFormer)
      expect(vi.mocked((prisma as any).formerHouseholdMember.findMany)).toHaveBeenCalledWith({
        where: { householdId: 'h-1' },
        orderBy: { leftAt: 'desc' },
      })
    })
  })
})
