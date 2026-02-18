import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskService } from '@/server/services/TaskService'
import prisma from '@/server/utils/prisma/client'
import type { FixedIntervalScheduleConfig, VariableIntervalScheduleConfig, OnceScheduleConfig } from '@/types'

const never = { type: 'never' as const }

const mockTask = (scheduleConfig: any) => ({
  id: 'task-1',
  householdId: 'household-1',
  name: 'Test Task',
  description: null,
  instructions: null,
  categoryId: 'cat-1',
  metaStatus: 'active',
  scheduleConfig,
  reminderConfig: null,
  createdByUserId: 'user-1',
  defaultAssigneeIds: ['user-1'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  category: { id: 'cat-1', name: 'Test', isDefault: false, householdId: 'household-1', createdAt: new Date(), updatedAt: new Date() },
})

const mockOverdueOccurrence = (id: string, dueDate: Date, status = 'assigned') => ({
  id,
  taskId: 'task-1',
  dueDate,
  status,
  assigneeIds: ['user-1'],
  completedAt: null,
  skippedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

describe('TaskService.catchUp', () => {
  let taskService: TaskService

  beforeEach(() => {
    vi.clearAllMocks()
    taskService = new TaskService()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 17)) // Feb 17 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('skips all overdue occurrences and creates new future occurrence', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 2,
      intervalUnit: 'week',
      endCondition: never,
    }
    const task = mockTask(config)

    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(task as any)

    const overdueOccs = [
      mockOverdueOccurrence('occ-1', new Date(2026, 0, 6)),
      mockOverdueOccurrence('occ-2', new Date(2026, 0, 20)),
      mockOverdueOccurrence('occ-3', new Date(2026, 1, 3)),
    ]
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue(overdueOccs as any)
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked((prisma as any).taskHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.taskOccurrence.create).mockResolvedValue({
      id: 'occ-new', taskId: 'task-1', dueDate: new Date(2026, 1, 17),
      status: 'assigned', assigneeIds: ['user-1'],
    } as any)
    vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(3)

    const result = await taskService.catchUp('task-1', 'user-1')

    expect(result.occurrencesSkipped).toBe(3)
    expect(result.newDueDate).toBeTruthy()
    // Verify each overdue occurrence was updated to skipped
    expect(prisma.taskOccurrence.update).toHaveBeenCalledTimes(3)
    // Verify history logs created for each
    expect(prisma.occurrenceHistoryLog.create).toHaveBeenCalledTimes(3)
    // Verify task history log created
    expect((prisma as any).taskHistoryLog.create).toHaveBeenCalledTimes(1)
  })

  it('throws when no overdue occurrences exist', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: never,
    }
    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([])

    await expect(taskService.catchUp('task-1', 'user-1')).rejects.toThrow('No overdue occurrences to catch up')
  })

  it('does not create new occurrence if future one already exists', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: never,
    }
    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([
      mockOverdueOccurrence('occ-1', new Date(2026, 0, 1)),
    ] as any)

    // First findFirst call (inside transaction): future occurrence exists
    // Second findFirst call (after transaction): future occurrence exists
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue({
      id: 'occ-future', dueDate: new Date(2026, 2, 1), status: 'assigned',
    } as any)

    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked((prisma as any).taskHistoryLog.create).mockResolvedValue({} as any)

    const result = await taskService.catchUp('task-1', 'user-1')

    expect(result.occurrencesSkipped).toBe(1)
    expect(prisma.taskOccurrence.create).not.toHaveBeenCalled()
  })

  it('returns null newDueDate for once-type tasks', async () => {
    const config: OnceScheduleConfig = {
      type: 'once',
      dueDate: new Date(2025, 0, 1),
      endCondition: never,
    }
    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([
      mockOverdueOccurrence('occ-1', new Date(2025, 0, 1)),
    ] as any)
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked((prisma as any).taskHistoryLog.create).mockResolvedValue({} as any)

    const result = await taskService.catchUp('task-1', 'user-1')

    expect(result.occurrencesSkipped).toBe(1)
    expect(result.newDueDate).toBeNull()
  })

  it('stores optional user comment in task history log', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: never,
    }
    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([
      mockOverdueOccurrence('occ-1', new Date(2026, 0, 1)),
    ] as any)
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked((prisma as any).taskHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.taskOccurrence.create).mockResolvedValue({} as any)
    vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)

    await taskService.catchUp('task-1', 'user-1', 'Was on vacation')

    const historyLogCalls = vi.mocked((prisma as any).taskHistoryLog.create).mock.calls
    expect(historyLogCalls.length).toBeGreaterThan(0)
    expect(historyLogCalls[0][0].data.comment).toBe('Was on vacation')
    expect(historyLogCalls[0][0].data.logType).toBe('catch_up')
  })

  it('uses variable interval calculation for variable_interval tasks', async () => {
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 10, unit: 'day' },
      endCondition: never,
    }
    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([
      mockOverdueOccurrence('occ-1', new Date(2025, 6, 1)),
    ] as any)
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked((prisma as any).taskHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.taskOccurrence.create).mockResolvedValue({} as any)
    vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)

    const result = await taskService.catchUp('task-1', 'user-1')

    expect(result.occurrencesSkipped).toBe(1)
    // Variable interval: today (Feb 17) + 10 days = Feb 27
    expect(result.newDueDate).toEqual(new Date(2026, 1, 27, 0, 0, 0, 0))
  })
})
