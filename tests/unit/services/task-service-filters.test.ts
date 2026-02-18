import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    taskDefinition: {
      findMany: vi.fn(),
    },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { TaskService } from '@/server/services/TaskService'

const mockedPrisma = prisma as unknown as {
  taskDefinition: {
    findMany: ReturnType<typeof vi.fn>
  }
}

describe('TaskService.findForHousehold filters', () => {
  let service: TaskService
  const householdId = 'household-test-1'

  beforeEach(() => {
    service = new TaskService()
    vi.clearAllMocks()
    // Return empty array by default so .map() works
    mockedPrisma.taskDefinition.findMany.mockResolvedValue([])
  })

  // ---- 1. No filters -- excludes soft-deleted by default ----
  it('excludes soft-deleted tasks by default when no filters provided', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: { not: 'soft-deleted' },
        }),
      })
    )
  })

  // ---- 2. Status filter -- sets metaStatus to provided value ----
  it('sets metaStatus to the provided status filter value', async () => {
    await service.findForHousehold(householdId, { status: 'active' })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'active',
        }),
      })
    )
  })

  it('sets metaStatus to paused when status filter is paused', async () => {
    await service.findForHousehold(householdId, { status: 'paused' })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'paused',
        }),
      })
    )
  })

  // ---- 3. Soft-deleted filter -- allows explicit soft-deleted query ----
  it('allows querying for soft-deleted tasks explicitly', async () => {
    await service.findForHousehold(householdId, { status: 'soft-deleted' })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'soft-deleted',
        }),
      })
    )
  })

  // ---- 4. CategoryId filter -- adds categoryId to where ----
  it('adds categoryId to the where clause when provided', async () => {
    const categoryId = 'cat-123'
    await service.findForHousehold(householdId, { categoryId })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          categoryId,
          metaStatus: { not: 'soft-deleted' },
        }),
      })
    )
  })

  // ---- 5. Search filter -- adds OR clause with name + description ----
  it('adds OR clause with case-insensitive name and description search', async () => {
    const search = 'dishes'
    await service.findForHousehold(householdId, { search })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: { not: 'soft-deleted' },
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  // ---- 6. Status + categoryId combined ----
  it('combines status and categoryId filters', async () => {
    await service.findForHousehold(householdId, {
      status: 'active',
      categoryId: 'cat-456',
    })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'active',
          categoryId: 'cat-456',
        }),
      })
    )
  })

  // ---- 7. Status + search combined ----
  it('combines status and search filters', async () => {
    await service.findForHousehold(householdId, {
      status: 'paused',
      search: 'lawn',
    })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'paused',
          OR: [
            { name: { contains: 'lawn', mode: 'insensitive' } },
            { description: { contains: 'lawn', mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  // ---- 8. CategoryId + search combined (still excludes soft-deleted) ----
  it('combines categoryId and search filters while still excluding soft-deleted', async () => {
    await service.findForHousehold(householdId, {
      categoryId: 'cat-789',
      search: 'clean',
    })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: { not: 'soft-deleted' },
          categoryId: 'cat-789',
          OR: [
            { name: { contains: 'clean', mode: 'insensitive' } },
            { description: { contains: 'clean', mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  // ---- 9. All three filters combined ----
  it('combines status, categoryId, and search filters', async () => {
    await service.findForHousehold(householdId, {
      status: 'active',
      categoryId: 'cat-all',
      search: 'vacuum',
    })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'active',
          categoryId: 'cat-all',
          OR: [
            { name: { contains: 'vacuum', mode: 'insensitive' } },
            { description: { contains: 'vacuum', mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  // ---- 10. Includes next pending occurrence ----
  it('includes next pending occurrence ordered by dueDate asc with take 1', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          category: true,
          occurrences: expect.objectContaining({
            where: {
              status: { in: ['created', 'assigned'] },
            },
            orderBy: { dueDate: 'asc' },
            take: 1,
          }),
        }),
      })
    )
  })

  // ---- 11. Orders results by name ascending ----
  it('orders results by name ascending', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
      })
    )
  })
})
