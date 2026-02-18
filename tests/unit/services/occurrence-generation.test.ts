import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OccurrenceService } from '@/server/services/OccurrenceService'
import prisma from '@/server/utils/prisma/client'
import type { FixedIntervalScheduleConfig, SpecificDaysOfWeekScheduleConfig } from '@/types'

const never = { type: 'never' as const }

const mockTask = (overrides = {}) => ({
  id: 'task-1',
  householdId: 'household-1',
  name: 'Test Task',
  metaStatus: 'active' as const,
  defaultAssigneeIds: ['user-1'],
  scheduleConfig: {
    type: 'fixed_interval',
    interval: 1,
    intervalUnit: 'week',
    endCondition: never,
  } as FixedIntervalScheduleConfig,
  ...overrides,
})

describe('OccurrenceService - Occurrence Generation', () => {
  let service: OccurrenceService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new OccurrenceService()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 18)) // Feb 18 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('generateAndCreateOccurrences', () => {
    it('creates occurrences up to the horizon date', async () => {
      const task = mockTask()
      const horizonDate = new Date(2026, 2, 4) // March 4 — ~2 weeks out

      // No existing occurrences
      vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(0)
      vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)

      // Inside transaction: no existing occurrence for any date
      vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.taskOccurrence.create).mockImplementation(async (args: any) => ({
        id: `occ-${Math.random().toString(36).slice(2)}`,
        taskId: task.id,
        dueDate: args.data.dueDate,
        status: args.data.status,
        assigneeIds: args.data.assigneeIds,
        task,
      }) as any)
      vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)

      const result = await service.generateAndCreateOccurrences(task as any, horizonDate, 'system')

      expect(result.length).toBeGreaterThan(0)
      expect(vi.mocked(prisma.taskOccurrence.create)).toHaveBeenCalled()
    })

    it('skips dates that already have an occurrence (prevents duplicates)', async () => {
      const task = mockTask()
      const horizonDate = new Date(2026, 2, 4)

      vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)
      vi.mocked(prisma.taskOccurrence.findFirst)
        .mockResolvedValueOnce(null) // no completed/skipped for lastCompletedDate
        .mockResolvedValue({ id: 'existing-occ' } as any) // every date already exists

      vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)

      const result = await service.generateAndCreateOccurrences(task as any, horizonDate, 'system')

      // All dates skipped because they already exist
      expect(result).toHaveLength(0)
      expect(vi.mocked(prisma.taskOccurrence.create)).not.toHaveBeenCalled()
    })

    it('returns empty array for "once" tasks that already have an occurrence', async () => {
      const task = mockTask({
        scheduleConfig: {
          type: 'once',
          dueDate: new Date(2026, 1, 20),
          endCondition: never,
        },
      })
      const horizonDate = new Date(2026, 4, 18)

      // Already has 1 occurrence
      vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)
      vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)

      const result = await service.generateAndCreateOccurrences(task as any, horizonDate, 'system')

      expect(result).toHaveLength(0)
    })
  })

  describe('generateNextOccurrence', () => {
    it('creates the next occurrence after completion', async () => {
      const task = mockTask()
      const lastCompletedDate = new Date(2026, 1, 18)

      vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)
      vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null) // no existing for that date

      const newOcc = {
        id: 'new-occ',
        taskId: task.id,
        dueDate: new Date(2026, 1, 25),
        status: 'assigned',
        assigneeIds: ['user-1'],
        task,
      }
      vi.mocked(prisma.taskOccurrence.create).mockResolvedValue(newOcc as any)
      vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)

      const result = await service.generateNextOccurrence(task as any, lastCompletedDate, 'user-1')

      expect(result).toBeTruthy()
      expect(vi.mocked(prisma.taskOccurrence.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: task.id,
            status: 'assigned',
          }),
        })
      )
    })

    it('returns existing occurrence if one already exists for the calculated date', async () => {
      const task = mockTask()
      const lastCompletedDate = new Date(2026, 1, 18)
      const existingOcc = {
        id: 'already-exists',
        taskId: task.id,
        dueDate: new Date(2026, 1, 25),
        status: 'assigned',
      }

      vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(2)
      vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(existingOcc as any)

      const result = await service.generateNextOccurrence(task as any, lastCompletedDate, 'user-1')

      expect(result).toEqual(existingOcc)
      // Should NOT create a new occurrence
      expect(vi.mocked(prisma.taskOccurrence.create)).not.toHaveBeenCalled()
    })

    it('returns null when end condition is reached', async () => {
      const task = mockTask({
        scheduleConfig: {
          type: 'fixed_interval',
          interval: 1,
          intervalUnit: 'week',
          endCondition: { type: 'times', times: 2 },
        },
      })

      // Already at the limit
      vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(2)

      const result = await service.generateNextOccurrence(task as any, new Date(), 'user-1')

      expect(result).toBeNull()
    })
  })
})
