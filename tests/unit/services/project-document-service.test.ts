import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    projectDocument: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('@/server/utils/blob-storage', () => ({
  headPrivate: vi.fn(),
  presignPrivateGet: vi.fn(),
  removeBlobs: vi.fn(),
}))

import prisma from '@/server/utils/prisma/client'
import { headPrivate, presignPrivateGet, removeBlobs } from '@/server/utils/blob-storage'
import { ProjectDocumentService } from '@/server/services/ProjectDocumentService'
import { documentBlobPath } from '@/utils/project-documents'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
const blob = {
  head: headPrivate as unknown as ReturnType<typeof vi.fn>,
  presign: presignPrivateGet as unknown as ReturnType<typeof vi.fn>,
  remove: removeBlobs as unknown as ReturnType<typeof vi.fn>,
}

const H = '11111111-1111-4111-8111-111111111111'
const P = '22222222-2222-4222-8222-222222222222'
const D = '33333333-3333-4333-8333-333333333333'
const OTHER = '44444444-4444-4444-8444-444444444444'
const PATH = documentBlobPath(H, P, D, 'Owens-quote.pdf')

const row = (overrides: Record<string, unknown> = {}) => ({
  id: D, projectId: P, blobPath: PATH, fileName: 'Owens-quote.pdf', name: 'Owens quote', note: null,
  contentType: 'application/pdf', sizeBytes: 2048, uploadedById: 'u1', createdAt: new Date('2026-11-12T12:00:00Z'),
  updatedAt: new Date('2026-11-12T12:00:00Z'), ...overrides,
})
const dto = (overrides: Record<string, unknown> = {}) => {
  const { id, name, note, fileName, contentType, sizeBytes, createdAt } = row(overrides)
  return { id, name, note, fileName, contentType, sizeBytes, createdAt }
}
const input = (overrides: Record<string, unknown> = {}) => ({ id: D, blobPath: PATH, name: '  Owens quote  ', note: '  ', ...overrides })

describe('ProjectDocumentService', () => {
  let service: ProjectDocumentService
  beforeEach(() => {
    service = new ProjectDocumentService()
    vi.clearAllMocks()
    db.project.findFirst.mockResolvedValue({ id: P })
    db.projectDocument.findFirst.mockResolvedValue(null)
    db.projectDocument.count.mockResolvedValue(0)
    db.projectDocument.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data))
    blob.head.mockResolvedValue({ size: 2048, contentType: 'application/pdf' })
    blob.remove.mockResolvedValue(undefined)
  })

  describe('authorizeUpload', () => {
    it('returns 404 for a missing or deleted project', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.authorizeUpload(H, P, PATH)).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: P, householdId: H, metaStatus: 'active' })
    })

    it('refuses a path for another household, another project, or off the shape', async () => {
      for (const path of [
        documentBlobPath(OTHER, P, D, 'a.pdf'),
        documentBlobPath(H, OTHER, D, 'a.pdf'),
        documentBlobPath(H, P, D, 'page.html'),
        documentBlobPath(H, P, 'not-a-uuid', 'a.pdf'),
        `${documentBlobPath(H, P, D, 'a.pdf')}/../b.pdf`,
      ]) {
        await expect(service.authorizeUpload(H, P, path)).rejects.toMatchObject({ statusCode: 400, message: 'Invalid document path' })
      }
    })

    it('refuses at the cap of 30', async () => {
      db.projectDocument.count.mockResolvedValue(30)
      await expect(service.authorizeUpload(H, P, PATH)).rejects.toMatchObject({ statusCode: 409, message: 'This project can hold 30 documents' })
    })

    it('refuses an id that already has a row', async () => {
      db.projectDocument.findFirst.mockResolvedValue({ id: D })
      await expect(service.authorizeUpload(H, P, PATH)).rejects.toMatchObject({ statusCode: 409, message: 'Document already exists' })
    })

    it('signs the type for the extension, 25 MB and 10 minutes', async () => {
      await expect(service.authorizeUpload(H, P, PATH)).resolves.toEqual({ contentType: 'application/pdf', maxBytes: 26214400, ttlMs: 600000 })
      await expect(service.authorizeUpload(H, P, documentBlobPath(H, P, D, 'Bid.xlsx'))).resolves.toMatchObject({
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    })
  })

  describe('register', () => {
    it('returns 404 for a missing project and touches nothing', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.register(H, P, 'u1', input())).rejects.toMatchObject({ statusCode: 404 })
      expect(blob.head).not.toHaveBeenCalled()
      expect(blob.remove).not.toHaveBeenCalled()
    })

    it('refuses a path that does not match the id, household or project', async () => {
      await expect(service.register(H, P, 'u1', input({ id: OTHER }))).rejects.toMatchObject({ statusCode: 400, message: 'Invalid document path' })
      await expect(service.register(H, P, 'u1', input({ blobPath: documentBlobPath(OTHER, P, D, 'a.pdf') }))).rejects.toMatchObject({ statusCode: 400 })
      expect(blob.head).not.toHaveBeenCalled()
      expect(blob.remove).not.toHaveBeenCalled()
    })

    it('returns the existing document for a repeated id and writes nothing', async () => {
      db.projectDocument.findFirst.mockResolvedValue(row())
      await expect(service.register(H, P, 'u1', input())).resolves.toEqual(dto())
      expect(db.projectDocument.findFirst.mock.calls[0][0].where).toEqual({ id: D, projectId: P })
      expect(blob.head).not.toHaveBeenCalled()
      expect(db.projectDocument.create).not.toHaveBeenCalled()
    })

    it('answers 400 when the upload is not in storage', async () => {
      blob.head.mockResolvedValue(null)
      await expect(service.register(H, P, 'u1', input())).rejects.toMatchObject({ statusCode: 400, message: 'Upload not found. Try again.' })
      expect(db.projectDocument.create).not.toHaveBeenCalled()
    })

    it('deletes the blob and refuses when the stored type does not match the extension', async () => {
      blob.head.mockResolvedValue({ size: 10, contentType: 'text/html' })
      await expect(service.register(H, P, 'u1', input())).rejects.toMatchObject({ statusCode: 400, message: 'Only PDF, Word, Excel, JPEG or PNG files' })
      expect(blob.remove).toHaveBeenCalledWith([PATH])
      expect(db.projectDocument.create).not.toHaveBeenCalled()
    })

    it('deletes the blob and refuses a file over 25 MB', async () => {
      blob.head.mockResolvedValue({ size: 25 * 1024 * 1024 + 1, contentType: 'application/pdf' })
      await expect(service.register(H, P, 'u1', input())).rejects.toMatchObject({ statusCode: 413, message: 'Over 25 MB' })
      expect(blob.remove).toHaveBeenCalledWith([PATH])
    })

    it('deletes the blob and refuses at the cap', async () => {
      db.projectDocument.count.mockResolvedValue(30)
      await expect(service.register(H, P, 'u1', input())).rejects.toMatchObject({ statusCode: 409, message: 'This project can hold 30 documents' })
      expect(blob.remove).toHaveBeenCalledWith([PATH])
      expect(db.projectDocument.create).not.toHaveBeenCalled()
    })

    it('saves the trimmed name, a null note and the stored size and type', async () => {
      db.projectDocument.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4)
      await expect(service.register(H, P, 'u1', input())).resolves.toEqual(dto({ name: 'Owens quote', note: null }))
      expect(db.projectDocument.create.mock.calls[0][0].data).toEqual({
        id: D, projectId: P, blobPath: PATH, fileName: 'Owens-quote.pdf', name: 'Owens quote', note: null,
        contentType: 'application/pdf', sizeBytes: 2048, uploadedById: 'u1',
      })
    })

    it('keeps a real note, trimmed', async () => {
      await service.register(H, P, 'u1', input({ note: '  Nov 2026  ' }))
      expect(db.projectDocument.create.mock.calls[0][0].data.note).toBe('Nov 2026')
    })

    it('undoes its own row and blob when a race took the project over 30', async () => {
      db.projectDocument.count.mockResolvedValueOnce(29).mockResolvedValueOnce(31)
      await expect(service.register(H, P, 'u1', input())).rejects.toMatchObject({ statusCode: 409, message: 'This project can hold 30 documents' })
      expect(db.projectDocument.delete).toHaveBeenCalledWith({ where: { id: D } })
      expect(blob.remove).toHaveBeenCalledWith([PATH])
    })
  })

  describe('link', () => {
    it('returns 404 for a document outside this household, project or a deleted project', async () => {
      await expect(service.link(H, P, D)).rejects.toMatchObject({ statusCode: 404, message: 'Document not found' })
      expect(db.projectDocument.findFirst.mock.calls[0][0].where).toEqual({
        id: D, projectId: P, project: { householdId: H, metaStatus: 'active' },
      })
      expect(blob.presign).not.toHaveBeenCalled()
    })

    it('presigns a 5-minute GET', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
      try {
        db.projectDocument.findFirst.mockResolvedValue(row())
        blob.presign.mockResolvedValue('https://store.private.blob.vercel-storage.com/x?sig')
        await expect(service.link(H, P, D)).resolves.toEqual({
          url: 'https://store.private.blob.vercel-storage.com/x?sig', expiresAt: '2026-11-12T12:05:00.000Z',
        })
        expect(blob.presign).toHaveBeenCalledWith(PATH, 300000)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('update', () => {
    it('returns 404 for an unknown document', async () => {
      await expect(service.update(H, P, D, { name: 'x' })).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectDocument.update).not.toHaveBeenCalled()
    })

    it('refuses a blank name', async () => {
      db.projectDocument.findFirst.mockResolvedValue(row())
      await expect(service.update(H, P, D, { name: '   ' })).rejects.toMatchObject({ statusCode: 400, message: "Name can't be blank" })
      expect(db.projectDocument.update).not.toHaveBeenCalled()
    })

    it('trims the name and turns a blank note into null', async () => {
      db.projectDocument.findFirst.mockResolvedValue(row())
      db.projectDocument.update.mockResolvedValue(row({ name: 'Owens final', note: null }))
      await expect(service.update(H, P, D, { name: '  Owens final ', note: '  ' })).resolves.toEqual(dto({ name: 'Owens final', note: null }))
      expect(db.projectDocument.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: D }, data: { name: 'Owens final', note: null },
      }))
    })

    it('leaves out fields that were not sent', async () => {
      db.projectDocument.findFirst.mockResolvedValue(row())
      db.projectDocument.update.mockResolvedValue(row({ note: 'Nov' }))
      await service.update(H, P, D, { note: 'Nov' })
      expect(db.projectDocument.update.mock.calls[0][0].data).toEqual({ note: 'Nov' })
    })
  })

  describe('remove', () => {
    it('returns 404 for an unknown document', async () => {
      await expect(service.remove(H, P, D)).rejects.toMatchObject({ statusCode: 404 })
      expect(db.projectDocument.delete).not.toHaveBeenCalled()
    })

    it('deletes the row, then the blob', async () => {
      db.projectDocument.findFirst.mockResolvedValue(row())
      await service.remove(H, P, D)
      expect(db.projectDocument.delete).toHaveBeenCalledWith({ where: { id: D } })
      expect(blob.remove).toHaveBeenCalledWith([PATH])
    })

    it('does not fail when the blob cannot be removed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      db.projectDocument.findFirst.mockResolvedValue(row())
      blob.remove.mockRejectedValue(new Error('storage down'))
      await expect(service.remove(H, P, D)).resolves.toBeUndefined()
    })
  })
})
