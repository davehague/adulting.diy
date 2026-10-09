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

    describe('"after N times" end condition yields exactly N occurrences', () => {
      const timesTask = (times: number) =>
        mockTask({
          scheduleConfig: {
            type: 'fixed_interval',
            interval: 1,
            intervalUnit: 'week',
            endCondition: { type: 'times', times },
          },
        })

      beforeEach(() => {
        vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null) // no duplicate
        vi.mocked(prisma.taskOccurrence.create).mockImplementation(async (args: any) => ({
          id: 'occ-next',
          ...args.data,
        }) as any)
        vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)
      })

      it('creates the Nth occurrence when N-1 already exist', async () => {
        // times=3, two occurrences exist (one just completed) → the 3rd must be created
        vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(2)

        const result = await service.generateNextOccurrence(timesTask(3) as any, new Date(2026, 1, 18), 'user-1')

        expect(result).not.toBeNull()
        expect(vi.mocked(prisma.taskOccurrence.create)).toHaveBeenCalledTimes(1)
      })

      it('does not create an occurrence beyond N', async () => {
        vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(3)

        const result = await service.generateNextOccurrence(timesTask(3) as any, new Date(2026, 1, 18), 'user-1')

        expect(result).toBeNull()
        expect(vi.mocked(prisma.taskOccurrence.create)).not.toHaveBeenCalled()
      })

      it('times=1 and times=2 produce 1 and 2 occurrences in total', async () => {
        // times=1: initial occurrence exists, completing it must not create another
        vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)
        expect(await service.generateNextOccurrence(timesTask(1) as any, new Date(2026, 1, 18), 'user-1')).toBeNull()

        // times=2: after the first completes, a second is created; after the second, none
        vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)
        expect(await service.generateNextOccurrence(timesTask(2) as any, new Date(2026, 1, 18), 'user-1')).not.toBeNull()
        vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(2)
        expect(await service.generateNextOccurrence(timesTask(2) as any, new Date(2026, 1, 25), 'user-1')).toBeNull()
      })

      it('does not count deleted occurrences (pause/schedule-edit leftovers) toward the limit', async () => {
        vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)

        await service.generateNextOccurrence(timesTask(3) as any, new Date(2026, 1, 18), 'user-1')

        expect(vi.mocked(prisma.taskOccurrence.count)).toHaveBeenCalledWith({
          where: { taskId: 'task-1', status: { not: 'deleted' } },
        })
      })
    })
  })

  describe('createInitialOccurrence', () => {
    it('uses the due date override instead of the schedule when one is given', async () => {
      vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(0)
      vi.mocked(prisma.taskOccurrence.create).mockImplementation(async (args: any) => ({ id: 'occ-1', ...args.data }))
      const override = new Date('2026-03-20T12:00:00.000Z')
      await service.createInitialOccurrence(mockTask() as any, 'user-1', override)
      expect(vi.mocked(prisma.taskOccurrence.create).mock.calls[0][0].data.dueDate).toEqual(override)
    })
  })
})

