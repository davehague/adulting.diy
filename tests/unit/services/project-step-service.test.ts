import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    projectStep: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectStepService } from '@/server/services/ProjectStepService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const stepRow = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  text: 'Buy primer',
  position: 0,
  doneAt: null,
  estimateMinutes: null,
  ...overrides,
})

describe('ProjectStepService', () => {
  let service: ProjectStepService
  beforeEach(() => {
    service = new ProjectStepService()
    vi.clearAllMocks()
    db.project.findFirst.mockResolvedValue({ id: 'p1' })
  })

  describe('add', () => {
    it('returns 404 and writes nothing for a project in another household or a deleted one', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.add('h1', 'u1', 'p1', { text: 'x' })).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
      expect(db.projectStep.create).not.toHaveBeenCalled()
    })

    it('gives the first step position 0', async () => {
      db.projectStep.findMany.mockResolvedValue([])
      db.projectStep.create.mockResolvedValue(stepRow())
      await service.add('h1', 'u1', 'p1', { text: 'Buy primer' })
      expect(db.projectStep.create.mock.calls[0][0].data).toEqual({
        projectId: 'p1', createdById: 'u1', text: 'Buy primer', estimateMinutes: null, position: 0,
      })
    })

    it('puts a new step after the highest position, even when there are gaps', async () => {
      db.projectStep.findMany.mockResolvedValue([{ position: 0 }, { position: 4 }, { position: 2 }])
      db.projectStep.create.mockResolvedValue(stepRow({ position: 5 }))
      await service.add('h1', 'u1', 'p1', { text: 'x', estimateMinutes: 30 })
      const data = db.projectStep.create.mock.calls[0][0].data
      expect(data.position).toBe(5)
      expect(data.estimateMinutes).toBe(30)
    })

    it('returns the created step', async () => {
      db.projectStep.findMany.mockResolvedValue([])
      db.projectStep.create.mockResolvedValue(stepRow())
      await expect(service.add('h1', 'u1', 'p1', { text: 'Buy primer' })).resolves.toEqual(stepRow())
    })

    it('rejects the 101st step with 409 and writes nothing', async () => {
      db.projectStep.findMany.mockResolvedValue(Array.from({ length: 100 }, (_, position) => ({ position })))
      await expect(service.add('h1', 'u1', 'p1', { text: 'x' })).rejects.toMatchObject({
        statusCode: 409, message: 'This project already has 100 steps',
      })
      expect(db.projectStep.create).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('returns 404 and writes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'p1', 's1', { done: true })).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectStep.update).not.toHaveBeenCalled()
    })

    it('returns 404 and writes nothing for a step that belongs to a different project', async () => {
      db.projectStep.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'p1', 's1', { done: true })).rejects.toMatchObject({ statusCode: 404, message: 'Step not found' })
      expect(db.projectStep.findFirst.mock.calls[0][0].where).toEqual({ id: 's1', projectId: 'p1' })
      expect(db.projectStep.update).not.toHaveBeenCalled()
    })

    it('sets doneAt when a step is checked', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.update.mockResolvedValue(stepRow({ doneAt: new Date() }))
      await service.update('h1', 'p1', 's1', { done: true })
      const call = db.projectStep.update.mock.calls[0][0]
      expect(call.where).toEqual({ id: 's1' })
      expect(call.data.doneAt).toBeInstanceOf(Date)
    })

    it('keeps the original doneAt when a done step is checked again', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: new Date('2026-10-01T12:00:00Z') })
      db.projectStep.update.mockResolvedValue(stepRow({ doneAt: new Date('2026-10-01T12:00:00Z') }))
      await service.update('h1', 'p1', 's1', { done: true })
      expect('doneAt' in db.projectStep.update.mock.calls[0][0].data).toBe(false)
    })

    it('clears doneAt when a step is unchecked', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: new Date() })
      db.projectStep.update.mockResolvedValue(stepRow())
      await service.update('h1', 'p1', 's1', { done: false })
      expect(db.projectStep.update.mock.calls[0][0].data).toEqual({ doneAt: null })
    })

    it('changes only the fields that were sent, and can clear the estimate', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      db.projectStep.update.mockResolvedValue(stepRow({ text: 'Sand' }))
      await service.update('h1', 'p1', 's1', { text: 'Sand' })
      expect(db.projectStep.update.mock.calls[0][0].data).toEqual({ text: 'Sand' })
      await service.update('h1', 'p1', 's1', { estimateMinutes: null })
      expect(db.projectStep.update.mock.calls[1][0].data).toEqual({ estimateMinutes: null })
    })
  })

  describe('remove', () => {
    it('returns 404 and deletes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'p1', 's1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectStep.delete).not.toHaveBeenCalled()
    })

    it('returns 404 and deletes nothing for a step that belongs to a different project', async () => {
      db.projectStep.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'p1', 's1')).rejects.toMatchObject({ statusCode: 404, message: 'Step not found' })
      expect(db.projectStep.delete).not.toHaveBeenCalled()
    })

    it('deletes only the named step', async () => {
      db.projectStep.findFirst.mockResolvedValue({ id: 's1', doneAt: null })
      await service.remove('h1', 'p1', 's1')
      expect(db.projectStep.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
    })
  })

  describe('nextSteps', () => {
    it('asks only for the household\'s Active, non-deleted projects, newest first, with ordered steps', async () => {
      db.project.count.mockResolvedValue(0)
      db.project.findMany.mockResolvedValue([])
      await service.nextSteps('h1')
      const query = db.project.findMany.mock.calls[0][0]
      expect(query.where).toEqual({ householdId: 'h1', metaStatus: 'active', status: 'active' })
      expect(query.orderBy).toEqual({ createdAt: 'desc' })
      expect(query.select.steps.orderBy).toEqual([{ position: 'asc' }, { createdAt: 'asc' }])
      expect(db.project.count.mock.calls[0][0].where).toEqual({ householdId: 'h1', metaStatus: 'active' })
    })

    it('reports hasProjects false with no items for a household with no projects', async () => {
      db.project.count.mockResolvedValue(0)
      db.project.findMany.mockResolvedValue([])
      await expect(service.nextSteps('h1')).resolves.toEqual({ hasProjects: false, items: [] })
    })

    it('reports hasProjects true with no items when no project is Active', async () => {
      db.project.count.mockResolvedValue(3)
      db.project.findMany.mockResolvedValue([])
      await expect(service.nextSteps('h1')).resolves.toEqual({ hasProjects: true, items: [] })
    })

    it('returns one item per project with the right kind, in query order', async () => {
      db.project.count.mockResolvedValue(3)
      db.project.findMany.mockResolvedValue([
        {
          id: 'p-step', title: 'Fix gate latch',
          steps: [
            stepRow({ id: 's1', doneAt: new Date() }),
            stepRow({ id: 's2', text: 'Fit new latch', position: 1, estimateMinutes: 30 }),
            stepRow({ id: 's3', text: 'Paint', position: 2 }),
          ],
        },
        { id: 'p-empty', title: 'Clean light fixtures', steps: [] },
        { id: 'p-done', title: 'Patch drywall', steps: [stepRow({ id: 's9', doneAt: new Date() })] },
      ])
      const result = await service.nextSteps('h1')
      expect(result.items).toEqual([
        { projectId: 'p-step', projectTitle: 'Fix gate latch', kind: 'step', step: { id: 's2', text: 'Fit new latch', estimateMinutes: 30 } },
        { projectId: 'p-empty', projectTitle: 'Clean light fixtures', kind: 'noSteps', step: null },
        { projectId: 'p-done', projectTitle: 'Patch drywall', kind: 'allDone', step: null },
      ])
    })
  })
})
