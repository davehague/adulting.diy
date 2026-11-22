import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const apiKeys = vi.hoisted(() => ({ authenticate: vi.fn(), requireOwnerInHousehold: vi.fn() }))
vi.mock('@/server/services/ApiKeyService', () => ({ ApiKeyService: vi.fn(() => apiKeys) }))
const ingest = vi.hoisted(() => ({
  listProjects: vi.fn(), documentUploadUrl: vi.fn(), registerDocument: vi.fn(), addPhoto: vi.fn(),
  updateDocument: vi.fn(), removeDocument: vi.fn(), removePhoto: vi.fn(), reorderPhotos: vi.fn(),
}))
vi.mock('@/server/services/ProjectFileIngestService', () => ({ ProjectFileIngestService: vi.fn(() => ingest) }))
vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
  readMultipartFormData: vi.fn(),
}))

import { readBody, readMultipartFormData } from 'h3'
import { HttpError } from '@/server/utils/api-errors'
import listRoute from '@/server/api/ingest/projects.get'
import uploadUrlRoute from '@/server/api/ingest/projects/[id]/documents/upload-url.post'
import registerRoute from '@/server/api/ingest/projects/[id]/documents.post'
import photoRoute from '@/server/api/ingest/projects/[id]/photos.post'
import documentPatchRoute from '@/server/api/ingest/projects/[id]/documents/[documentId].patch'
import documentDeleteRoute from '@/server/api/ingest/projects/[id]/documents/[documentId].delete'
import photoDeleteRoute from '@/server/api/ingest/projects/[id]/photos/[photoId].delete'
import photoOrderRoute from '@/server/api/ingest/projects/[id]/photos/order.put'

type Handler = (event: unknown) => Promise<unknown>
const D = '33333333-3333-4333-8333-333333333333'
const OWNER_GONE = new HttpError('The API key owner is no longer a member of this household', 403)
const call = (handler: unknown, key: string | null = 'adk_good', params: Record<string, string> = {}) =>
  (handler as Handler)({ node: { req: { headers: key ? { authorization: `Bearer ${key}` } : {} } }, context: { params: { id: 'p1', ...params } } })
const part = (name: string, data: string | Buffer) => ({ name, data: Buffer.isBuffer(data) ? data : Buffer.from(data) })

describe('ingest file routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiKeys.authenticate.mockImplementation(async (key: string) => (key === 'adk_good' ? { householdId: 'h1', apiKeyId: 'k1', userId: 'u1' } : null))
    vi.mocked(readBody).mockResolvedValue({})
  })

  const routes = [listRoute, uploadUrlRoute, registerRoute, photoRoute, documentPatchRoute, documentDeleteRoute, photoDeleteRoute, photoOrderRoute]

  it('every route refuses a missing or unknown key', async () => {
    for (const route of routes) {
      await expect(call(route, null)).rejects.toMatchObject({ statusCode: 401 })
      await expect(call(route, 'adk_bad')).rejects.toMatchObject({ statusCode: 401 })
    }
    for (const fn of Object.values(ingest)) expect(fn).not.toHaveBeenCalled()
  })

  it('lists the projects of the key household', async () => {
    ingest.listProjects.mockResolvedValue([{ id: 'p1' }])
    expect(await call(listRoute)).toEqual({ projects: [{ id: 'p1' }] })
    expect(ingest.listProjects).toHaveBeenCalledWith('h1')
  })

  describe('upload-url', () => {
    it('passes the file name', async () => {
      vi.mocked(readBody).mockResolvedValue({ fileName: 'Owens quote.pdf' })
      ingest.documentUploadUrl.mockResolvedValue({ documentId: D })
      expect(await call(uploadUrlRoute)).toEqual({ documentId: D })
      expect(ingest.documentUploadUrl).toHaveBeenCalledWith('h1', 'u1', 'p1', 'Owens quote.pdf')
    })

    it('rejects a missing, empty or 256-character file name', async () => {
      for (const body of [{}, { fileName: '' }, { fileName: `${'a'.repeat(252)}.pdf` }, undefined]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(uploadUrlRoute)).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(ingest.documentUploadUrl).not.toHaveBeenCalled()
    })

    it('passes a service refusal through', async () => {
      vi.mocked(readBody).mockResolvedValue({ fileName: 'a.pdf' })
      ingest.documentUploadUrl.mockRejectedValue(new HttpError('The API key owner is no longer a member of this household', 403))
      await expect(call(uploadUrlRoute)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('register', () => {
    it('passes the trimmed name and a null note', async () => {
      vi.mocked(readBody).mockResolvedValue({ documentId: D, name: ' Owens quote ' })
      ingest.registerDocument.mockResolvedValue({ id: D })
      expect(await call(registerRoute)).toEqual({ id: D })
      expect(ingest.registerDocument).toHaveBeenCalledWith('h1', 'u1', 'p1', { documentId: D, name: 'Owens quote', note: null })
    })

    it('rejects bad bodies without calling the service', async () => {
      for (const body of [{}, { documentId: D, name: '  ' }, { documentId: D, name: 'x'.repeat(121) }, { documentId: D, note: 'x'.repeat(201) }, undefined]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(registerRoute)).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(ingest.registerDocument).not.toHaveBeenCalled()
    })

    it('passes 404 and 409 through', async () => {
      vi.mocked(readBody).mockResolvedValue({ documentId: D })
      ingest.registerDocument.mockRejectedValue(new HttpError('Project not found', 404))
      await expect(call(registerRoute)).rejects.toMatchObject({ statusCode: 404 })
      ingest.registerDocument.mockRejectedValue(new HttpError('This project can hold 30 documents', 409))
      await expect(call(registerRoute)).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  describe('photos', () => {
    it('passes the parsed upload', async () => {
      vi.mocked(readMultipartFormData).mockResolvedValue([part('full', 'F'), part('thumb', 'T'), part('width', '2000'), part('height', '1500')])
      ingest.addPhoto.mockResolvedValue({ id: 'ph1' })
      expect(await call(photoRoute)).toEqual({ id: 'ph1' })
      expect(ingest.addPhoto).toHaveBeenCalledWith('h1', 'u1', 'p1', { full: Buffer.from('F'), thumb: Buffer.from('T'), width: 2000, height: 1500 }, undefined)
    })

    it('rejects a form without a thumbnail or with bad dimensions', async () => {
      vi.mocked(readMultipartFormData).mockResolvedValue([part('full', 'F'), part('width', '2000'), part('height', '1500')])
      await expect(call(photoRoute)).rejects.toMatchObject({ statusCode: 400, message: 'Both the photo and its thumbnail are required' })
      vi.mocked(readMultipartFormData).mockResolvedValue([part('full', 'F'), part('thumb', 'T'), part('width', 'wide')])
      await expect(call(photoRoute)).rejects.toMatchObject({ statusCode: 400, message: 'Photo width and height are required' })
      expect(ingest.addPhoto).not.toHaveBeenCalled()
    })

    it('passes the 25-photo cap through', async () => {
      vi.mocked(readMultipartFormData).mockResolvedValue([part('full', 'F'), part('thumb', 'T'), part('width', '2'), part('height', '1')])
      ingest.addPhoto.mockRejectedValue(new HttpError('This project already has 25 photos', 409))
      await expect(call(photoRoute)).rejects.toMatchObject({ statusCode: 409 })
    })

    it('passes a valid photoId lowercased', async () => {
      const id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'
      vi.mocked(readMultipartFormData).mockResolvedValue([part('full', 'F'), part('thumb', 'T'), part('width', '2000'), part('height', '1500'), part('photoId', id)])
      ingest.addPhoto.mockResolvedValue({ id: id.toLowerCase() })
      await call(photoRoute)
      expect(ingest.addPhoto).toHaveBeenCalledWith('h1', 'u1', 'p1', { full: Buffer.from('F'), thumb: Buffer.from('T'), width: 2000, height: 1500 }, id.toLowerCase())
    })

    it('rejects a photoId that is not a UUID', async () => {
      for (const bad of ['nope', '', `${D}/..`]) {
        vi.mocked(readMultipartFormData).mockResolvedValue([part('full', 'F'), part('thumb', 'T'), part('width', '2'), part('height', '1'), part('photoId', bad)])
        await expect(call(photoRoute)).rejects.toMatchObject({ statusCode: 400, message: 'photoId must be a UUID' })
      }
      expect(ingest.addPhoto).not.toHaveBeenCalled()
    })

    it('passes 404 and 409 through', async () => {
      vi.mocked(readMultipartFormData).mockResolvedValue([part('full', 'F'), part('thumb', 'T'), part('width', '2'), part('height', '1'), part('photoId', D)])
      ingest.addPhoto.mockRejectedValue(new HttpError('That photoId is already used', 409))
      await expect(call(photoRoute)).rejects.toMatchObject({ statusCode: 409 })
      ingest.addPhoto.mockRejectedValue(new HttpError('Project not found', 404))
      await expect(call(photoRoute)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('document patch', () => {
    const patch = () => call(documentPatchRoute, 'adk_good', { documentId: D })

    it('passes the trimmed fields and returns the document', async () => {
      vi.mocked(readBody).mockResolvedValue({ name: ' New name ', note: ' hi ' })
      ingest.updateDocument.mockResolvedValue({ id: D })
      expect(await patch()).toEqual({ id: D })
      expect(ingest.updateDocument).toHaveBeenCalledWith('h1', 'u1', 'p1', D, { name: 'New name', note: 'hi' })
    })

    it('passes a lone note, and a null or blank note clears it', async () => {
      ingest.updateDocument.mockResolvedValue({ id: D })
      vi.mocked(readBody).mockResolvedValue({ note: null })
      await patch()
      expect(ingest.updateDocument).toHaveBeenLastCalledWith('h1', 'u1', 'p1', D, { note: null })
      vi.mocked(readBody).mockResolvedValue({ note: '   ' })
      await patch()
      expect(ingest.updateDocument).toHaveBeenLastCalledWith('h1', 'u1', 'p1', D, { note: null })
    })

    it('answers Nothing to update for an empty body', async () => {
      vi.mocked(readBody).mockResolvedValue({})
      await expect(patch()).rejects.toMatchObject({ statusCode: 400, message: 'Nothing to update' })
    })

    it('rejects an unknown key, a null, blank or long name, a long note and a missing body', async () => {
      for (const body of [{ name: 'x', extra: 1 }, { name: null }, { name: '  ' }, { name: 'x'.repeat(121) }, { note: 'x'.repeat(201) }, undefined]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(patch()).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(ingest.updateDocument).not.toHaveBeenCalled()
    })

    it('passes 403 and 404 through', async () => {
      vi.mocked(readBody).mockResolvedValue({ name: 'x' })
      ingest.updateDocument.mockRejectedValue(OWNER_GONE)
      await expect(patch()).rejects.toMatchObject({ statusCode: 403 })
      ingest.updateDocument.mockRejectedValue(new HttpError('Document not found', 404))
      await expect(patch()).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('document delete', () => {
    it('removes the document and answers success', async () => {
      ingest.removeDocument.mockResolvedValue(undefined)
      expect(await call(documentDeleteRoute, 'adk_good', { documentId: D })).toEqual({ success: true })
      expect(ingest.removeDocument).toHaveBeenCalledWith('h1', 'u1', 'p1', D)
    })

    it('passes 403 and 404 through', async () => {
      ingest.removeDocument.mockRejectedValue(OWNER_GONE)
      await expect(call(documentDeleteRoute, 'adk_good', { documentId: D })).rejects.toMatchObject({ statusCode: 403 })
      ingest.removeDocument.mockRejectedValue(new HttpError('Document not found', 404))
      await expect(call(documentDeleteRoute, 'adk_good', { documentId: D })).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('photo delete', () => {
    it('removes the photo and answers success', async () => {
      ingest.removePhoto.mockResolvedValue(undefined)
      expect(await call(photoDeleteRoute, 'adk_good', { photoId: 'ph1' })).toEqual({ success: true })
      expect(ingest.removePhoto).toHaveBeenCalledWith('h1', 'u1', 'p1', 'ph1')
    })

    it('passes 403 and 404 through', async () => {
      ingest.removePhoto.mockRejectedValue(OWNER_GONE)
      await expect(call(photoDeleteRoute, 'adk_good', { photoId: 'ph1' })).rejects.toMatchObject({ statusCode: 403 })
      ingest.removePhoto.mockRejectedValue(new HttpError('Photo not found', 404))
      await expect(call(photoDeleteRoute, 'adk_good', { photoId: 'ph1' })).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('photo order', () => {
    const order = () => call(photoOrderRoute)

    it('passes the ids and wraps the result in photos', async () => {
      vi.mocked(readBody).mockResolvedValue({ photoIds: ['b', 'a'] })
      ingest.reorderPhotos.mockResolvedValue([{ id: 'b' }, { id: 'a' }])
      expect(await order()).toEqual({ photos: [{ id: 'b' }, { id: 'a' }] })
      expect(ingest.reorderPhotos).toHaveBeenCalledWith('h1', 'u1', 'p1', ['b', 'a'])
    })

    it('accepts an empty list and exactly 25 ids', async () => {
      ingest.reorderPhotos.mockResolvedValue([])
      vi.mocked(readBody).mockResolvedValue({ photoIds: [] })
      await order()
      const ids = Array.from({ length: 25 }, (_, i) => `id${i}`)
      vi.mocked(readBody).mockResolvedValue({ photoIds: ids })
      await order()
      expect(ingest.reorderPhotos).toHaveBeenLastCalledWith('h1', 'u1', 'p1', ids)
    })

    it('rejects a missing body, duplicates, more than 25 ids, an unknown key and a bad shape', async () => {
      const tooMany = Array.from({ length: 26 }, (_, i) => `id${i}`)
      for (const body of [undefined, {}, { photoIds: ['a', 'a'] }, { photoIds: tooMany }, { photoIds: ['a'], extra: 1 }, { photoIds: 'a' }, { photoIds: [1] }]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(order()).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(ingest.reorderPhotos).not.toHaveBeenCalled()
    })

    it('passes 400, 403, 404 and 409 through', async () => {
      vi.mocked(readBody).mockResolvedValue({ photoIds: ['a'] })
      for (const status of [400, 403, 404, 409]) {
        ingest.reorderPhotos.mockRejectedValue(new HttpError('nope', status))
        await expect(order()).rejects.toMatchObject({ statusCode: status })
      }
    })
  })
})
