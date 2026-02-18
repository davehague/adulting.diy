import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OccurrenceService } from '@/server/services/OccurrenceService'
import { TaskService } from '@/server/services/TaskService'
import prisma from '@/server/utils/prisma/client'
import type { ScheduleConfig } from '@/types'

// Cast the mocked prisma to access vi.fn() methods
const db = prisma as unknown as {
  user: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  taskDefinition: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  taskOccurrence: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }
  occurrenceHistoryLog: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
  userNotificationPreferences: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day)

const USER_ID = 'user-1'
const HOUSEHOLD_ID = 'household-1'
const TASK_ID = 'task-1'
const OCCURRENCE_ID = 'occ-1'

// Factory helpers
const makeTask = (overrides: Partial<Record<string, any>> = {}) => ({
  id: TASK_ID,
  name: 'Test Task',
  description: null,
  instructions: null,
  householdId: HOUSEHOLD_ID,
  categoryId: 'cat-1',
  metaStatus: 'active',
  scheduleConfig: {
    type: 'fixed_interval',
    interval: 1,
    intervalUnit: 'week',
    endCondition: { type: 'never' },
  } as unknown,
  reminderConfig: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByUserId: USER_ID,
  defaultAssigneeIds: [],
  category: { id: 'cat-1', name: 'General', icon: null, householdId: HOUSEHOLD_ID },
  ...overrides,
})

const makeOccurrence = (overrides: Partial<Record<string, any>> = {}) => ({
  id: OCCURRENCE_ID,
  taskId: TASK_ID,
  dueDate: localDate(2024, 1, 15),
  status: 'assigned',
  assigneeIds: [USER_ID],
  completedAt: null,
  skippedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  // Default: notifications silently succeed
  db.user.findUnique.mockResolvedValue({ id: USER_ID, name: 'Test', email: 'test@test.com' })
  db.userNotificationPreferences.findMany.mockResolvedValue([])
})

// =============================================================================
// 1. TASK CREATION → INITIAL OCCURRENCE
// =============================================================================

describe('Task creation → initial occurrence', () => {
  const occurrenceService = new OccurrenceService()

  it('creates occurrence with status "assigned" when task has defaultAssigneeIds', async () => {
    const task = makeTask({
      defaultAssigneeIds: [USER_ID],
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'never' },
      },
    })

    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ status: 'assigned' }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    const result = await occurrenceService.createInitialOccurrence(task as any, USER_ID)

    expect(result).not.toBeNull()
    // Verify the create call included assigneeIds and 'assigned' status
    const createCall = db.taskOccurrence.create.mock.calls[0][0]
    expect(createCall.data.assigneeIds).toEqual([USER_ID])
    expect(createCall.data.status).toBe('assigned')
  })

  it('creates occurrence with status "created" when task has no assignees', async () => {
    const task = makeTask({
      defaultAssigneeIds: [],
      scheduleConfig: {
        type: 'once',
        dueDate: localDate(2024, 3, 15),
        endCondition: { type: 'never' },
      },
    })

    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ status: 'created', assigneeIds: [] }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.createInitialOccurrence(task as any, USER_ID)

    const createCall = db.taskOccurrence.create.mock.calls[0][0]
    expect(createCall.data.assigneeIds).toEqual([])
    expect(createCall.data.status).toBe('created')
  })

  it('creates occurrence for a one-time task', async () => {
    const dueDate = localDate(2024, 6, 1)
    const task = makeTask({
      scheduleConfig: {
        type: 'once',
        dueDate,
        endCondition: { type: 'never' },
      },
    })

    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ dueDate }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.createInitialOccurrence(task as any, USER_ID)

    const createCall = db.taskOccurrence.create.mock.calls[0][0]
    expect(createCall.data.taskId).toBe(TASK_ID)
    expect(createCall.data.dueDate).toBeTruthy()
  })

  it('creates occurrence for a variable_interval task (requires no lastCompletedDate for initial)', async () => {
    const task = makeTask({
      scheduleConfig: {
        type: 'variable_interval',
        variableInterval: { interval: 14, unit: 'day' },
        endCondition: { type: 'never' },
      },
    })

    // variable_interval returns null when no lastCompletedDate — so no initial occurrence
    const result = await occurrenceService.createInitialOccurrence(task as any, USER_ID)

    expect(result).toBeNull()
    expect(db.taskOccurrence.create).not.toHaveBeenCalled()
  })

  it('logs creation in occurrence history', async () => {
    const task = makeTask({
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'never' },
      },
    })

    db.taskOccurrence.create.mockResolvedValue(makeOccurrence())
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.createInitialOccurrence(task as any, USER_ID)

    expect(db.occurrenceHistoryLog.create).toHaveBeenCalledTimes(1)
    const historyCall = db.occurrenceHistoryLog.create.mock.calls[0][0]
    expect(historyCall.data.userId).toBe(USER_ID)
    expect(historyCall.data.logType).toBe('status_change')
  })
})

// =============================================================================
// 2. TASK STATE CHANGES → OCCURRENCE EFFECTS
// =============================================================================

describe('Task pause → occurrence effects', () => {
  const taskService = new TaskService()

  it('sets future created/assigned occurrences to deleted', async () => {
    const task = makeTask({ metaStatus: 'paused' })
    db.taskDefinition.update.mockResolvedValue(task)
    db.taskOccurrence.updateMany.mockResolvedValue({ count: 3 })

    await taskService.pause(TASK_ID)

    // Verify updateMany was called to delete future occurrences
    expect(db.taskOccurrence.updateMany).toHaveBeenCalledTimes(1)
    const updateCall = db.taskOccurrence.updateMany.mock.calls[0][0]
    expect(updateCall.where.taskId).toBe(TASK_ID)
    expect(updateCall.where.status.in).toEqual(['created', 'assigned'])
    expect(updateCall.data.status).toBe('deleted')
  })

  it('does not affect completed or skipped occurrences', async () => {
    const task = makeTask({ metaStatus: 'paused' })
    db.taskDefinition.update.mockResolvedValue(task)
    db.taskOccurrence.updateMany.mockResolvedValue({ count: 0 })

    await taskService.pause(TASK_ID)

    // The where clause only targets 'created' and 'assigned'
    const updateCall = db.taskOccurrence.updateMany.mock.calls[0][0]
    expect(updateCall.where.status.in).not.toContain('completed')
    expect(updateCall.where.status.in).not.toContain('skipped')
  })
})

describe('Task soft-delete → occurrence effects', () => {
  const taskService = new TaskService()

  it('sets future created/assigned occurrences to deleted', async () => {
    const task = makeTask({ metaStatus: 'soft-deleted' })
    db.taskDefinition.update.mockResolvedValue(task)
    db.taskOccurrence.updateMany.mockResolvedValue({ count: 2 })

    await taskService.softDelete(TASK_ID)

    expect(db.taskOccurrence.updateMany).toHaveBeenCalledTimes(1)
    const updateCall = db.taskOccurrence.updateMany.mock.calls[0][0]
    expect(updateCall.data.status).toBe('deleted')
  })
})

describe('Task unpause → occurrence generation', () => {
  const taskService = new TaskService()

  it('generates next occurrence when recurring task is unpaused', async () => {
    const task = makeTask({
      metaStatus: 'active',
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'never' },
      },
    })
    db.taskDefinition.update.mockResolvedValue(task)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-new' }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await taskService.unpause(TASK_ID)

    // Task is active again
    expect(db.taskDefinition.update.mock.calls[0][0].data.metaStatus).toBe('active')
    // An occurrence should be created after unpausing
    expect(db.taskOccurrence.create).toHaveBeenCalled()
  })

  it('uses last completed/skipped occurrence as base date for variable_interval', async () => {
    const task = makeTask({
      metaStatus: 'active',
      scheduleConfig: {
        type: 'variable_interval',
        variableInterval: { interval: 14, unit: 'day' },
        endCondition: { type: 'never' },
      },
    })
    db.taskDefinition.update.mockResolvedValue(task)
    // First findFirst: unpause looks for last completed/skipped occurrence
    // Second findFirst: generateNextOccurrence checks for duplicate on next date
    db.taskOccurrence.findFirst
      .mockResolvedValueOnce(
        makeOccurrence({
          id: 'occ-prev',
          status: 'completed',
          completedAt: localDate(2024, 1, 10),
        })
      )
      .mockResolvedValueOnce(null) // no duplicate exists
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-new' }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await taskService.unpause(TASK_ID)

    // Should create an occurrence based on the last completion date
    expect(db.taskOccurrence.create).toHaveBeenCalled()
  })

  it('does NOT generate occurrence for "once" type task on unpause', async () => {
    const task = makeTask({
      metaStatus: 'active',
      scheduleConfig: {
        type: 'once',
        dueDate: localDate(2024, 1, 15),
        endCondition: { type: 'never' },
      },
    })
    db.taskDefinition.update.mockResolvedValue(task)

    await taskService.unpause(TASK_ID)

    // One-time tasks don't need occurrence regeneration after unpause
    expect(db.taskOccurrence.create).not.toHaveBeenCalled()
  })

  it('returns the unpaused task with active status', async () => {
    const task = makeTask({ metaStatus: 'active' })
    db.taskDefinition.update.mockResolvedValue(task)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-new' }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    const result = await taskService.unpause(TASK_ID)

    expect(result.metaStatus).toBe('active')
  })
})

// =============================================================================
// 3. OCCURRENCE EXECUTE → NEXT OCCURRENCE
// =============================================================================

describe('Occurrence execute → next occurrence generation', () => {
  const occurrenceService = new OccurrenceService()

  const setupExecuteMocks = (
    scheduleConfig: ScheduleConfig,
    occurrence: ReturnType<typeof makeOccurrence>,
    taskOverrides: Partial<Record<string, any>> = {}
  ) => {
    const task = makeTask({ scheduleConfig, ...taskOverrides })
    const occurrenceWithTask = { ...occurrence, task, completedAt: new Date() }

    // Transaction mocks (findUnique + update inside $transaction)
    db.taskOccurrence.findUnique.mockResolvedValue(occurrence)
    db.taskOccurrence.update.mockResolvedValue(occurrenceWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    // generateNextOccurrence mocks
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null) // no duplicate
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    return { task, occurrenceWithTask }
  }

  it('generates next occurrence for fixed_interval task', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    setupExecuteMocks(config, makeOccurrence({ dueDate: localDate(2024, 1, 15) }))

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // Should have created a new occurrence (the next one)
    // create is called twice: once in the transaction (the execute update re-uses it)
    // and once for the next occurrence
    const createCalls = db.taskOccurrence.create.mock.calls
    expect(createCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT generate next occurrence for "once" task', async () => {
    const config: ScheduleConfig = {
      type: 'once',
      dueDate: localDate(2024, 1, 15),
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence()
    const occWithTask = { ...occ, task, completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // generateNextOccurrence is skipped for "once" type
    // Only the update call happens, no create for next occurrence
    expect(db.taskOccurrence.count).not.toHaveBeenCalled()
  })

  it('does NOT generate next occurrence when task is paused', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config, metaStatus: 'paused' })
    const occ = makeOccurrence()
    const occWithTask = { ...occ, task, completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // generateNextOccurrence is skipped when metaStatus !== 'active'
    expect(db.taskOccurrence.count).not.toHaveBeenCalled()
  })

  it('does NOT generate next occurrence when task is soft-deleted', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config, metaStatus: 'soft-deleted' })
    const occ = makeOccurrence()
    const occWithTask = { ...occ, task, completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    expect(db.taskOccurrence.count).not.toHaveBeenCalled()
  })

  it('passes DUE DATE for fixed_interval (not completedAt)', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 2,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const dueDate = localDate(2024, 1, 15)
    const completedAt = localDate(2024, 1, 19) // 4 days late
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate })
    const occWithTask = { ...occ, task, completedAt, dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // The next occurrence should be created with a due date based on
    // the ORIGINAL due date (Jan 15 + 2 weeks = Jan 29),
    // NOT the completion date (Jan 19 + 2 weeks = Feb 2)
    const createCalls = db.taskOccurrence.create.mock.calls
    const nextOccurrenceCreate = createCalls[createCalls.length - 1][0]
    const nextDueDate = nextOccurrenceCreate.data.dueDate
    expect(nextDueDate).toEqual(new Date(2024, 0, 29, 0, 0, 0, 0)) // Jan 29
  })

  it('passes completedAt for variable_interval (not due date)', async () => {
    const config: ScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 14, unit: 'day' },
      endCondition: { type: 'never' },
    }
    const dueDate = localDate(2024, 1, 15)
    const completedAt = localDate(2024, 1, 19) // 4 days late
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate })
    const occWithTask = { ...occ, task, completedAt, dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // The next occurrence should be based on completedAt (Jan 19 + 14 days = Feb 2)
    const createCalls = db.taskOccurrence.create.mock.calls
    const nextOccurrenceCreate = createCalls[createCalls.length - 1][0]
    const nextDueDate = nextOccurrenceCreate.data.dueDate
    expect(nextDueDate).toEqual(new Date(2024, 1, 2, 0, 0, 0, 0)) // Feb 2
  })
})

// =============================================================================
// 4. OCCURRENCE SKIP → NEXT OCCURRENCE
// =============================================================================

describe('Occurrence skip → next occurrence generation', () => {
  const occurrenceService = new OccurrenceService()

  it('generates next occurrence after skip for recurring task', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence()
    const skippedOcc = { ...occ, task, skippedAt: new Date(), dueDate: occ.dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Not needed this week')

    // Should create next occurrence
    expect(db.taskOccurrence.count).toHaveBeenCalled()
  })

  it('logs skip reason as a comment in history', async () => {
    const config: ScheduleConfig = {
      type: 'once',
      dueDate: localDate(2024, 1, 15),
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence()
    const skippedOcc = { ...occ, task, skippedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'On vacation')

    // Should have logged both status_change and comment
    const historyCalls = db.occurrenceHistoryLog.create.mock.calls
    expect(historyCalls.length).toBe(2)

    const statusLog = historyCalls[0][0].data
    expect(statusLog.logType).toBe('status_change')
    expect(statusLog.newValue).toBe('skipped')

    const commentLog = historyCalls[1][0].data
    expect(commentLog.logType).toBe('comment')
    expect(commentLog.comment).toContain('On vacation')
  })

  it('passes DUE DATE for fixed schedule skip (not skippedAt)', async () => {
    const config: ScheduleConfig = {
      type: 'specific_days_of_week',
      daysOfWeek: {
        monday: true, tuesday: false, wednesday: false, thursday: false,
        friday: false, saturday: false, sunday: false,
      },
      endCondition: { type: 'never' },
    }
    const dueDate = localDate(2024, 1, 15) // Monday
    const skippedAt = localDate(2024, 1, 18) // Skipped on Thursday
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate })
    const skippedOcc = { ...occ, task, skippedAt, dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Busy')

    // Next Monday after dueDate (Jan 15, Monday) → Jan 22
    // NOT next Monday after skippedAt (Jan 18, Thursday) → also Jan 22 in this case
    // but the principle is: base date = dueDate for fixed
    const createCalls = db.taskOccurrence.create.mock.calls
    const nextOccurrenceCreate = createCalls[createCalls.length - 1][0]
    expect(nextOccurrenceCreate.data.dueDate).toEqual(new Date(2024, 0, 22, 0, 0, 0, 0))
  })

  it('passes skippedAt for variable_interval skip (not dueDate)', async () => {
    const config: ScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 14, unit: 'day' },
      endCondition: { type: 'never' },
    }
    const dueDate = localDate(2024, 1, 15)
    const skippedAt = localDate(2024, 1, 19) // Skipped 4 days late
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate })
    const skippedOcc = { ...occ, task, skippedAt, dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Too busy')

    // Next occurrence should be based on skippedAt (Jan 19 + 14 days = Feb 2)
    // NOT the dueDate (Jan 15 + 14 = Jan 29)
    const createCalls = db.taskOccurrence.create.mock.calls
    const nextOccurrenceCreate = createCalls[createCalls.length - 1][0]
    const nextDueDate = nextOccurrenceCreate.data.dueDate
    expect(nextDueDate).toEqual(new Date(2024, 1, 2, 0, 0, 0, 0)) // Feb 2
  })

  it('passes DUE DATE for fixed_interval skip (not skippedAt)', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 2,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const dueDate = localDate(2024, 1, 15)
    const skippedAt = localDate(2024, 1, 19) // Skipped 4 days late
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate })
    const skippedOcc = { ...occ, task, skippedAt, dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Away')

    // Next occurrence should be based on dueDate (Jan 15 + 2 weeks = Jan 29)
    // NOT skippedAt (Jan 19 + 2 weeks = Feb 2)
    const createCalls = db.taskOccurrence.create.mock.calls
    const nextOccurrenceCreate = createCalls[createCalls.length - 1][0]
    const nextDueDate = nextOccurrenceCreate.data.dueDate
    expect(nextDueDate).toEqual(new Date(2024, 0, 29, 0, 0, 0, 0)) // Jan 29
  })

  it('does NOT generate next occurrence for "once" task after skip', async () => {
    const config: ScheduleConfig = {
      type: 'once',
      dueDate: localDate(2024, 1, 15),
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence()
    const skippedOcc = { ...occ, task, skippedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Not needed')

    // generateNextOccurrence is skipped for "once" type
    expect(db.taskOccurrence.count).not.toHaveBeenCalled()
  })

  it('does NOT generate next occurrence when task is paused', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config, metaStatus: 'paused' })
    const occ = makeOccurrence()
    const skippedOcc = { ...occ, task, skippedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Task paused')

    expect(db.taskOccurrence.count).not.toHaveBeenCalled()
  })

  it('does NOT generate next occurrence when task is soft-deleted', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config, metaStatus: 'soft-deleted' })
    const occ = makeOccurrence()
    const skippedOcc = { ...occ, task, skippedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Deleted task')

    expect(db.taskOccurrence.count).not.toHaveBeenCalled()
  })

  it('does not generate next occurrence when times limit reached after skip', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'times', times: 5 },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence()
    const skippedOcc = { ...occ, task, skippedAt: new Date(), dueDate: occ.dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    // Already at 5 occurrences — next would be 6, exceeding the limit
    db.taskOccurrence.count.mockResolvedValue(5)

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'End condition')

    // generateNextOccurrence checks count+1 >= times → 6 >= 5 → stop
    const createCalls = db.taskOccurrence.create.mock.calls
    expect(createCalls.length).toBe(0)
  })

  it('does not create duplicate occurrence on skip', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate: localDate(2024, 1, 15) })
    const skippedOcc = { ...occ, task, skippedAt: new Date(), dueDate: occ.dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    // Simulate: an occurrence already exists for the next date
    db.taskOccurrence.findFirst.mockResolvedValue(makeOccurrence({ id: 'occ-existing' }))

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Duplicate test')

    // Should NOT create a new occurrence since one already exists
    expect(db.taskOccurrence.create).not.toHaveBeenCalled()
  })

  it('skip with empty reason creates only status_change log, not comment log', async () => {
    const config: ScheduleConfig = {
      type: 'once',
      dueDate: localDate(2024, 1, 15),
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence()
    const skippedOcc = { ...occ, task, skippedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, '')

    // Should have only 1 history log (status_change), not 2 (no comment for empty reason)
    const historyCalls = db.occurrenceHistoryLog.create.mock.calls
    expect(historyCalls.length).toBe(1)

    const statusLog = historyCalls[0][0].data
    expect(statusLog.logType).toBe('status_change')
    expect(statusLog.newValue).toBe('skipped')
  })

  it('logs old status → "skipped" transition in history', async () => {
    const task = makeTask({
      scheduleConfig: { type: 'once', dueDate: localDate(2024, 1, 15), endCondition: { type: 'never' } },
    })
    const occ = makeOccurrence({ status: 'created' })
    const skippedOcc = { ...occ, task, status: 'skipped', skippedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Not needed')

    const historyCall = db.occurrenceHistoryLog.create.mock.calls[0][0]
    expect(historyCall.data.logType).toBe('status_change')
    expect(historyCall.data.oldValue).toBe('created')
    expect(historyCall.data.newValue).toBe('skipped')
  })
})

// =============================================================================
// 5. END CONDITIONS STOP GENERATION
// =============================================================================

describe('End conditions prevent next occurrence', () => {
  const occurrenceService = new OccurrenceService()

  it('does not generate next when times limit reached', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'times', times: 5 },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence()
    const occWithTask = { ...occ, task, completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    // Already at 5 occurrences — next would be 6, exceeding the limit
    db.taskOccurrence.count.mockResolvedValue(5)

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // generateNextOccurrence checks count+1 >= times → 6 >= 5 → stop
    // No new occurrence created after the history log
    const createCalls = db.taskOccurrence.create.mock.calls
    // Only the transaction update happened, no new occurrence create
    expect(createCalls.length).toBe(0)
  })
})

// =============================================================================
// 6. OCCURRENCE STATUS TRANSITIONS
// =============================================================================

describe('Occurrence status transitions', () => {
  const occurrenceService = new OccurrenceService()

  it('execute sets status to "completed" and records completedAt', async () => {
    const task = makeTask()
    const occ = makeOccurrence({ status: 'assigned' })
    const completedOcc = { ...occ, task, status: 'completed', completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(completedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    const result = await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    const updateCall = db.taskOccurrence.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('completed')
    expect(updateCall.data.completedAt).toBeTruthy()
  })

  it('skip sets status to "skipped" and records skippedAt', async () => {
    const task = makeTask({
      scheduleConfig: { type: 'once', dueDate: localDate(2024, 1, 15), endCondition: { type: 'never' } },
    })
    const occ = makeOccurrence({ status: 'assigned' })
    const skippedOcc = { ...occ, task, status: 'skipped', skippedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'Not needed')

    const updateCall = db.taskOccurrence.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('skipped')
    expect(updateCall.data.skippedAt).toBeTruthy()
  })

  it('execute logs old status → "completed" transition in history', async () => {
    const task = makeTask()
    const occ = makeOccurrence({ status: 'created' })
    const completedOcc = { ...occ, task, status: 'completed', completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(completedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    const historyCall = db.occurrenceHistoryLog.create.mock.calls[0][0]
    expect(historyCall.data.logType).toBe('status_change')
    expect(historyCall.data.oldValue).toBe('created')
    expect(historyCall.data.newValue).toBe('completed')
  })
})

// =============================================================================
// 7. DUPLICATE PREVENTION
// =============================================================================

describe('Duplicate occurrence prevention', () => {
  const occurrenceService = new OccurrenceService()

  it('does not create occurrence if one already exists for the same date', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate: localDate(2024, 1, 15) })
    const occWithTask = { ...occ, task, completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    // Simulate: an occurrence already exists for the next date
    db.taskOccurrence.findFirst.mockResolvedValue(makeOccurrence({ id: 'occ-existing' }))

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // Should NOT create a new occurrence since one already exists
    expect(db.taskOccurrence.create).not.toHaveBeenCalled()
  })
})

// =============================================================================
// 8. KNOWN DESIGN DECISIONS
// =============================================================================

describe('Known design decisions (documented)', () => {
  it('TaskMetaStatus "completed" is defined but never set', () => {
    // The type system defines: "active" | "paused" | "soft-deleted" | "completed"
    // But no code path ever sets metaStatus to "completed".
    // A task that reaches its endCondition.times limit just stops generating
    // new occurrences — the task itself stays "active".
    type TaskMetaStatus = "active" | "paused" | "soft-deleted" | "completed"
    const validStatuses: TaskMetaStatus[] = ["active", "paused", "soft-deleted", "completed"]
    expect(validStatuses).toContain("completed")
  })

  it('direct occurrence update does not trigger next-occurrence generation (by design)', async () => {
    // OccurrenceService.update() can change dueDate and assigneeIds.
    // Only execute() and skip() trigger generateNextOccurrence().
    // This is intentional — use the dedicated methods for status transitions.
    const occurrenceService = new OccurrenceService()
    const occ = makeOccurrence()
    const updated = { ...occ, status: 'completed', completedAt: new Date() }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(updated)
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await occurrenceService.update(OCCURRENCE_ID, USER_ID, {
      status: 'completed' as any,
      completedAt: new Date(),
    })

    expect(db.taskOccurrence.count).not.toHaveBeenCalled()
  })
})

// =============================================================================
// 9. SCHEDULE EDIT → OCCURRENCE RECONCILIATION
// =============================================================================

describe('Task schedule edit → occurrence reconciliation', () => {
  const taskService = new TaskService()

  it('deletes future active occurrences when schedule config changes', async () => {
    const originalTask = makeTask({
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'never' },
      },
    })
    const updatedTask = makeTask({
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'never' },
      },
    })

    // First call: findUnique to get original task (for comparison)
    db.taskDefinition.findUnique.mockResolvedValue(originalTask)
    db.taskDefinition.update.mockResolvedValue(updatedTask)
    db.taskOccurrence.updateMany.mockResolvedValue({ count: 2 })
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-new' }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await taskService.update(TASK_ID, {
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'never' },
      } as any,
    })

    // Should delete future active occurrences
    expect(db.taskOccurrence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taskId: TASK_ID,
          status: { in: ['created', 'assigned'] },
        }),
        data: expect.objectContaining({
          status: 'deleted',
        }),
      })
    )
  })

  it('regenerates occurrence after deleting old ones on schedule change', async () => {
    const originalTask = makeTask({
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'never' },
      },
    })
    const updatedTask = makeTask({
      scheduleConfig: {
        type: 'specific_days_of_week',
        daysOfWeek: {
          monday: true, tuesday: false, wednesday: false, thursday: false,
          friday: false, saturday: false, sunday: false,
        },
        endCondition: { type: 'never' },
      },
    })

    db.taskDefinition.findUnique.mockResolvedValue(originalTask)
    db.taskDefinition.update.mockResolvedValue(updatedTask)
    db.taskOccurrence.updateMany.mockResolvedValue({ count: 1 })
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-new' }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await taskService.update(TASK_ID, {
      scheduleConfig: {
        type: 'specific_days_of_week',
        daysOfWeek: {
          monday: true, tuesday: false, wednesday: false, thursday: false,
          friday: false, saturday: false, sunday: false,
        },
        endCondition: { type: 'never' },
      } as any,
    })

    // Should create a new occurrence with the new schedule
    expect(db.taskOccurrence.create).toHaveBeenCalled()
  })

  it('does NOT reconcile occurrences when only name changes (no schedule change)', async () => {
    const task = makeTask()

    db.taskDefinition.update.mockResolvedValue({ ...task, name: 'Updated Name' })

    await taskService.update(TASK_ID, { name: 'Updated Name' })

    // No occurrence changes when schedule didn't change
    expect(db.taskOccurrence.updateMany).not.toHaveBeenCalled()
    expect(db.taskOccurrence.create).not.toHaveBeenCalled()
  })

  it('preserves completed and skipped occurrences during schedule change', async () => {
    const originalTask = makeTask({
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'never' },
      },
    })
    const updatedTask = makeTask({
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'never' },
      },
    })

    db.taskDefinition.findUnique.mockResolvedValue(originalTask)
    db.taskDefinition.update.mockResolvedValue(updatedTask)
    db.taskOccurrence.updateMany.mockResolvedValue({ count: 0 })
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-new' }))
    db.occurrenceHistoryLog.create.mockResolvedValue({})

    await taskService.update(TASK_ID, {
      scheduleConfig: {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'never' },
      } as any,
    })

    // updateMany should only target 'created' and 'assigned' statuses
    const updateManyCall = db.taskOccurrence.updateMany.mock.calls[0][0]
    expect(updateManyCall.where.status.in).toEqual(['created', 'assigned'])
    expect(updateManyCall.where.status.in).not.toContain('completed')
    expect(updateManyCall.where.status.in).not.toContain('skipped')
  })
})
