import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => {
  const db: Record<string, unknown> = {
    user: { findFirst: vi.fn() },
    project: { findMany: vi.fn(), create: vi.fn() },
    projectStep: { createMany: vi.fn() },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return { default: db }
})

import prisma from '@/server/utils/prisma/client'
import { ProjectIngestService } from '@/server/services/ProjectIngestService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const item = (over: Record<string, unknown> = {}) => ({ title: 'Shed', location: 'Yard', ...over })

describe('ProjectIngestService', () => {
  let service: ProjectIngestService
  beforeEach(() => {
    service = new ProjectIngestService()
    vi.clearAllMocks()
    db.user.findFirst.mockResolvedValue({ id: 'u1' })
    db.project.findMany.mockResolvedValue([])
    let n = 0
    db.project.create.mockImplementation(async () => ({ id: `p${++n}` }))
    db.projectStep.createMany.mockResolvedValue({ count: 0 })
  })

  it('creates a project as Planning with no path by default, attributed to the key owner', async () => {
    const result = await service.ingestBatch('h1', 'u1', [item({ notes: 'Call first' })])
    expect(result).toEqual({ created: [{ index: 0, id: 'p1', title: 'Shed', steps: 0 }], skipped: [], errors: [] })
    expect(db.project.create.mock.calls[0][0].data).toEqual({
      householdId: 'h1', createdById: 'u1', title: 'Shed', location: 'Yard', notes: 'Call first',
      status: 'planning', path: null, completedAt: null,
    })
    expect(db.projectStep.createMany).not.toHaveBeenCalled()
  })

  it('creates the steps in the order given, numbered from 0', async () => {
    const steps = [{ text: 'Call Alum Creek Shed People' }, { text: 'Call the utility', estimateMinutes: 15 }]
    const result = await service.ingestBatch('h1', 'u1', [item({ steps })])
    expect(result.created[0].steps).toBe(2)
    expect(db.projectStep.createMany.mock.calls[0][0].data).toEqual([
      { projectId: 'p1', createdById: 'u1', text: 'Call Alum Creek Shed People', estimateMinutes: null, position: 0 },
      { projectId: 'p1', createdById: 'u1', text: 'Call the utility', estimateMinutes: 15, position: 1 },
    ])
  })

  it('takes status and path, and stamps completedAt for a Done project', async () => {
    await service.ingestBatch('h1', 'u1', [item({ status: 'active', path: 'diy' }), item({ title: 'Old', status: 'done' })])
    expect(db.project.create.mock.calls[0][0].data).toMatchObject({ status: 'active', path: 'diy', completedAt: null })
    expect(db.project.create.mock.calls[1][0].data.completedAt).toBeInstanceOf(Date)
  })

  it('skips a project whose title and location match an open one, ignoring case and spaces', async () => {
    db.project.findMany.mockResolvedValue([{ id: 'old', title: 'Shed', location: 'yard' }])
    const result = await service.ingestBatch('h1', 'u1', [item({ title: ' shed ', location: 'Yard' })])
    expect(result.skipped).toEqual([{ index: 0, id: 'old', title: 'shed', reason: expect.any(String) }])
    expect(db.project.create).not.toHaveBeenCalled()
  })

  it('matches only open, undeleted projects when checking for duplicates', async () => {
    await service.ingestBatch('h1', 'u1', [item()])
    expect(db.project.findMany.mock.calls[0][0].where).toEqual({
      householdId: 'h1', metaStatus: 'active', status: { not: 'done' },
    })
  })

  it('treats the same title in a different location, or with no location, as a different project', async () => {
    db.project.findMany.mockResolvedValue([{ id: 'old', title: 'Shed', location: 'Yard' }])
    const result = await service.ingestBatch('h1', 'u1', [item({ location: 'Garage' }), item({ location: undefined })])
    expect(result.created).toHaveLength(2)
  })

  it('skips a repeat within the same batch', async () => {
    const result = await service.ingestBatch('h1', 'u1', [item(), item()])
    expect(result.created).toHaveLength(1)
    expect(result.skipped[0]).toMatchObject({ index: 1, id: 'p1' })
  })

  it('reports an invalid item by index and still creates the rest', async () => {
    const result = await service.ingestBatch('h1', 'u1', [
      item({ title: '' }), item({ status: 'someday' }), item({ steps: [{ text: '' }] }), item({ title: 'Ok' }),
    ])
    expect(result.created).toEqual([{ index: 3, id: 'p1', title: 'Ok', steps: 0 }])
    expect(result.errors.map((e) => e.index)).toEqual([0, 1, 2])
    expect(result.errors[1]).toMatchObject({ title: 'Shed', message: 'Unknown status' })
  })

  it('rejects more than 100 steps on one project', async () => {
    const steps = Array.from({ length: 101 }, (_, i) => ({ text: `Step ${i}` }))
    const result = await service.ingestBatch('h1', 'u1', [item({ steps })])
    expect(result.errors[0].message).toMatch(/at most 100 steps/)
  })

  it('a database error on one item is reported and does not stop the batch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.project.create.mockRejectedValueOnce(new Error('db down')).mockResolvedValue({ id: 'p2' })
    const result = await service.ingestBatch('h1', 'u1', [item(), item({ title: 'Other' })])
    expect(result.errors[0]).toMatchObject({ index: 0, message: 'db down' })
    expect(result.created).toEqual([{ index: 1, id: 'p2', title: 'Other', steps: 0 }])
  })

  it('refuses the batch when the key owner has left the household', async () => {
    db.user.findFirst.mockResolvedValue(null)
    await expect(service.ingestBatch('h1', 'u1', [item()])).rejects.toMatchObject({ statusCode: 403 })
    expect(db.project.create).not.toHaveBeenCalled()
  })
})
