import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    projectPhoto: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/server/utils/blob-storage', () => ({
  putPrivate: vi.fn(),
  getPrivate: vi.fn(),
  removeBlobs: vi.fn(),
}))

import { MAX_PROJECT_PHOTOS } from '@/types/project'
import prisma from '@/server/utils/prisma/client'
import { putPrivate, getPrivate, removeBlobs } from '@/server/utils/blob-storage'
import { ProjectPhotoService } from '@/server/services/ProjectPhotoService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
const blob = {
  put: putPrivate as unknown as ReturnType<typeof vi.fn>,
  get: getPrivate as unknown as ReturnType<typeof vi.fn>,
  remove: removeBlobs as unknown as ReturnType<typeof vi.fn>,
}

const jpeg = (size = 10): Buffer => {
  const data = Buffer.alloc(size)
  data[0] = 0xff; data[1] = 0xd8; data[2] = 0xff
  return data
}
const upload = (overrides: Record<string, unknown> = {}) => ({ full: jpeg(), thumb: jpeg(), width: 2000, height: 1500, ...overrides })

describe('ProjectPhotoService', () => {
  let service: ProjectPhotoService
  beforeEach(() => {
    service = new ProjectPhotoService()
    vi.clearAllMocks()
    blob.put.mockResolvedValue(undefined)
    blob.remove.mockResolvedValue(undefined)
    db.projectPhoto.count.mockResolvedValue(1)
    ;(prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
  })

  describe('add', () => {
    it('returns 404 for a project in another household or a deleted project, and stores nothing', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('rejects a photo past the cap', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue(Array.from({ length: MAX_PROJECT_PHOTOS }, (_, i) => ({ position: i })))
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toMatchObject({
        statusCode: 409, message: 'This project already has 25 photos',
      })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('rejects a file that is not a JPEG before writing anything', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
      await expect(service.add('h1', 'p1', 'u1', upload({ full: png }))).rejects.toMatchObject({
        statusCode: 400, message: 'Only JPEG photos are accepted',
      })
      await expect(service.add('h1', 'p1', 'u1', upload({ thumb: Buffer.from('hello world') }))).rejects.toMatchObject({ statusCode: 400 })
      await expect(service.add('h1', 'p1', 'u1', upload({ full: Buffer.alloc(0) }))).rejects.toMatchObject({ statusCode: 400 })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('rejects an oversized full image or thumbnail', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      await expect(service.add('h1', 'p1', 'u1', upload({ full: jpeg(3 * 1024 * 1024 + 1) }))).rejects.toMatchObject({
        statusCode: 413, message: 'Photo is too large',
      })
      await expect(service.add('h1', 'p1', 'u1', upload({ thumb: jpeg(200 * 1024 + 1) }))).rejects.toMatchObject({ statusCode: 413 })
      expect(blob.put).not.toHaveBeenCalled()
    })

    it('accepts images exactly at the size limits', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      await expect(service.add('h1', 'p1', 'u1', upload({ full: jpeg(3 * 1024 * 1024), thumb: jpeg(200 * 1024) }))).resolves.toBeTruthy()
    })

    it('writes both blobs under the household and project, then the row, at the next position', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([{ position: 0 }, { position: 4 }])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      const result = await service.add('h1', 'p1', 'u1', upload())

      const data = db.projectPhoto.create.mock.calls[0][0].data
      expect(data.position).toBe(5)
      expect(data.projectId).toBe('p1')
      expect(data.uploadedById).toBe('u1')
      expect(data.fullPath).toBe(`households/h1/projects/p1/${data.id}-full.jpg`)
      expect(data.thumbPath).toBe(`households/h1/projects/p1/${data.id}-thumb.jpg`)
      expect(blob.put.mock.calls.map((c) => c[0])).toEqual([data.fullPath, data.thumbPath])
      expect(result).toEqual({ id: data.id, width: 2000, height: 1500, position: 5 })
    })

    it('gives the first photo position 0', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      expect((await service.add('h1', 'p1', 'u1', upload())).position).toBe(0)
    })

    it('deletes the row and both blobs when the post-create count exceeds the cap', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      db.projectPhoto.count.mockResolvedValue(MAX_PROJECT_PHOTOS + 1)
      const result = service.add('h1', 'p1', 'u1', upload())
      await expect(result).rejects.toMatchObject({
        statusCode: 409, message: 'This project already has 25 photos',
      })
      const createdId = db.projectPhoto.create.mock.calls[0][0].data.id
      expect(db.projectPhoto.delete).toHaveBeenCalledWith({ where: { id: createdId } })
      const removed = blob.remove.mock.calls[0][0] as string[]
      expect(removed).toHaveLength(2)
      expect(removed[0]).toMatch(/-full\.jpg$/)
      expect(removed[1]).toMatch(/-thumb\.jpg$/)
    })

    it('resolves and deletes nothing when the post-create count is at or under the cap', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
      db.projectPhoto.count.mockResolvedValue(MAX_PROJECT_PHOTOS)
      await expect(service.add('h1', 'p1', 'u1', upload())).resolves.toBeTruthy()
      expect(db.projectPhoto.delete).not.toHaveBeenCalled()
      expect(blob.remove).not.toHaveBeenCalled()
    })

    it('removes both blobs when the row cannot be created', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockRejectedValue(new Error('db down'))
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toThrow('db down')
      const removed = blob.remove.mock.calls[0][0] as string[]
      expect(removed).toHaveLength(2)
      expect(removed[0]).toMatch(/-full\.jpg$/)
      expect(removed[1]).toMatch(/-thumb\.jpg$/)
    })

    it('returns 502 and creates no row when storage fails, cleaning up a partial write', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      blob.put.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('blob down'))
      await expect(service.add('h1', 'p1', 'u1', upload())).rejects.toMatchObject({ statusCode: 502 })
      expect(db.projectPhoto.create).not.toHaveBeenCalled()
      expect(blob.remove).toHaveBeenCalled()
    })
  })

  describe('insert', () => {
    const ID = '55555555-5555-4555-8555-555555555555'
    const createdAt = new Date('2026-11-02')
    const setup = () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      db.projectPhoto.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, createdAt }))
    }

    it('returns the row DTO with createdAt', async () => {
      setup()
      const result = await service.insert('h1', 'p1', 'u1', upload())
      const data = db.projectPhoto.create.mock.calls[0][0].data
      expect(result).toEqual({ id: data.id, width: 2000, height: 1500, position: 0, createdAt })
    })

    it('without an id names the blobs after the generated id', async () => {
      setup()
      await service.insert('h1', 'p1', 'u1', upload())
      const data = db.projectPhoto.create.mock.calls[0][0].data
      expect(data.fullPath).toBe(`households/h1/projects/p1/${data.id}-full.jpg`)
      expect(data.thumbPath).toBe(`households/h1/projects/p1/${data.id}-thumb.jpg`)
    })

    it('with an id uses it for the row but keeps it out of the blob paths', async () => {
      setup()
      const result = await service.insert('h1', 'p1', 'u1', upload(), { id: ID })
      const data = db.projectPhoto.create.mock.calls[0][0].data
      expect(data.id).toBe(ID)
      expect(result.id).toBe(ID)
      expect(data.fullPath).toMatch(/^households\/h1\/projects\/p1\/[0-9a-f-]{36}-full\.jpg$/)
      expect(data.thumbPath).toMatch(/^households\/h1\/projects\/p1\/[0-9a-f-]{36}-thumb\.jpg$/)
      expect(data.fullPath).not.toContain(ID)
      expect(data.thumbPath).not.toContain(ID)
      expect(blob.put.mock.calls.map((c) => c[0])).toEqual([data.fullPath, data.thumbPath])
    })

    it('uses a different file key for each insert with the same id, and a losing create removes only its own paths', async () => {
      setup()
      const winner = await service.insert('h1', 'p1', 'u1', upload(), { id: ID })
      const winnerData = db.projectPhoto.create.mock.calls[0][0].data
      expect(winner.id).toBe(ID)

      db.projectPhoto.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))
      blob.remove.mockClear()
      await expect(service.insert('h1', 'p1', 'u1', upload(), { id: ID })).rejects.toMatchObject({ code: 'P2002' })
      const loserData = db.projectPhoto.create.mock.calls[1][0].data
      expect(loserData.fullPath).not.toBe(winnerData.fullPath)
      expect(loserData.thumbPath).not.toBe(winnerData.thumbPath)
      expect(blob.remove).toHaveBeenCalledTimes(1)
      expect(blob.remove).toHaveBeenCalledWith([loserData.fullPath, loserData.thumbPath])
      const removed = blob.remove.mock.calls[0][0] as string[]
      expect(removed).not.toContain(winnerData.fullPath)
      expect(removed).not.toContain(winnerData.thumbPath)
      expect(removed.some((path) => path.includes(`${ID}-full.jpg`) || path.includes(`${ID}-thumb.jpg`))).toBe(false)
    })
  })

  describe('reorder', () => {
    const createdAt = new Date('2026-11-02')
    const tx = () => prisma.$transaction as unknown as ReturnType<typeof vi.fn>

    it('returns 404 for a missing or deleted project and opens no transaction', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.reorder('h1', 'p1', ['a'])).rejects.toMatchObject({ statusCode: 404 })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
      expect(tx()).not.toHaveBeenCalled()
    })

    it('rejects a list that misses a photo or names an unknown one, writing nothing', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([{ id: 'a', position: 0 }, { id: 'b', position: 1 }])
      for (const ids of [['a'], ['a', 'b', 'c'], ['a', 'x'], []]) {
        await expect(service.reorder('h1', 'p1', ids)).rejects.toMatchObject({
          statusCode: 400, message: 'photoIds must list every photo in this project exactly once',
        })
      }
      expect(db.projectPhoto.update).not.toHaveBeenCalled()
    })

    it('rewrites positions to the index, skipping rows already there, and returns the rows in order', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany
        .mockResolvedValueOnce([{ id: 'a', position: 0 }, { id: 'b', position: 4 }, { id: 'c', position: 2 }])
        .mockResolvedValueOnce([
          { id: 'a', position: 0, width: 1, height: 1, createdAt },
          { id: 'c', position: 1, width: 2, height: 1, createdAt },
          { id: 'b', position: 2, width: 3, height: 1, createdAt },
        ])
      const result = await service.reorder('h1', 'p1', ['a', 'c', 'b'])
      expect(db.projectPhoto.update.mock.calls).toEqual([
        [{ where: { id: 'c' }, data: { position: 1 } }],
        [{ where: { id: 'b' }, data: { position: 2 } }],
      ])
      expect(db.projectPhoto.findMany.mock.calls[1][0]).toEqual({
        where: { projectId: 'p1' },
        orderBy: { position: 'asc' },
        select: { id: true, position: true, width: true, height: true, createdAt: true },
      })
      expect(result.map((p) => p.id)).toEqual(['a', 'c', 'b'])
      expect(tx()).toHaveBeenCalledTimes(1)
    })

    it('allows an empty list for a project with no photos', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      db.projectPhoto.findMany.mockResolvedValue([])
      await expect(service.reorder('h1', 'p1', [])).resolves.toEqual([])
      expect(db.projectPhoto.update).not.toHaveBeenCalled()
    })

    it('turns a write conflict (P2034) into a 409 asking to retry', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      tx().mockRejectedValue(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      await expect(service.reorder('h1', 'p1', ['a'])).rejects.toMatchObject({
        statusCode: 409, message: 'Photos changed while reordering. Try again.',
      })
    })

    it('rethrows other transaction errors', async () => {
      db.project.findFirst.mockResolvedValue({ id: 'p1' })
      const down = new Error('db down')
      tx().mockRejectedValue(down)
      await expect(service.reorder('h1', 'p1', ['a'])).rejects.toBe(down)
    })
  })

  describe('read', () => {
    it('returns 404 for another household, another project, or a deleted project, without touching storage', async () => {
      db.projectPhoto.findFirst.mockResolvedValue(null)
      await expect(service.read('h1', 'p1', 'ph1', 'full')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectPhoto.findFirst.mock.calls[0][0].where).toEqual({
        id: 'ph1', projectId: 'p1', project: { householdId: 'h1', metaStatus: 'active' },
      })
      expect(blob.get).not.toHaveBeenCalled()
    })

    it('reads the pathname stored on the row for the requested variant', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.get.mockResolvedValue({ statusCode: 200, stream: null, etag: '"e"' })
      await service.read('h1', 'p1', 'ph1', 'thumb', '"e"')
      expect(blob.get).toHaveBeenCalledWith('T.jpg', '"e"')
      await service.read('h1', 'p1', 'ph1', 'full')
      expect(blob.get).toHaveBeenLastCalledWith('F.jpg', undefined)
    })

    it('returns 404 when the row exists but the blob is gone', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.get.mockResolvedValue(null)
      await expect(service.read('h1', 'p1', 'ph1', 'full')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns 502 when storage is unavailable', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.get.mockRejectedValue(new Error('blob down'))
      await expect(service.read('h1', 'p1', 'ph1', 'full')).rejects.toMatchObject({ statusCode: 502 })
    })
  })

  describe('remove', () => {
    it('returns 404 for another household and deletes nothing', async () => {
      db.projectPhoto.findFirst.mockResolvedValue(null)
      await expect(service.remove('h1', 'p1', 'ph1')).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectPhoto.delete).not.toHaveBeenCalled()
      expect(blob.remove).not.toHaveBeenCalled()
    })

    it('deletes the row and both blobs', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      await service.remove('h1', 'p1', 'ph1')
      expect(db.projectPhoto.delete).toHaveBeenCalledWith({ where: { id: 'ph1' } })
      expect(blob.remove).toHaveBeenCalledWith(['F.jpg', 'T.jpg'])
    })

    it('still succeeds when blob removal fails after the row is gone', async () => {
      db.projectPhoto.findFirst.mockResolvedValue({ id: 'ph1', fullPath: 'F.jpg', thumbPath: 'T.jpg' })
      blob.remove.mockRejectedValue(new Error('blob down'))
      await expect(service.remove('h1', 'p1', 'ph1')).resolves.toBeUndefined()
      expect(db.projectPhoto.delete).toHaveBeenCalled()
    })
  })
})
