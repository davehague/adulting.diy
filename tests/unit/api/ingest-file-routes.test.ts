import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const apiKeys = vi.hoisted(() => ({ authenticate: vi.fn(), requireOwnerInHousehold: vi.fn() }))
vi.mock('@/server/services/ApiKeyService', () => ({ ApiKeyService: vi.fn(() => apiKeys) }))
const ingest = vi.hoisted(() => ({ listProjects: vi.fn(), documentUploadUrl: vi.fn(), registerDocument: vi.fn(), addPhoto: vi.fn() }))
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

type Handler = (event: unknown) => Promise<unknown>
const D = '33333333-3333-4333-8333-333333333333'
const call = (handler: unknown, key: string | null = 'adk_good') =>
  (handler as Handler)({ node: { req: { headers: key ? { authorization: `Bearer ${key}` } : {} } }, context: { params: { id: 'p1' } } })
const part = (name: string, data: string | Buffer) => ({ name, data: Buffer.isBuffer(data) ? data : Buffer.from(data) })

describe('ingest file routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiKeys.authenticate.mockImplementation(async (key: string) => (key === 'adk_good' ? { householdId: 'h1', apiKeyId: 'k1', userId: 'u1' } : null))
    vi.mocked(readBody).mockResolvedValue({})
  })

  const routes = [listRoute, uploadUrlRoute, registerRoute, photoRoute]

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
      expect(ingest.addPhoto).toHaveBeenCalledWith('h1', 'u1', 'p1', { full: Buffer.from('F'), thumb: Buffer.from('T'), width: 2000, height: 1500 })
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
  })
})
