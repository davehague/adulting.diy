import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectService } from '@/server/services/ProjectService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  householdId: 'h1',
  title: 'Paint ceiling spots',
  location: 'Hallway',
  status: 'planning',
  path: null,
  notes: null,
  completedAt: null,
  metaStatus: 'active',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  photos: [],
  steps: [],
  ...overrides,
})

describe('ProjectService', () => {
  let service: ProjectService
  beforeEach(() => { service = new ProjectService(); vi.clearAllMocks() })

  describe('list', () => {
    it('scopes to the household, hides deleted, and defaults to planning and active', async () => {
      db.project.findMany.mockResolvedValue([])
      await service.list('h1', {})
      const where = db.project.findMany.mock.calls[0][0].where
      expect(where.householdId).toBe('h1')
      expect(where.metaStatus).toBe('active')
      expect(where.status).toEqual({ in: ['planning', 'active'] })
    })

    it('filters to projects with no path when path is none', async () => {
      db.project.findMany.mockResolvedValue([])
      await service.list('h1', { path: 'none' })
      expect(db.project.findMany.mock.calls[0][0].where.path).toBeNull()
    })

    it('filters by a specific path', async () => {
      db.project.findMany.mockResolvedValue([])
      await service.list('h1', { path: 'diy' })
      expect(db.project.findMany.mock.calls[0][0].where.path).toBe('diy')
    })

    it('puts active before planning and keeps newest first within a status', async () => {
      db.project.findMany.mockResolvedValue([
        row({ id: 'plan-new', status: 'planning' }),
        row({ id: 'active-new', status: 'active' }),
        row({ id: 'plan-old', status: 'planning' }),
        row({ id: 'active-old', status: 'active' }),
      ])
      const result = await service.list('h1', {})
      expect(result.map((p) => p.id)).toEqual(['active-new', 'active-old', 'plan-new', 'plan-old'])
      expect(db.project.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' })
    })

    it('reports the photo count and the first photo as the cover', async () => {
      db.project.findMany.mockResolvedValue([row({ photos: [{ id: 'ph1' }, { id: 'ph2' }] }), row({ id: 'p2' })])
      const [withPhotos, without] = await service.list('h1', {})
      expect(withPhotos.photoCount).toBe(2)
      expect(withPhotos.coverPhotoId).toBe('ph1')
      expect(without.photoCount).toBe(0)
      expect(without.coverPhotoId).toBeNull()
    })

    it('reports ordered photo ids for a project with photos, and an empty array for one without', async () => {
      db.project.findMany.mockResolvedValue([row({ photos: [{ id: 'ph1' }, { id: 'ph2' }] }), row({ id: 'p2' })])
      const [withPhotos, without] = await service.list('h1', {})
      expect(withPhotos.photoIds).toEqual(['ph1', 'ph2'])
      expect(without.photoIds).toEqual([])
    })
  })

  describe('create', () => {
    it('stores the household and creator and returns the id', async () => {
      db.project.create.mockResolvedValue({ id: 'new-id' })
      const result = await service.create('h1', 'u1', { title: 'Patch hole', location: 'Kitchen' })
      expect(result).toEqual({ id: 'new-id' })
      expect(db.project.create.mock.calls[0][0].data).toEqual({
        householdId: 'h1', createdById: 'u1', title: 'Patch hole', location: 'Kitchen', notes: null,
      })
    })

    it('stores notes given at capture', async () => {
      db.project.create.mockResolvedValue({ id: 'new-id' })
      await service.create('h1', 'u1', { title: 'Patch hole', notes: 'Behind the picture.\nAbout 3 inches wide.' })
      expect(db.project.create.mock.calls[0][0].data.notes).toBe('Behind the picture.\nAbout 3 inches wide.')
    })

    it('stores a missing location as null', async () => {
      db.project.create.mockResolvedValue({ id: 'new-id' })
      await service.create('h1', 'u1', { title: 'Patch hole' })
      expect(db.project.create.mock.calls[0][0].data.location).toBeNull()
    })
  })

  describe('get', () => {
    it('returns 404 for a project in another household or a deleted one', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.get('h1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
    })

    it('returns the project with its photos', async () => {
      db.project.findFirst.mockResolvedValue(row({ photos: [{ id: 'ph1', width: 2000, height: 1500, position: 0 }] }))
      const result = await service.get('h1', 'p1')
      expect(result.title).toBe('Paint ceiling spots')
      expect(result.photos).toEqual([{ id: 'ph1', width: 2000, height: 1500, position: 0 }])
    })

    it('returns the project with its steps, asked for in position then creation order', async () => {
      const steps = [
        { id: 's1', text: 'Buy primer', position: 0, doneAt: new Date('2026-10-02T12:00:00Z'), estimateMinutes: 20 },
        { id: 's2', text: 'Paint', position: 1, doneAt: null, estimateMinutes: null },
      ]
      db.project.findFirst.mockResolvedValue(row({ steps }))
      const result = await service.get('h1', 'p1')
      expect(result.steps).toEqual(steps)
      expect(db.project.findFirst.mock.calls[0][0].include.steps.orderBy).toEqual([{ position: 'asc' }, { createdAt: 'asc' }])
    })
  })

  describe('update', () => {
    it('returns 404 and writes nothing for another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.update('h1', 'p1', { title: 'x' })).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.update).not.toHaveBeenCalled()
    })

    it('sets completedAt when a project becomes done', async () => {
      db.project.findFirst.mockResolvedValue(row({ status: 'active' }))
      db.project.update.mockResolvedValue(row({ status: 'done' }))
      await service.update('h1', 'p1', { status: 'done' })
      expect(db.project.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date)
    })

    it('keeps the original completedAt when a done project is marked done again', async () => {
      const finished = new Date('2026-09-01T00:00:00Z')
      db.project.findFirst.mockResolvedValue(row({ status: 'done', completedAt: finished }))
      db.project.update.mockResolvedValue(row({ status: 'done', completedAt: finished }))
      await service.update('h1', 'p1', { status: 'done' })
      expect(db.project.update.mock.calls[0][0].data.completedAt).toBe(finished)
    })

    it('clears completedAt when a project leaves done', async () => {
      db.project.findFirst.mockResolvedValue(row({ status: 'done', completedAt: new Date() }))
      db.project.update.mockResolvedValue(row({ status: 'active' }))
      await service.update('h1', 'p1', { status: 'active' })
      expect(db.project.update.mock.calls[0][0].data.completedAt).toBeNull()
    })

    it('does not touch completedAt when status is not in the update', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.project.update.mockResolvedValue(row({ notes: 'x' }))
      await service.update('h1', 'p1', { notes: 'x' })
      expect('completedAt' in db.project.update.mock.calls[0][0].data).toBe(false)
    })

    it('writes only the fields that were sent', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.project.update.mockResolvedValue(row({ path: 'diy' }))
      await service.update('h1', 'p1', { path: 'diy' })
      expect(db.project.update.mock.calls[0][0].data).toEqual({ path: 'diy' })
    })
  })

  describe('softDelete', () => {
    it('marks the project deleted', async () => {
      db.project.findFirst.mockResolvedValue(row())
      db.project.update.mockResolvedValue(row({ metaStatus: 'deleted' }))
      await service.softDelete('h1', 'p1')
      expect(db.project.update.mock.calls[0][0]).toMatchObject({ where: { id: 'p1' }, data: { metaStatus: 'deleted' } })
    })

    it('returns 404 for another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.softDelete('h1', 'p1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.update).not.toHaveBeenCalled()
    })
  })

  describe('locations', () => {
    it('returns distinct, sorted locations for the household', async () => {
      db.project.findMany.mockResolvedValue([{ location: 'kitchen' }, { location: 'Hallway' }, { location: null }])
      const result = await service.locations('h1')
      expect(result).toEqual(['Hallway', 'kitchen'])
      const args = db.project.findMany.mock.calls[0][0]
      expect(args.where).toEqual({ householdId: 'h1', metaStatus: 'active', location: { not: null } })
      expect(args.distinct).toEqual(['location'])
    })
  })
})
