import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    provider: { findFirst: vi.fn() },
    projectProvider: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectProviderService, toProviderLinks } from '@/server/services/ProjectProviderService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const linkRow = (providerId: string, status: string, overrides: Record<string, unknown> = {}) => ({
  providerId,
  status,
  provider: { id: providerId, name: `Provider ${providerId}`, phone: null, evidence: [], ...overrides },
})

describe('toProviderLinks', () => {
  it('maps a row, counting only neighbor recommendations', () => {
    const [dto] = toProviderLinks([
      linkRow('pr1', 'chosen', {
        phone: '614-555-0101',
        evidence: [
          { kind: 'third_party', sourceDate: null },
          { kind: 'third_party', sourceDate: null },
          { kind: 'self_promo', sourceDate: null },
          { kind: 'lead', sourceDate: null },
        ],
      }),
    ])
    expect(dto).toEqual({
      providerId: 'pr1',
      status: 'chosen',
      provider: { id: 'pr1', name: 'Provider pr1', phone: '614-555-0101', neighborCount: 2 },
    })
  })

  it('orders by status, keeping the given order within a status', () => {
    const dtos = toProviderLinks([
      linkRow('a', 'considering'), linkRow('b', 'passed'), linkRow('c', 'chosen'), linkRow('d', 'considering'), linkRow('e', 'contacted'),
    ])
    expect(dtos.map((d) => d.providerId)).toEqual(['c', 'e', 'a', 'd', 'b'])
  })

  it('returns an empty list for no rows', () => {
    expect(toProviderLinks([])).toEqual([])
  })
})

describe('ProjectProviderService', () => {
  let service: ProjectProviderService
  beforeEach(() => {
    service = new ProjectProviderService()
    vi.clearAllMocks()
    db.project.findFirst.mockResolvedValue({ id: 'p1' })
    db.provider.findFirst.mockResolvedValue({ id: 'pr1' })
    db.projectProvider.findMany.mockResolvedValue([])
    db.projectProvider.findFirst.mockResolvedValue({ id: 'l1' })
  })

  const expectProjectScoped = () =>
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })

  describe('listForProject', () => {
    it('returns 404 for a project in another household or a deleted one', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.listForProject('h1', 'p1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expectProjectScoped()
      expect(db.projectProvider.findMany).not.toHaveBeenCalled()
    })

    it('reads only links whose provider is not removed, oldest first', async () => {
      await service.listForProject('h1', 'p1')
      const args = db.projectProvider.findMany.mock.calls[0][0]
      expect(args.where).toEqual({ projectId: 'p1', provider: { metaStatus: 'active' } })
      expect(args.orderBy).toEqual({ createdAt: 'asc' })
    })

    it('returns the links sorted by status', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('a', 'passed'), linkRow('b', 'chosen')])
      const result = await service.listForProject('h1', 'p1')
      expect(result.map((l) => l.providerId)).toEqual(['b', 'a'])
    })
  })

  describe('link', () => {
    it('returns 404 and writes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('returns 404 and writes nothing for a provider in another household or a removed one', async () => {
      db.provider.findFirst.mockResolvedValue(null)
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({ statusCode: 404, message: 'Provider not found' })
      expect(db.provider.findFirst.mock.calls[0][0].where).toEqual({ id: 'pr1', householdId: 'h1', metaStatus: 'active' })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('rejects a provider that is already linked with 409 and writes nothing', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('pr1', 'passed')])
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 409, message: 'That provider is already on this project',
      })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('rejects the 26th link with 409 and writes nothing', async () => {
      db.projectProvider.findMany.mockResolvedValue(Array.from({ length: 25 }, (_, i) => linkRow(`other-${i}`, 'considering')))
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 409, message: 'This project already has 25 providers',
      })
      expect(db.projectProvider.create).not.toHaveBeenCalled()
    })

    it('allows the 25th link', async () => {
      db.projectProvider.findMany.mockResolvedValue(Array.from({ length: 24 }, (_, i) => linkRow(`other-${i}`, 'considering')))
      await service.link('h1', 'u1', 'p1', 'pr1')
      expect(db.projectProvider.create).toHaveBeenCalledTimes(1)
    })

    it('counts only links whose provider is not removed toward the cap', async () => {
      await service.link('h1', 'u1', 'p1', 'pr1')
      expect(db.projectProvider.findMany.mock.calls[0][0].where).toEqual({ projectId: 'p1', provider: { metaStatus: 'active' } })
    })

    it('creates the link without a status, so the column default (considering) applies', async () => {
      await service.link('h1', 'u1', 'p1', 'pr1')
      expect(db.projectProvider.create.mock.calls[0][0].data).toEqual({ projectId: 'p1', providerId: 'pr1', createdById: 'u1' })
    })

    it('returns the full list read after the write', async () => {
      db.projectProvider.findMany
        .mockResolvedValueOnce([linkRow('a', 'chosen')])
        .mockResolvedValueOnce([linkRow('pr1', 'considering'), linkRow('a', 'chosen')])
      const result = await service.link('h1', 'u1', 'p1', 'pr1')
      expect(result.map((l) => l.providerId)).toEqual(['a', 'pr1'])
    })

    it('turns a unique-constraint race into 409', async () => {
      db.projectProvider.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 409, message: 'That provider is already on this project',
      })
    })

    it('rethrows any other create failure unchanged', async () => {
      const failure = new Error('connection lost')
      db.projectProvider.create.mockRejectedValue(failure)
      await expect(service.link('h1', 'u1', 'p1', 'pr1')).rejects.toBe(failure)
    })
  })

  describe('setStatus', () => {
    it('returns 404 and writes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.setStatus('h1', 'p1', 'pr1', 'chosen')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectProvider.update).not.toHaveBeenCalled()
    })

    it('returns 404 and writes nothing when the provider is not linked or has been removed', async () => {
      db.projectProvider.findFirst.mockResolvedValue(null)
      await expect(service.setStatus('h1', 'p1', 'pr1', 'chosen')).rejects.toMatchObject({
        statusCode: 404, message: 'That provider is not on this project',
      })
      expect(db.projectProvider.findFirst.mock.calls[0][0].where).toEqual({
        projectId: 'p1', providerId: 'pr1', provider: { metaStatus: 'active' },
      })
      expect(db.projectProvider.update).not.toHaveBeenCalled()
    })

    it('rejects an unknown status with 400 before reading anything', async () => {
      await expect(service.setStatus('h1', 'p1', 'pr1', 'hired' as never)).rejects.toMatchObject({ statusCode: 400, message: 'Unknown status' })
      expect(db.project.findFirst).not.toHaveBeenCalled()
      expect(db.projectProvider.update).not.toHaveBeenCalled()
    })

    it('updates the link by its id and returns the full list', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('pr1', 'chosen')])
      const result = await service.setStatus('h1', 'p1', 'pr1', 'chosen')
      expect(db.projectProvider.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { status: 'chosen' } })
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('chosen')
    })

    it('lets more than one provider be chosen (it changes only the named link)', async () => {
      await service.setStatus('h1', 'p1', 'pr1', 'chosen')
      expect(db.projectProvider.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('unlink', () => {
    it('returns 404 and deletes nothing for a project in another household', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.unlink('h1', 'p1', 'pr1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.projectProvider.delete).not.toHaveBeenCalled()
    })

    it('returns 404 and deletes nothing when the provider is not linked', async () => {
      db.projectProvider.findFirst.mockResolvedValue(null)
      await expect(service.unlink('h1', 'p1', 'pr1')).rejects.toMatchObject({
        statusCode: 404, message: 'That provider is not on this project',
      })
      expect(db.projectProvider.delete).not.toHaveBeenCalled()
    })

    it('deletes the link by its id and returns the remaining list', async () => {
      db.projectProvider.findMany.mockResolvedValue([linkRow('other', 'considering')])
      const result = await service.unlink('h1', 'p1', 'pr1')
      expect(db.projectProvider.delete).toHaveBeenCalledWith({ where: { id: 'l1' } })
      expect(result.map((l) => l.providerId)).toEqual(['other'])
    })
  })
})
