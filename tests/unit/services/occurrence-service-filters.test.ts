import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    taskOccurrence: {
      findMany: vi.fn(),
    },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { OccurrenceService } from '@/server/services/OccurrenceService'

const mockedPrisma = prisma as unknown as {
  taskOccurrence: {
    findMany: ReturnType<typeof vi.fn>
  }
}

describe('OccurrenceService.findForHousehold filters', () => {
  let service: OccurrenceService
  const householdId = 'household-test-1'

  beforeEach(() => {
    service = new OccurrenceService()
    vi.clearAllMocks()
    // Return empty array by default so client-side filtering works
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
  })

  // ---- 1. No filters -- filters by household and excludes soft-deleted tasks ----
  it('filters by household and excludes soft-deleted tasks when no filters provided', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: expect.objectContaining({
            householdId,
            metaStatus: { not: 'soft-deleted' },
          }),
        }),
      })
    )
  })

  // ---- 2. Single status filter ----
  it('sets status on occurrence where clause when single status provided', async () => {
    await service.findForHousehold(householdId, { status: 'completed' })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'completed',
          task: expect.objectContaining({
            householdId,
            metaStatus: { not: 'soft-deleted' },
          }),
        }),
      })
    )
  })

  // ---- 3. Multiple statuses via statusIn ----
  it('splits comma-separated statusIn into { in: [...] }', async () => {
    await service.findForHousehold(householdId, { statusIn: 'created,assigned' })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['created', 'assigned'] },
          task: expect.objectContaining({
            householdId,
          }),
        }),
      })
    )
  })

  // ---- 4. Status takes precedence over statusIn when both provided ----
  it('uses status and ignores statusIn when both are provided', async () => {
    await service.findForHousehold(householdId, {
      status: 'completed',
      statusIn: 'created,assigned',
    })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'completed',
        }),
      })
    )

    // Verify statusIn was NOT applied (no { in: [...] } structure)
    const callArgs = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(callArgs.where.status).toBe('completed')
  })

  // ---- 5. CategoryId filter ----
  it('applies categoryId on the task relation where clause', async () => {
    const categoryId = 'cat-123'
    await service.findForHousehold(householdId, { categoryId })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: expect.objectContaining({
            householdId,
            metaStatus: { not: 'soft-deleted' },
            categoryId,
          }),
        }),
      })
    )
  })

  // ---- 6. AssigneeId filter ----
  it('uses { has: assigneeId } on assigneeIds array', async () => {
    const assigneeId = 'user-abc'
    await service.findForHousehold(householdId, { assigneeId })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assigneeIds: { has: assigneeId },
          task: expect.objectContaining({
            householdId,
          }),
        }),
      })
    )
  })

  // ---- 7. DueDateFrom only ----
  it('sets dueDate gte when dueDateFrom is provided', async () => {
    const dueDateFrom = new Date('2026-01-01')
    await service.findForHousehold(householdId, { dueDateFrom })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { gte: dueDateFrom },
        }),
      })
    )
  })

  // ---- 8. DueDateTo only ----
  it('sets dueDate lte when dueDateTo is provided', async () => {
    const dueDateTo = new Date('2026-12-31')
    await service.findForHousehold(householdId, { dueDateTo })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { lte: dueDateTo },
        }),
      })
    )
  })

  // ---- 9. Full date range (from + to) ----
  it('sets dueDate gte and lte when both dueDateFrom and dueDateTo are provided', async () => {
    const dueDateFrom = new Date('2026-01-01')
    const dueDateTo = new Date('2026-12-31')
    await service.findForHousehold(householdId, { dueDateFrom, dueDateTo })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { gte: dueDateFrom, lte: dueDateTo },
        }),
      })
    )
  })

  // ---- 10. Search filter on task name (client-side) ----
  it('filters results client-side by task name matching search term', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
      { id: '2', task: { name: 'Mow the lawn', description: null } },
      { id: '3', task: { name: 'Kitchen deep clean', description: null } },
    ])

    const results = await service.findForHousehold(householdId, { search: 'kitchen' })

    expect(results).toHaveLength(2)
    expect(results.map((r: any) => r.id)).toEqual(['1', '3'])
  })

  // ---- 11. Search is case-insensitive ----
  it('performs case-insensitive search matching', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean Kitchen', description: null } },
      { id: '2', task: { name: 'Mow the lawn', description: null } },
    ])

    const results = await service.findForHousehold(householdId, { search: 'KITCHEN' })

    expect(results).toHaveLength(1)
    expect((results[0] as any).id).toBe('1')
  })

  // ---- 12. Combined: status + categoryId + assigneeId ----
  it('combines status, categoryId, and assigneeId filters', async () => {
    await service.findForHousehold(householdId, {
      status: 'assigned',
      categoryId: 'cat-456',
      assigneeId: 'user-xyz',
    })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'assigned',
          assigneeIds: { has: 'user-xyz' },
          task: expect.objectContaining({
            householdId,
            metaStatus: { not: 'soft-deleted' },
            categoryId: 'cat-456',
          }),
        }),
      })
    )
  })

  // ---- 13. Combined: statusIn + date range + search ----
  it('combines statusIn, date range, and search filters', async () => {
    const dueDateFrom = new Date('2026-03-01')
    const dueDateTo = new Date('2026-06-30')

    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
      { id: '2', task: { name: 'Mow the lawn', description: null } },
    ])

    const results = await service.findForHousehold(householdId, {
      statusIn: 'created,assigned',
      dueDateFrom,
      dueDateTo,
      search: 'kitchen',
    })

    // Verify DB-level filters
    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['created', 'assigned'] },
          dueDate: { gte: dueDateFrom, lte: dueDateTo },
        }),
      })
    )

    // Verify client-side search filtered the results
    expect(results).toHaveLength(1)
    expect((results[0] as any).id).toBe('1')
  })

  // ---- 14. Combined: ALL filters together ----
  it('combines all filters together', async () => {
    const dueDateFrom = new Date('2026-01-01')
    const dueDateTo = new Date('2026-12-31')

    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: 'Deep scrub' } },
      { id: '2', task: { name: 'Organize pantry', description: null } },
    ])

    const results = await service.findForHousehold(householdId, {
      status: 'assigned',
      statusIn: 'created,completed', // should be ignored because status is set
      categoryId: 'cat-all',
      assigneeId: 'user-all',
      dueDateFrom,
      dueDateTo,
      search: 'kitchen',
    })

    // DB-level: status takes precedence over statusIn
    const callArgs = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(callArgs.where.status).toBe('assigned')
    expect(callArgs.where.assigneeIds).toEqual({ has: 'user-all' })
    expect(callArgs.where.dueDate).toEqual({ gte: dueDateFrom, lte: dueDateTo })
    expect(callArgs.where.task.categoryId).toBe('cat-all')
    expect(callArgs.where.task.householdId).toBe(householdId)
    expect(callArgs.where.task.metaStatus).toEqual({ not: 'soft-deleted' })

    // Client-side search
    expect(results).toHaveLength(1)
    expect((results[0] as any).id).toBe('1')
  })

  // ---- 15. Search returns empty when nothing matches ----
  it('returns empty array when search matches no results', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
      { id: '2', task: { name: 'Mow the lawn', description: null } },
    ])

    const results = await service.findForHousehold(householdId, { search: 'nonexistent' })

    expect(results).toHaveLength(0)
  })

  // ---- 16. Whitespace-only search skips filtering ----
  it('skips search filtering when search is whitespace-only', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
      { id: '2', task: { name: 'Mow the lawn', description: null } },
    ])

    const results = await service.findForHousehold(householdId, { search: '   ' })

    // All results returned because whitespace-only search is skipped
    expect(results).toHaveLength(2)
  })

  // ---- 17. Includes task with category in results ----
  it('includes task with category in the query', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          task: expect.objectContaining({
            include: expect.objectContaining({
              category: true,
            }),
          }),
        }),
      })
    )
  })

  // ---- 18. Orders by dueDate ascending ----
  it('orders results by dueDate ascending', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { dueDate: 'asc' },
      })
    )
  })

  // ---- Additional: Search matches on description too ----
  it('filters results client-side by task description matching search term', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Task A', description: 'Scrub the kitchen floor' } },
      { id: '2', task: { name: 'Task B', description: 'Water the garden' } },
    ])

    const results = await service.findForHousehold(householdId, { search: 'kitchen' })

    expect(results).toHaveLength(1)
    expect((results[0] as any).id).toBe('1')
  })

  // ---- Additional: statusIn trims whitespace around values ----
  it('trims whitespace from statusIn values', async () => {
    await service.findForHousehold(householdId, { statusIn: ' created , assigned ' })

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['created', 'assigned'] },
        }),
      })
    )
  })
})
