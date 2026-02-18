import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    taskOccurrence: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    taskDefinition: {
      groupBy: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { DashboardService } from '@/server/services/DashboardService'

const mockedPrisma = prisma as unknown as {
  taskOccurrence: {
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
  taskDefinition: {
    groupBy: ReturnType<typeof vi.fn>
  }
  category: {
    findMany: ReturnType<typeof vi.fn>
  }
  user: {
    findMany: ReturnType<typeof vi.fn>
  }
}

describe('DashboardService', () => {
  let service: DashboardService

  beforeEach(() => {
    service = new DashboardService()
    vi.clearAllMocks()
  })

  it('returns all dashboard sections', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(0)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([])
    mockedPrisma.user.findMany.mockResolvedValue([])

    const result = await service.getDashboardData('household-1')

    expect(result).toHaveProperty('pendingOccurrences')
    expect(result).toHaveProperty('recentlyCompletedCount')
    expect(result).toHaveProperty('categoryBreakdown')
    expect(result).toHaveProperty('householdMembers')
  })

  it('uses count() for recently completed instead of fetching full objects', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(7)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([])
    mockedPrisma.user.findMany.mockResolvedValue([])

    const result = await service.getDashboardData('household-1')

    expect(result.recentlyCompletedCount).toBe(7)
    expect(mockedPrisma.taskOccurrence.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'completed',
          completedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
  })

  it('uses select for pending occurrences to minimize data', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(0)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([])
    mockedPrisma.user.findMany.mockResolvedValue([])

    await service.getDashboardData('household-1')

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          dueDate: true,
          assigneeIds: true,
          status: true,
          task: expect.objectContaining({
            select: expect.objectContaining({
              name: true,
            }),
          }),
        }),
      })
    )
  })

  it('uses groupBy for category breakdown', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(0)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([
      { categoryId: 'cat-1', _count: { id: 5 } },
      { categoryId: 'cat-2', _count: { id: 3 } },
    ])
    mockedPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Kitchen' },
      { id: 'cat-2', name: 'Bathroom' },
    ])
    mockedPrisma.user.findMany.mockResolvedValue([])

    const result = await service.getDashboardData('household-1')

    expect(result.categoryBreakdown).toEqual([
      { name: 'Kitchen', count: 5 },
      { name: 'Bathroom', count: 3 },
    ])
  })

  it('sorts category breakdown by count descending', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(0)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([
      { categoryId: 'cat-1', _count: { id: 2 } },
      { categoryId: 'cat-2', _count: { id: 8 } },
    ])
    mockedPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Yard' },
      { id: 'cat-2', name: 'Kitchen' },
    ])
    mockedPrisma.user.findMany.mockResolvedValue([])

    const result = await service.getDashboardData('household-1')

    expect(result.categoryBreakdown[0].name).toBe('Kitchen')
    expect(result.categoryBreakdown[1].name).toBe('Yard')
  })

  it('filters pending occurrences by household and non-deleted status', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(0)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([])
    mockedPrisma.user.findMany.mockResolvedValue([])

    await service.getDashboardData('household-1')

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['created', 'assigned'] },
          task: expect.objectContaining({
            householdId: 'household-1',
            metaStatus: { not: 'soft-deleted' },
          }),
        }),
      })
    )
  })

  it('uses select for household members', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(0)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([])
    mockedPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'a@test.com', isAdmin: true },
    ])

    const result = await service.getDashboardData('household-1')

    expect(result.householdMembers).toEqual([
      { id: 'u1', name: 'Alice', email: 'a@test.com', isAdmin: true },
    ])
    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId: 'household-1' },
        select: { id: true, name: true, email: true, isAdmin: true },
      })
    )
  })

  it('returns empty category breakdown when no active tasks', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
    mockedPrisma.taskOccurrence.count.mockResolvedValue(0)
    mockedPrisma.taskDefinition.groupBy.mockResolvedValue([])
    mockedPrisma.user.findMany.mockResolvedValue([])

    const result = await service.getDashboardData('household-1')

    expect(result.categoryBreakdown).toEqual([])
    // Should not call category.findMany when there are no tasks
    expect(mockedPrisma.category.findMany).not.toHaveBeenCalled()
  })
})
