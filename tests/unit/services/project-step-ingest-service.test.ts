import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    user: { findFirst: vi.fn() },
    project: { findFirst: vi.fn(), update: vi.fn() },
    projectStep: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { Prisma } from '@prisma/client'
import prisma from '@/server/utils/prisma/client'
import { ProjectStepIngestService } from '@/server/services/ProjectStepIngestService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const row = (over: Record<string, unknown> = {}) => ({ id: 's1', text: 'Call the utility', position: 0, doneAt: null, estimateMinutes: null, ...over })
const createdRows = () => db.projectStep.createMany.mock.calls[0][0].data as { id: string; text: string; position: number; estimateMinutes: number | null }[]

describe('ProjectStepIngestService', () => {
  let service: ProjectStepIngestService
  beforeEach(() => {
    service = new ProjectStepIngestService()
    vi.clearAllMocks()
    db.user.findFirst.mockResolvedValue({ id: 'u1' })
    db.project.findFirst.mockResolvedValue({ id: 'p1' })
    db.projectStep.findMany.mockResolvedValue([])
    db.projectStep.createMany.mockResolvedValue({ count: 0 })
  })

  describe('addBatch', () => {
    it('checks the owner before reading anything', async () => {
      db.user.findFirst.mockResolvedValue(null)
      await expect(service.addBatch('h1', 'u1', 'p1', [{ text: 'x' }])).rejects.toMatchObject({ statusCode: 403 })
      expect(db.project.findFirst).not.toHaveBeenCalled()
      expect(db.projectStep.findMany).not.toHaveBeenCalled()
      expect(db.projectStep.createMany).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown, other-household or deleted project', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.addBatch('h1', 'u1', 'p1', [{ text: 'x' }])).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectStep.createMany).not.toHaveBeenCalled()
    })

    it('appends steps after the highest existing position, in order, with one createMany', async () => {
      db.projectStep.findMany.mockResolvedValue([row({ id: 'a', position: 0 }), row({ id: 'b', text: 'Other', position: 4 })])
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: 'Call the city' }, { text: ' Pull a permit ', estimateMinutes: 30 }])
      expect(db.projectStep.createMany).toHaveBeenCalledTimes(1)
      const rows = createdRows()
      expect(rows.map((r) => [r.text, r.position, r.estimateMinutes])).toEqual([['Call the city', 5, null], ['Pull a permit', 6, 30]])
      expect(result).toEqual({
        created: [{ index: 0, id: rows[0].id, text: 'Call the city' }, { index: 1, id: rows[1].id, text: 'Pull a permit' }],
        skipped: [],
        errors: [],
      })
    })

    it('skips an existing undone step, ignoring case and surrounding space, and reports its id', async () => {
      db.projectStep.findMany.mockResolvedValue([row({ id: 'old', text: 'Pull a Permit', position: 0 })])
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: '  pull a permit ' }])
      expect(result).toEqual({
        created: [],
        skipped: [{ index: 0, id: 'old', text: 'pull a permit', reason: 'An undone step with this text already exists' }],
        errors: [],
      })
      expect(db.projectStep.createMany).not.toHaveBeenCalled()
    })

    it('does not treat a done step as a duplicate', async () => {
      db.projectStep.findMany.mockResolvedValue([row({ id: 'old', text: 'Clean the gutters', doneAt: new Date() })])
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: 'Clean the gutters' }])
      expect(result.created).toHaveLength(1)
      expect(result.skipped).toEqual([])
      expect(createdRows()[0].position).toBe(1)
    })

    it('skips a repeat within the batch with the id its first occurrence got', async () => {
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: 'Call' }, { text: 'Other' }, { text: ' CALL ' }])
      const rows = createdRows()
      expect(rows.map((r) => r.text)).toEqual(['Call', 'Other'])
      expect(result.skipped).toEqual([{ index: 2, id: rows[0].id, text: 'CALL', reason: 'Repeats an earlier step in this batch' }])
      expect(result.created.map((c) => c.index)).toEqual([0, 1])
    })

    it('reports invalid items as errors alongside created ones', async () => {
      const result = await service.addBatch('h1', 'u1', 'p1', [
        { text: 'Good' },
        { text: '   ' },
        { text: 'Bad estimate', estimateMinutes: 0 },
        { nope: true },
        'a string',
        null,
      ])
      expect(result.created).toHaveLength(1)
      expect(result.errors).toEqual([
        { index: 1, text: '   ', message: 'Step text is required' },
        { index: 2, text: 'Bad estimate', message: expect.stringContaining('Estimate must be') },
        { index: 3, text: '', message: 'Step text is required' },
        { index: 4, text: '', message: expect.any(String) },
        { index: 5, text: '', message: expect.any(String) },
      ])
      expect(createdRows()).toHaveLength(1)
    })

    it('errors the items that do not fit under the cap, and a repeat of one of them', async () => {
      db.projectStep.findMany.mockResolvedValue(Array.from({ length: 98 }, (_, i) => row({ id: `e${i}`, text: `Existing ${i}`, position: i })))
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'c' }])
      expect(createdRows().map((r) => r.text)).toEqual(['A', 'B'])
      expect(result.created.map((c) => c.index)).toEqual([0, 1])
      expect(result.skipped).toEqual([])
      expect(result.errors).toEqual([
        { index: 2, text: 'C', message: 'This project already has 100 steps' },
        { index: 3, text: 'c', message: 'This project already has 100 steps' },
      ])
    })

    it('does not let skipped or invalid items use up cap room', async () => {
      db.projectStep.findMany.mockResolvedValue(Array.from({ length: 99 }, (_, i) => row({ id: `e${i}`, text: `Existing ${i}`, position: i })))
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: 'existing 0' }, { text: '' }, { text: 'Existing 1' }, { text: 'New one' }])
      expect(createdRows().map((r) => r.text)).toEqual(['New one'])
      expect(result.created).toEqual([{ index: 3, id: createdRows()[0].id, text: 'New one' }])
      expect(result.skipped.map((s) => s.index)).toEqual([0, 2])
      expect(result.errors.map((e) => e.index)).toEqual([1])
    })

    it('errors every valid item when the project is already full, without a write', async () => {
      db.projectStep.findMany.mockResolvedValue(Array.from({ length: 100 }, (_, i) => row({ id: `e${i}`, text: `Existing ${i}`, position: i })))
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: 'A' }])
      expect(db.projectStep.createMany).not.toHaveBeenCalled()
      expect(result.errors).toEqual([{ index: 0, text: 'A', message: 'This project already has 100 steps' }])
    })

    it('keeps each result array in index order', async () => {
      db.projectStep.findMany.mockResolvedValue([row({ id: 'old', text: 'Dup' })])
      const result = await service.addBatch('h1', 'u1', 'p1', [{ text: 'A' }, { text: 'dup' }, { text: 'B' }, { text: 'a' }, { text: '' }])
      expect(result.created.map((c) => c.index)).toEqual([0, 2])
      expect(result.skipped.map((s) => s.index)).toEqual([1, 3])
      expect(result.errors.map((e) => e.index)).toEqual([4])
    })
  })

  describe('update', () => {
    it('checks the owner first', async () => {
      db.user.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'u1', 'p1', 's1', { done: true })).rejects.toMatchObject({ statusCode: 403 })
      expect(db.project.findFirst).not.toHaveBeenCalled()
    })

    it('checks a step off, stamping doneAt, and returns the ingest DTO', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.update.mockImplementation(async ({ data }: { data: { doneAt?: Date | null } }) => row({ doneAt: data.doneAt ?? null }))
      const result = await service.update('h1', 'u1', 'p1', 's1', { done: true })
      expect(db.projectStep.update.mock.calls[0][0].data.doneAt).toBeInstanceOf(Date)
      expect(result).toEqual({ id: 's1', text: 'Call the utility', done: true, doneAt: expect.any(Date), estimateMinutes: null, position: 0 })
    })

    it('keeps the first doneAt when the step is already done', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: new Date('2026-01-01') })
      db.projectStep.update.mockResolvedValue(row({ doneAt: new Date('2026-01-01') }))
      await service.update('h1', 'u1', 'p1', 's1', { done: true })
      expect('doneAt' in db.projectStep.update.mock.calls[0][0].data).toBe(false)
    })

    it('clears doneAt for done: false', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: new Date() })
      db.projectStep.update.mockResolvedValue(row())
      const result = await service.update('h1', 'u1', 'p1', 's1', { done: false })
      expect(db.projectStep.update.mock.calls[0][0].data.doneAt).toBeNull()
      expect(result).toMatchObject({ done: false, doneAt: null })
    })

    it('returns 404 for a step that is not on the project', async () => {
      db.projectStep.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'u1', 'p1', 's1', { text: 'x' })).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectStep.update).not.toHaveBeenCalled()
    })

    it('never touches the project', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.update.mockResolvedValue(row({ doneAt: new Date() }))
      await service.update('h1', 'u1', 'p1', 's1', { done: true })
      expect(db.project.update).not.toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('checks the owner first', async () => {
      db.user.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'u1', 'p1', 's1')).rejects.toMatchObject({ statusCode: 403 })
      expect(db.projectStep.delete).not.toHaveBeenCalled()
    })

    it('deletes the step, and a repeat answers 404', async () => {
      db.projectStep.findFirst.mockResolvedValueOnce({ id: 's1', doneAt: null }).mockResolvedValueOnce(null)
      await expect(service.remove('h1', 'u1', 'p1', 's1')).resolves.toBeUndefined()
      expect(db.projectStep.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
      await expect(service.remove('h1', 'u1', 'p1', 's1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectStep.delete).toHaveBeenCalledTimes(1)
    })

    it('answers 404, not 500, when an overlapping retry deleted the step after the check', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.delete.mockRejectedValueOnce(gone())
      await expect(service.remove('h1', 'u1', 'p1', 's1')).rejects.toMatchObject({ statusCode: 404, message: 'Step not found' })
    })

    it('passes other database errors through', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.delete.mockRejectedValueOnce(new Error('connection reset'))
      await expect(service.remove('h1', 'u1', 'p1', 's1')).rejects.toThrow('connection reset')
    })
  })

  it('update answers 404 when the step was deleted after the check', async () => {
    db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
    db.projectStep.update.mockRejectedValueOnce(gone())
    await expect(service.update('h1', 'u1', 'p1', 's1', { done: true })).rejects.toMatchObject({ statusCode: 404 })
  })
})

const gone = () => new Prisma.PrismaClientKnownRequestError('Record to delete does not exist.', { code: 'P2025', clientVersion: 'test' })
