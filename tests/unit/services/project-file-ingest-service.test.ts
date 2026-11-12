import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: { project: { findMany: vi.fn(), findFirst: vi.fn() } },
}))
const apiKeys = vi.hoisted(() => ({ requireOwnerInHousehold: vi.fn() }))
vi.mock('@/server/services/ApiKeyService', () => ({ ApiKeyService: vi.fn(() => apiKeys) }))
const documents = vi.hoisted(() => ({ authorizeUpload: vi.fn(), register: vi.fn() }))
vi.mock('@/server/services/ProjectDocumentService', () => ({ ProjectDocumentService: vi.fn(() => documents) }))
const photos = vi.hoisted(() => ({ add: vi.fn() }))
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

  describe('addPhoto', () => {
    const upload = { full: Buffer.from('f'), thumb: Buffer.from('t'), width: 2000, height: 1500 }

    it('checks the owner first', async () => {
      apiKeys.requireOwnerInHousehold.mockRejectedValue(OWNER_GONE)
      await expect(service.addPhoto(H, 'u1', P, upload)).rejects.toMatchObject({ statusCode: 403 })
      expect(photos.add).not.toHaveBeenCalled()
    })

    it('adds through the photo rules', async () => {
      photos.add.mockResolvedValue({ id: 'ph1', width: 2000, height: 1500, position: 0 })
      await expect(service.addPhoto(H, 'u1', P, upload)).resolves.toEqual({ id: 'ph1', width: 2000, height: 1500, position: 0 })
      expect(photos.add).toHaveBeenCalledWith(H, P, 'u1', upload)
    })
  })
})
