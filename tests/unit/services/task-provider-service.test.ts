import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    taskDefinition: { findFirst: vi.fn() },
    provider: { findFirst: vi.fn() },
    taskProvider: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { TaskProviderService } from '@/server/services/TaskProviderService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

describe('TaskProviderService', () => {
  let service: TaskProviderService
  beforeEach(() => { service = new TaskProviderService(); vi.clearAllMocks() })

  it('refuses to link a task from another household', async () => {
    db.taskDefinition.findFirst.mockResolvedValue(null)
    await expect(service.link('h1', 't1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses to link a provider from another household', async () => {
    db.taskDefinition.findFirst.mockResolvedValue({ id: 't1' })
    db.provider.findFirst.mockResolvedValue(null)
    await expect(service.link('h1', 't1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
    expect(db.taskProvider.upsert).not.toHaveBeenCalled()
  })

  it('linking twice is idempotent (upsert on the unique pair)', async () => {
    db.taskDefinition.findFirst.mockResolvedValue({ id: 't1' })
    db.provider.findFirst.mockResolvedValue({ id: 'p1' })
    await service.link('h1', 't1', 'p1')
    expect(db.taskProvider.upsert.mock.calls[0][0].where).toEqual({
      taskId_providerId: { taskId: 't1', providerId: 'p1' },
    })
  })

  it('listForTask 404s for a task in another household', async () => {
    db.taskDefinition.findFirst.mockResolvedValue(null)
    await expect(service.listForTask('h1', 't1')).rejects.toMatchObject({ statusCode: 404 })
    expect(db.taskProvider.findMany).not.toHaveBeenCalled()
  })

  it('unlink 404s for a task in another household without deleting', async () => {
    db.taskDefinition.findFirst.mockResolvedValue(null)
    await expect(service.unlink('h1', 't1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
    expect(db.taskProvider.deleteMany).not.toHaveBeenCalled()
  })
})
