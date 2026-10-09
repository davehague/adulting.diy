import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    user: { findFirst: vi.fn() },
    household: { findUnique: vi.fn() },
    category: { findMany: vi.fn() },
    taskDefinition: { findMany: vi.fn() },
  },
}))
const create = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/TaskService', () => ({
  TaskService: vi.fn().mockImplementation(() => ({ create })),
}))

import prisma from '@/server/utils/prisma/client'
import { TaskIngestService } from '@/server/services/TaskIngestService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const CATEGORIES = [
  { id: 'pets-default', name: 'Pets', householdId: null },
  { id: 'pets-own', name: 'Pets', householdId: 'h1' },
  { id: 'errands', name: 'Appointments and Errands', householdId: null },
]

const every = (interval: number, unit: string) => ({
  type: 'fixed_interval', interval, intervalUnit: unit,
})
const item = (over: Record<string, unknown> = {}) => ({
  name: 'Visit the cousins', category: 'Appointments and Errands', scheduleConfig: every(3, 'month'), ...over,
})
const firstDue = () => create.mock.calls[0][1].firstDueDate.toISOString()

describe('TaskIngestService', () => {
  let service: TaskIngestService
  beforeEach(() => {
    service = new TaskIngestService()
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T15:00:00Z'))
    db.user.findFirst.mockResolvedValue({ id: 'u1' })
    db.household.findUnique.mockResolvedValue({ timezone: 'America/New_York' })
    db.category.findMany.mockResolvedValue(CATEGORIES)
    db.taskDefinition.findMany.mockResolvedValue([])
    let n = 0
    create.mockImplementation(async () => ({ id: `t${++n}` }))
  })
  afterEach(() => { vi.useRealTimers() })

  it('creates an active task attributed to the key owner, with no reminders or assignees', async () => {
    const result = await service.ingestBatch('h1', 'u1', [item({ description: 'Columbus side' })])
    expect(result).toEqual({
      created: [{ index: 0, id: 't1', name: 'Visit the cousins', firstDueDate: '2027-01-09' }], skipped: [], errors: [],
    })
    expect(create.mock.calls[0][0]).toEqual({
      householdId: 'h1', name: 'Visit the cousins', description: 'Columbus side', categoryId: 'errands',
      metaStatus: 'active', createdByUserId: 'u1', defaultAssigneeIds: [],
      scheduleConfig: { type: 'fixed_interval', interval: 3, intervalUnit: 'month', endCondition: { type: 'never' } },
    })
  })

  it('first due date is one interval from today in the household timezone, stored at noon UTC', async () => {
    vi.setSystemTime(new Date('2026-10-10T02:00:00Z')) // still Oct 9 in New York
    await service.ingestBatch('h1', 'u1', [item({ scheduleConfig: every(6, 'week') })])
    expect(firstDue()).toBe('2026-11-20T12:00:00.000Z')
  })

  it('gives a variable interval a first occurrence one interval out', async () => {
    const scheduleConfig = { type: 'variable_interval', variableInterval: { interval: 6, unit: 'week' } }
    await service.ingestBatch('h1', 'u1', [item({ scheduleConfig })])
    expect(firstDue()).toBe('2026-11-20T12:00:00.000Z')
  })

  it('uses firstDueDate when given', async () => {
    await service.ingestBatch('h1', 'u1', [item({ firstDueDate: '2026-10-20' })])
    expect(firstDue()).toBe('2026-10-20T12:00:00.000Z')
    expect(create.mock.calls[0][0].scheduleConfig).not.toHaveProperty('firstDueDate')
  })

  it('a once task is due on its dueDate', async () => {
    await service.ingestBatch('h1', 'u1', [item({ scheduleConfig: { type: 'once', dueDate: '2026-12-01' } })])
    expect(firstDue()).toBe('2026-12-01T12:00:00.000Z')
  })

  it("resolves a category name to the household's own category over the global default", async () => {
    await service.ingestBatch('h1', 'u1', [item({ category: 'pets' })])
    expect(create.mock.calls[0][0].categoryId).toBe('pets-own')
  })

  it('accepts a categoryId the household can see, and rejects one it cannot', async () => {
    const result = await service.ingestBatch('h1', 'u1', [
      item({ category: undefined, categoryId: 'errands' }),
      item({ name: 'Other', category: undefined, categoryId: 'someone-elses' }),
    ])
    expect(create.mock.calls[0][0].categoryId).toBe('errands')
    expect(result.errors).toEqual([{ index: 1, name: 'Other', message: 'Unknown category: someone-elses' }])
  })

  it('reports an unknown category name without creating anything', async () => {
    const result = await service.ingestBatch('h1', 'u1', [item({ category: 'Kids' })])
    expect(result.errors[0].message).toBe('Unknown category: Kids')
    expect(create).not.toHaveBeenCalled()
  })

  it('skips a task whose name matches an existing undeleted task, ignoring case', async () => {
    db.taskDefinition.findMany.mockResolvedValue([{ id: 'old', name: 'Visit The Cousins' }])
    const result = await service.ingestBatch('h1', 'u1', [item()])
    expect(result.skipped).toEqual([{ index: 0, id: 'old', name: 'Visit the cousins', reason: expect.any(String) }])
    expect(db.taskDefinition.findMany.mock.calls[0][0].where).toEqual({
      householdId: 'h1', metaStatus: { not: 'soft-deleted' },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('skips a repeat within the same batch', async () => {
    const result = await service.ingestBatch('h1', 'u1', [item(), item()])
    expect(result.created).toHaveLength(1)
    expect(result.skipped[0]).toMatchObject({ index: 1, id: 't1' })
  })

  it('reports invalid items by index and still creates the rest', async () => {
    const result = await service.ingestBatch('h1', 'u1', [
      item({ scheduleConfig: { type: 'specific_days_of_week' } }),
      item({ categoryId: 'errands' }),
      item({ scheduleConfig: every(0, 'week') }),
      item({ firstDueDate: '10/20/2026' }),
      item({ scheduleConfig: { type: 'once', dueDate: '2026-12-01' }, firstDueDate: '2026-12-01' }),
      item({ name: 'Ok' }),
    ])
    expect(result.errors.map((e) => e.index)).toEqual([0, 1, 2, 3, 4])
    expect(result.created).toEqual([{ index: 5, id: 't1', name: 'Ok', firstDueDate: '2027-01-09' }])
  })

  it('a failure on one item is reported and does not stop the batch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    create.mockRejectedValueOnce(new Error('db down'))
    const result = await service.ingestBatch('h1', 'u1', [item(), item({ name: 'Other' })])
    expect(result.errors[0]).toMatchObject({ index: 0, message: 'db down' })
    expect(result.created).toHaveLength(1)
  })

  it('refuses the batch when the key owner has left the household', async () => {
    db.user.findFirst.mockResolvedValue(null)
    await expect(service.ingestBatch('h1', 'u1', [item()])).rejects.toMatchObject({ statusCode: 403 })
    expect(create).not.toHaveBeenCalled()
  })
})
