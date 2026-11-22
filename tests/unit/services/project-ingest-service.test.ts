import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => {
  const db: Record<string, unknown> = {
    user: { findFirst: vi.fn() },
    project: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    providerCategory: { findFirst: vi.fn() },
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

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', householdId: 'h1', title: 'Shed', location: 'Yard', status: 'planning', path: null, notes: null,
  completedAt: null, metaStatus: 'active', createdAt: new Date('2026-10-01T00:00:00Z'), providerCategoryId: null,
  photos: [], steps: [], providers: [], documents: [], ...over,
})
const extra = (over: Record<string, unknown> = {}) => ({ updatedAt: new Date('2026-11-20T00:00:00Z'), photos: [], ...over })

describe('ProjectIngestService project detail, update and delete', () => {
  let service: ProjectIngestService
  beforeEach(() => {
    service = new ProjectIngestService()
    vi.resetAllMocks()
    // resetAllMocks also clears the transaction helper the batch tests above rely on
    ;(db as unknown as Record<string, ReturnType<typeof vi.fn>>).$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(db))
    db.user.findFirst.mockResolvedValue({ id: 'u1' })
    db.project.findFirst.mockResolvedValue(row())
    db.project.findUnique.mockResolvedValue(extra())
    db.project.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data))
    db.project.updateMany.mockResolvedValue({ count: 1 })
  })

  describe('getDetail', () => {
    it('maps steps, providers, photos and timestamps and leaves out householdId', async () => {
      const doneAt = new Date('2026-11-02T00:00:00Z')
      db.project.findFirst.mockResolvedValue(row({
        steps: [
          { id: 's1', text: 'Call', position: 0, doneAt, estimateMinutes: 15 },
          { id: 's2', text: 'Dig', position: 1, doneAt: null, estimateMinutes: null },
        ],
        providers: [{ providerId: 'pr1', status: 'chosen', provider: { id: 'pr1', name: 'Owens', phone: '555', evidence: [] } }],
        photos: [{ id: 'ph1', width: 2000, height: 1500, position: 0 }, { id: 'ph2', width: 10, height: 20, position: 1 }],
        documents: [{ id: 'd1', name: 'Quote', note: null, fileName: 'q.pdf', contentType: 'application/pdf', sizeBytes: 5, createdAt: doneAt }],
      }))
      const c1 = new Date('2026-10-02T00:00:00Z')
      const c2 = new Date('2026-10-03T00:00:00Z')
      db.project.findUnique.mockResolvedValue(extra({ photos: [{ id: 'ph2', createdAt: c2 }, { id: 'ph1', createdAt: c1 }] }))

      const detail = await service.getDetail('h1', 'p1')

      expect(detail).not.toHaveProperty('householdId')
      expect(detail.updatedAt).toEqual(new Date('2026-11-20T00:00:00Z'))
      expect(detail.steps.map((s) => [s.id, s.done])).toEqual([['s1', true], ['s2', false]])
      expect(detail.providers).toEqual([{ id: 'pr1', name: 'Owens', status: 'chosen' }])
      expect(detail.photos).toEqual([
        { id: 'ph1', position: 0, width: 2000, height: 1500, createdAt: c1 },
        { id: 'ph2', position: 1, width: 10, height: 20, createdAt: c2 },
      ])
      expect(detail.documents[0]).toMatchObject({ id: 'd1', fileName: 'q.pdf' })
      expect(db.project.findUnique).toHaveBeenCalledTimes(1)
    })

    it('answers 404 for a missing project and does not check the key owner', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.getDetail('h1', 'nope')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.user.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('refuses with 403 before writing anything when the key owner has left', async () => {
      db.user.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'u1', 'p1', { title: 'X', notesAppend: 'Y' })).rejects.toMatchObject({ statusCode: 403 })
      expect(db.project.update).not.toHaveBeenCalled()
      expect(db.project.updateMany).not.toHaveBeenCalled()
      expect(db.project.findFirst).not.toHaveBeenCalled()
    })

    it('passes fields to ProjectService and returns the mapped detail', async () => {
      const result = await service.update('h1', 'u1', 'p1', { title: 'New', location: null, path: 'diy' })
      expect(db.project.update.mock.calls[0][0].data).toEqual({ title: 'New', location: null, path: 'diy' })
      expect(result).toMatchObject({ title: 'New', location: null, path: 'diy' })
      expect(result).not.toHaveProperty('householdId')
      expect(result.updatedAt).toEqual(new Date('2026-11-20T00:00:00Z'))
    })

    it('stamps completedAt when a project moves to done', async () => {
      await service.update('h1', 'u1', 'p1', { status: 'done' })
      const data = db.project.update.mock.calls[0][0].data
      expect(data.status).toBe('done')
      expect(data.completedAt).toBeInstanceOf(Date)
    })

    it('keeps the existing completedAt when a done project stays done', async () => {
      const when = new Date('2026-09-01T00:00:00Z')
      db.project.findFirst.mockResolvedValue(row({ status: 'done', completedAt: when }))
      await service.update('h1', 'u1', 'p1', { status: 'done' })
      expect(db.project.update.mock.calls[0][0].data.completedAt).toBe(when)
    })

    it('clears completedAt when a project leaves done', async () => {
      db.project.findFirst.mockResolvedValue(row({ status: 'done', completedAt: new Date() }))
      await service.update('h1', 'u1', 'p1', { status: 'active' })
      expect(db.project.update.mock.calls[0][0].data).toMatchObject({ status: 'active', completedAt: null })
    })

    describe('notesAppend', () => {
      it('sets the notes to the paragraph when they are empty', async () => {
        db.project.findFirst.mockResolvedValue(row({ notes: null }))
        await service.update('h1', 'u1', 'p1', { notesAppend: 'New' })
        expect(db.project.updateMany).toHaveBeenCalledWith({
          where: { id: 'p1', householdId: 'h1', metaStatus: 'active', notes: null },
          data: { notes: 'New' },
        })
        expect(db.project.update).not.toHaveBeenCalled()
      })

      it('adds the paragraph after a blank line', async () => {
        db.project.findFirst.mockResolvedValue(row({ notes: 'Old' }))
        await service.update('h1', 'u1', 'p1', { notesAppend: 'New' })
        expect(db.project.updateMany.mock.calls[0][0]).toMatchObject({ where: { notes: 'Old' }, data: { notes: 'Old\n\nNew' } })
      })

      it('writes nothing when the notes already end with that paragraph', async () => {
        db.project.findFirst.mockResolvedValue(row({ notes: 'Old\n\nNew' }))
        await service.update('h1', 'u1', 'p1', { notesAppend: 'New' })
        db.project.findFirst.mockResolvedValue(row({ notes: 'New' }))
        await service.update('h1', 'u1', 'p1', { notesAppend: 'New' })
        expect(db.project.updateMany).not.toHaveBeenCalled()
      })

      it('answers 400 and writes nothing when the notes would pass 5000 characters', async () => {
        db.project.findFirst.mockResolvedValue(row({ notes: 'x'.repeat(4990) }))
        await expect(service.update('h1', 'u1', 'p1', { notesAppend: 'y'.repeat(20) })).rejects.toMatchObject({
          statusCode: 400, message: 'Notes would be 5012 characters; the limit is 5000',
        })
        expect(db.project.updateMany).not.toHaveBeenCalled()
      })

      it('answers 404 when the project is gone', async () => {
        db.project.findFirst.mockResolvedValue(null)
        await expect(service.update('h1', 'u1', 'p1', { notesAppend: 'New' })).rejects.toMatchObject({ statusCode: 404 })
      })

      it('re-reads and retries when another write changed the notes in between', async () => {
        db.project.findFirst
          .mockResolvedValueOnce(row({ notes: 'A' }))
          .mockResolvedValueOnce(row({ notes: 'A\n\nB' }))
          .mockResolvedValue(row({ notes: 'A\n\nB\n\nNew' }))
        db.project.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })
        await service.update('h1', 'u1', 'p1', { notesAppend: 'New' })
        expect(db.project.updateMany).toHaveBeenCalledTimes(2)
        expect(db.project.updateMany.mock.calls[1][0]).toMatchObject({ where: { notes: 'A\n\nB' }, data: { notes: 'A\n\nB\n\nNew' } })
        // two reads for the append, one more when the detail is built
        expect(db.project.findFirst).toHaveBeenCalledTimes(3)
      })

      it('answers 409 after three misses', async () => {
        db.project.updateMany.mockResolvedValue({ count: 0 })
        await expect(service.update('h1', 'u1', 'p1', { notesAppend: 'New' })).rejects.toMatchObject({
          statusCode: 409, message: 'The notes changed while appending. Try again.',
        })
        expect(db.project.updateMany).toHaveBeenCalledTimes(3)
      })

      it('appends first and then updates the other fields', async () => {
        db.project.findFirst.mockResolvedValue(row({ notes: 'Old' }))
        await service.update('h1', 'u1', 'p1', { notesAppend: 'New', status: 'active' })
        expect(db.project.updateMany).toHaveBeenCalledTimes(1)
        expect(db.project.update).toHaveBeenCalledTimes(1)
        expect(db.project.update.mock.calls[0][0].data).toEqual({ status: 'active', completedAt: null })
      })
    })
  })

  describe('remove', () => {
    it('refuses with 403 and writes nothing when the key owner has left', async () => {
      db.user.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'u1', 'p1')).rejects.toMatchObject({ statusCode: 403 })
      expect(db.project.update).not.toHaveBeenCalled()
    })

    it('soft-deletes the project', async () => {
      await service.remove('h1', 'u1', 'p1')
      expect(db.project.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { metaStatus: 'deleted' } })
    })

    it('answers 404 for a project that is already deleted', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'u1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.update).not.toHaveBeenCalled()
    })
  })
})
