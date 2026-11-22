import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: { project: { findMany: vi.fn(), findFirst: vi.fn() }, projectPhoto: { findUnique: vi.fn() } },
}))
const apiKeys = vi.hoisted(() => ({ requireOwnerInHousehold: vi.fn() }))
vi.mock('@/server/services/ApiKeyService', () => ({ ApiKeyService: vi.fn(() => apiKeys) }))
const documents = vi.hoisted(() => ({ authorizeUpload: vi.fn(), register: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('@/server/services/ProjectDocumentService', () => ({ ProjectDocumentService: vi.fn(() => documents) }))
const photos = vi.hoisted(() => ({ insert: vi.fn(), remove: vi.fn(), reorder: vi.fn() }))
vi.mock('@/server/services/ProjectPhotoService', () => ({ ProjectPhotoService: vi.fn(() => photos) }))
const blob = vi.hoisted(() => ({ presignPrivatePut: vi.fn(), findPrivateBlob: vi.fn() }))
vi.mock('@/server/utils/blob-storage', () => blob)

import prisma from '@/server/utils/prisma/client'
import { HttpError } from '@/server/utils/api-errors'
import { ProjectFileIngestService } from '@/server/services/ProjectFileIngestService'
import { parseDocumentBlobPath } from '@/utils/project-documents'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
const H = '11111111-1111-4111-8111-111111111111'
const P = '22222222-2222-4222-8222-222222222222'
const D = '33333333-3333-4333-8333-333333333333'
const grant = { contentType: 'application/pdf', maxBytes: 26214400, ttlMs: 600000 }
const OWNER_GONE = new HttpError('The API key owner is no longer a member of this household', 403)

describe('ProjectFileIngestService', () => {
  let service: ProjectFileIngestService
  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProjectFileIngestService()
    apiKeys.requireOwnerInHousehold.mockResolvedValue(undefined)
    db.project.findFirst.mockResolvedValue({ id: P })
    documents.authorizeUpload.mockResolvedValue(grant)
    blob.presignPrivatePut.mockResolvedValue({ url: 'https://vercel.com/api/blob/?sig', headers: { 'x-api-version': '12' }, expiresAt: '2026-11-12T12:10:00.000Z' })
  })

  it('listProjects lists non-deleted projects newest first, without the owner check', async () => {
    db.project.findMany.mockResolvedValue([{ id: P }])
    await expect(service.listProjects(H)).resolves.toEqual([{ id: P }])
    expect(db.project.findMany).toHaveBeenCalledWith({
      where: { householdId: H, metaStatus: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, location: true, status: true, path: true, createdAt: true },
    })
    expect(apiKeys.requireOwnerInHousehold).not.toHaveBeenCalled()
  })

  describe('documentUploadUrl', () => {
    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.documentUploadUrl(H, 'u1', P, 'a.pdf')).rejects.toMatchObject({ statusCode: 403 })
      expect(apiKeys.requireOwnerInHousehold).toHaveBeenCalledWith(H, 'u1')
      expect(documents.authorizeUpload).not.toHaveBeenCalled()
      expect(blob.presignPrivatePut).not.toHaveBeenCalled()
    })

    it('refuses a type that is not allowed before any storage call', async () => {
      for (const name of ['quote.html', 'noext']) {
        await expect(service.documentUploadUrl(H, 'u1', P, name)).rejects.toMatchObject({ statusCode: 400, message: 'Only PDF, Word, Excel, JPEG or PNG files' })
      }
      expect(documents.authorizeUpload).not.toHaveBeenCalled()
      expect(blob.presignPrivatePut).not.toHaveBeenCalled()
    })

    it('builds a safe path inside this project and returns the upload instructions', async () => {
      const result = await service.documentUploadUrl(H, 'u1', P, '../../Owens quote.PDF')
      const path = documents.authorizeUpload.mock.calls[0][2]
      expect(documents.authorizeUpload.mock.calls[0].slice(0, 2)).toEqual([H, P])
      const parsed = parseDocumentBlobPath(path)
      expect(parsed).toMatchObject({ householdId: H, projectId: P, fileName: 'Owens-quote.pdf' })
      expect(blob.presignPrivatePut).toHaveBeenCalledWith(path, grant)
      expect(result).toEqual({
        documentId: parsed!.documentId,
        fileName: 'Owens-quote.pdf',
        uploadUrl: 'https://vercel.com/api/blob/?sig',
        method: 'PUT',
        headers: { 'x-api-version': '12' },
        maxBytes: 26214400,
        expiresAt: '2026-11-12T12:10:00.000Z',
      })
    })

    it('passes a refusal from the document rules through and makes no URL', async () => {
      documents.authorizeUpload.mockRejectedValue(new HttpError('This project can hold 30 documents', 409))
      await expect(service.documentUploadUrl(H, 'u1', P, 'a.pdf')).rejects.toMatchObject({ statusCode: 409 })
      expect(blob.presignPrivatePut).not.toHaveBeenCalled()
    })
  })

  describe('registerDocument', () => {
    const prefix = `households/${H}/projects/${P}/documents/${D}/`

    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.registerDocument(H, 'u1', P, { documentId: D })).rejects.toMatchObject({ statusCode: 403 })
      expect(blob.findPrivateBlob).not.toHaveBeenCalled()
    })

    it('refuses a malformed id before any lookup', async () => {
      for (const documentId of ['NOT-A-UUID', D.toUpperCase().replace(/3/g, 'A'), `${D}/..`]) {
        await expect(service.registerDocument(H, 'u1', P, { documentId })).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(db.project.findFirst).not.toHaveBeenCalled()
      expect(blob.findPrivateBlob).not.toHaveBeenCalled()
    })

    it('answers 404 for a missing or deleted project before looking for the file', async () => {
      db.project.findFirst.mockResolvedValue(null)
      await expect(service.registerDocument(H, 'u1', P, { documentId: D })).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: P, householdId: H, metaStatus: 'active' })
      expect(blob.findPrivateBlob).not.toHaveBeenCalled()
    })

    it('answers Upload not found when the file is not in this project', async () => {
      blob.findPrivateBlob.mockResolvedValue(null)
      await expect(service.registerDocument(H, 'u1', P, { documentId: D })).rejects.toMatchObject({ statusCode: 400, message: 'Upload not found. Try again.' })
      expect(blob.findPrivateBlob).toHaveBeenCalledWith(prefix)
      expect(documents.register).not.toHaveBeenCalled()
    })

    it('registers the found file, naming it from the stored file when no name is given', async () => {
      blob.findPrivateBlob.mockResolvedValue(`${prefix}Owens-quote.pdf`)
      documents.register.mockResolvedValue({ id: D })
      await expect(service.registerDocument(H, 'u1', P, { documentId: D })).resolves.toEqual({ id: D })
      expect(documents.register).toHaveBeenCalledWith(H, P, 'u1', { id: D, blobPath: `${prefix}Owens-quote.pdf`, name: 'Owens quote', note: null })
    })

    it('uses a given name and note', async () => {
      blob.findPrivateBlob.mockResolvedValue(`${prefix}Owens-quote.pdf`)
      await service.registerDocument(H, 'u1', P, { documentId: D, name: 'Owens final quote', note: 'Nov 2026' })
      expect(documents.register.mock.calls[0][3]).toMatchObject({ name: 'Owens final quote', note: 'Nov 2026' })
    })
  })

  describe('updateDocument', () => {
    const row = { id: D, name: 'N', note: null, fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 5, createdAt: new Date('2026-11-01'), blobPath: 'secret', uploadedById: 'u9' }

    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.updateDocument(H, 'u1', P, D, { name: 'x' })).rejects.toMatchObject({ statusCode: 403 })
      expect(documents.update).not.toHaveBeenCalled()
    })

    it('updates through the document rules and maps to the ingest shape', async () => {
      documents.update.mockResolvedValue(row)
      await expect(service.updateDocument(H, 'u1', P, D, { note: null })).resolves.toEqual({
        id: D, name: 'N', note: null, fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 5, createdAt: row.createdAt,
      })
      expect(documents.update).toHaveBeenCalledWith(H, P, D, { note: null })
    })
  })

  describe('removeDocument', () => {
    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.removeDocument(H, 'u1', P, D)).rejects.toMatchObject({ statusCode: 403 })
      expect(documents.remove).not.toHaveBeenCalled()
    })

    it('delegates to the document rules', async () => {
      documents.remove.mockResolvedValue(undefined)
      await expect(service.removeDocument(H, 'u1', P, D)).resolves.toBeUndefined()
      expect(documents.remove).toHaveBeenCalledWith(H, P, D)
    })

    it('passes a 404 through', async () => {
      documents.remove.mockRejectedValue(new HttpError('Document not found', 404))
      await expect(service.removeDocument(H, 'u1', P, D)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('removePhoto', () => {
    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.removePhoto(H, 'u1', P, 'ph1')).rejects.toMatchObject({ statusCode: 403 })
      expect(photos.remove).not.toHaveBeenCalled()
    })

    it('delegates to the photo rules', async () => {
      photos.remove.mockResolvedValue(undefined)
      await expect(service.removePhoto(H, 'u1', P, 'ph1')).resolves.toBeUndefined()
      expect(photos.remove).toHaveBeenCalledWith(H, P, 'ph1')
    })

    it('lowercases the id, since photo ids are stored lowercase', async () => {
      photos.remove.mockResolvedValue(undefined)
      await service.removePhoto(H, 'u1', P, 'AB12CD34-0000-4000-8000-0000000000EF')
      expect(photos.remove).toHaveBeenCalledWith(H, P, 'ab12cd34-0000-4000-8000-0000000000ef')
    })
  })

  describe('reorderPhotos', () => {
    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.reorderPhotos(H, 'u1', P, ['a'])).rejects.toMatchObject({ statusCode: 403 })
      expect(photos.reorder).not.toHaveBeenCalled()
    })

    it('reorders through the photo rules and returns the rows in the ingest shape', async () => {
      const createdAt = new Date('2026-11-01')
      photos.reorder.mockResolvedValue([{ id: 'b', position: 0, width: 2, height: 1, createdAt }, { id: 'a', position: 1, width: 3, height: 1, createdAt }])
      await expect(service.reorderPhotos(H, 'u1', P, ['b', 'a'])).resolves.toEqual([
        { id: 'b', position: 0, width: 2, height: 1, createdAt },
        { id: 'a', position: 1, width: 3, height: 1, createdAt },
      ])
      expect(photos.reorder).toHaveBeenCalledWith(H, P, ['b', 'a'])
    })

    it('lowercases the ids', async () => {
      photos.reorder.mockResolvedValue([])
      await service.reorderPhotos(H, 'u1', P, ['B', 'a'])
      expect(photos.reorder).toHaveBeenCalledWith(H, P, ['b', 'a'])
    })
  })

  describe('addPhoto', () => {
    const upload = { full: Buffer.from('f'), thumb: Buffer.from('t'), width: 2000, height: 1500 }
    const PH = '44444444-4444-4444-8444-444444444444'
    const createdAt = new Date('2026-11-02')
    const inserted = { id: 'ph1', width: 2000, height: 1500, position: 0, createdAt }
    const found = (over: Record<string, unknown> = {}) => ({
      id: PH, position: 2, width: 800, height: 600, createdAt, projectId: P, project: { householdId: H, metaStatus: 'active' }, ...over,
    })
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).rejects.toMatchObject({ statusCode: 403 })
      expect(db.projectPhoto.findUnique).not.toHaveBeenCalled()
      expect(photos.insert).not.toHaveBeenCalled()
    })

    it('without a photoId looks nothing up and inserts without an id', async () => {
      photos.insert.mockResolvedValue(inserted)
      await expect(service.addPhoto(H, 'u1', P, upload)).resolves.toEqual({ id: 'ph1', position: 0, width: 2000, height: 1500, createdAt })
      expect(db.projectPhoto.findUnique).not.toHaveBeenCalled()
      expect(photos.insert).toHaveBeenCalledWith(H, P, 'u1', upload, {})
    })

    it('with a fresh photoId looks it up, then inserts with that id', async () => {
      db.projectPhoto.findUnique.mockResolvedValue(null)
      photos.insert.mockResolvedValue({ ...inserted, id: PH })
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).resolves.toMatchObject({ id: PH, createdAt })
      expect(db.projectPhoto.findUnique).toHaveBeenCalledWith({
        where: { id: PH },
        select: { id: true, position: true, width: true, height: true, createdAt: true, projectId: true, project: { select: { householdId: true, metaStatus: true } } },
      })
      expect(photos.insert).toHaveBeenCalledWith(H, P, 'u1', upload, { id: PH })
    })

    it('returns the existing photo for a repeated photoId and stores nothing', async () => {
      db.projectPhoto.findUnique.mockResolvedValue(found())
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).resolves.toEqual({ id: PH, position: 2, width: 800, height: 600, createdAt })
      expect(photos.insert).not.toHaveBeenCalled()
    })

    it('answers 409 when the photoId belongs to another project', async () => {
      db.projectPhoto.findUnique.mockResolvedValue(found({ projectId: 'other' }))
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).rejects.toMatchObject({ statusCode: 409, message: 'That photoId is already used' })
      expect(photos.insert).not.toHaveBeenCalled()
    })

    it('answers 404 when the photoId is on this project id but the project is deleted or in another household', async () => {
      for (const project of [{ householdId: H, metaStatus: 'deleted' }, { householdId: 'other', metaStatus: 'active' }]) {
        db.projectPhoto.findUnique.mockResolvedValue(found({ project }))
        await expect(service.addPhoto(H, 'u1', P, upload, PH)).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
      }
      expect(photos.insert).not.toHaveBeenCalled()
    })

    it('after losing a create race (P2002) returns the winner', async () => {
      db.projectPhoto.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(found())
      photos.insert.mockRejectedValue(p2002)
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).resolves.toMatchObject({ id: PH, position: 2 })
      expect(db.projectPhoto.findUnique).toHaveBeenCalledTimes(2)
    })

    it('after a P2002 answers 409 when the winner is on another project', async () => {
      db.projectPhoto.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(found({ projectId: 'other' }))
      photos.insert.mockRejectedValue(p2002)
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).rejects.toMatchObject({ statusCode: 409 })
    })

    it('after a P2002 answers 404 when the winner sits in a deleted project', async () => {
      db.projectPhoto.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(found({ project: { householdId: H, metaStatus: 'deleted' } }))
      photos.insert.mockRejectedValue(p2002)
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).rejects.toMatchObject({ statusCode: 404 })
    })

    it('answers 409 to retry when a P2002 leaves nothing to find (the winner was undone)', async () => {
      db.projectPhoto.findUnique.mockResolvedValue(null)
      photos.insert.mockRejectedValue(p2002)
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).rejects.toMatchObject({
        statusCode: 409, message: 'Another upload with this photoId was in progress. Try again.',
      })
    })

    it('rethrows other insert errors without a second lookup', async () => {
      db.projectPhoto.findUnique.mockResolvedValue(null)
      const down = new Error('db down')
      photos.insert.mockRejectedValue(down)
      await expect(service.addPhoto(H, 'u1', P, upload, PH)).rejects.toBe(down)
      expect(db.projectPhoto.findUnique).toHaveBeenCalledTimes(1)
    })

    it('passes the cap refusal through', async () => {
      photos.insert.mockRejectedValue(new HttpError('This project already has 25 photos', 409))
      await expect(service.addPhoto(H, 'u1', P, upload)).rejects.toMatchObject({ statusCode: 409 })
    })
  })
})
