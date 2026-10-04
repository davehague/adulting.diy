import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import prisma from '@/server/utils/prisma/client'

// The cron handler is wrapped in defineSchedulerProtectedEventHandler (auto-imported
// Nitro util); stub it so the wrapped function can be called directly.
vi.stubGlobal('defineSchedulerProtectedEventHandler', (handler: any) => handler)

const db = prisma as unknown as Record<string, any>

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day)

const makePrismaTask = (scheduleConfig: unknown) => ({
  id: 'task-1',
  name: 'Test Task',
  description: null,
  instructions: null,
  householdId: 'household-1',
  categoryId: 'cat-1',
  metaStatus: 'active',
  scheduleConfig,
  reminderConfig: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByUserId: 'user-1',
  defaultAssigneeIds: [],
  category: { id: 'cat-1', name: 'General' },
})

describe('scheduler/run gap-filler base date', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(localDate(2024, 3, 1))
    db.taskOccurrence.create.mockImplementation(async (args: any) => ({ id: 'occ-new', ...args.data }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    // The task has no pending occurrence; its last occurrence was completed late
    db.taskOccurrence.count.mockImplementation(async (args: any) =>
      args?.where?.status?.in ? 0 : 1
    )
    db.taskOccurrence.findFirst.mockImplementation(async (args: any) => {
      // Last-occurrence lookup (no dueDate filter) vs duplicate-date check
      if (args?.orderBy) {
        return {
          id: 'occ-prev',
          taskId: 'task-1',
          status: 'completed',
          dueDate: localDate(2024, 1, 15),
          completedAt: localDate(2024, 1, 19),
          skippedAt: null,
        }
      }
      return null
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const runWith = async (scheduleConfig: unknown) => {
    db.taskDefinition.findMany.mockResolvedValue([makePrismaTask(scheduleConfig)])
    const { default: handler } = await import('@/server/api/scheduler/run')
    await (handler as any)({})
    const calls = db.taskOccurrence.create.mock.calls
    return calls[calls.length - 1][0].data.dueDate as Date
  }

  it('annual_variable: next occurrence is one year after the last completion', async () => {
    const due = await runWith({
      type: 'annual_variable', month: 1, dayOfMonth: 15, endCondition: { type: 'never' },
    })
    expect(due).toEqual(new Date(2025, 0, 19, 0, 0, 0, 0))
  })

  it('annual_fixed: next occurrence stays anchored to the last due date', async () => {
    const due = await runWith({
      type: 'annual_fixed', month: 1, dayOfMonth: 15, endCondition: { type: 'never' },
    })
    expect(due).toEqual(new Date(2025, 0, 15, 0, 0, 0, 0))
  })
})
