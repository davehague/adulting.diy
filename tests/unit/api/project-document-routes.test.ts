import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const documentService = vi.hoisted(() => ({
  authorizeUpload: vi.fn(), register: vi.fn(), link: vi.fn(), update: vi.fn(), remove: vi.fn(),
}))
const blobStorage = vi.hoisted(() => ({ handlePresignedUpload: vi.fn() }))

vi.mock('@/server/services/ProjectDocumentService', () => ({
  ProjectDocumentService: vi.fn(() => documentService),
}))
vi.mock('@/server/utils/blob-storage', () => blobStorage)

// Sign in through the dev bypass so the real auth wrapper runs.
vi.mock('@/server/utils/dev-auth', () => ({
  devAuthService: { isDevBypassEnabled: () => true, getUserById: vi.fn() },
}))

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { devAuthService } from '@/server/utils/dev-auth'
import { HttpError } from '@/server/utils/api-errors'
import uploadRoute from '@/server/api/projects/[id]/documents/upload.post'
import registerRoute from '@/server/api/projects/[id]/documents.post'
import updateRoute from '@/server/api/projects/[id]/documents/[documentId].patch'
import deleteRoute from '@/server/api/projects/[id]/documents/[documentId].delete'
import linkRoute from '@/server/api/projects/[id]/documents/[documentId]/link.post'

type Handler = (event: unknown) => Promise<unknown>

const D = '33333333-3333-4333-8333-333333333333'
const req = (userId: string | null) => ({ headers: userId ? { 'x-dev-user-id': userId } : {} })
const call = (handler: unknown, userId: string | null, params: Record<string, string> = { id: 'p1', documentId: D }) =>
  (handler as Handler)({ node: { req: req(userId) }, context: { params } })

const doc = { id: D, name: 'Owens quote', note: null, fileName: 'Owens-quote.pdf', contentType: 'application/pdf', sizeBytes: 10, createdAt: '2026-11-12' }
const grant = { contentType: 'application/pdf', maxBytes: 26214400, ttlMs: 600000 }
const presignBody = { type: 'blob.generate-presigned-url', payload: { pathname: 'households/h1/x.pdf', clientPayload: null, multipart: false } }

describe('project document routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(devAuthService.getUserById).mockImplementation((async (id: string) => {
      if (id === 'u1') return { id: 'u1', name: 'u1', email: 'u1@example.com', householdId: 'h1' }
      if (id === 'loner') return { id: 'loner', name: 'loner', email: 'loner@example.com', householdId: null }
      return null
    }) as never)
    vi.mocked(readBody).mockResolvedValue({})
    documentService.authorizeUpload.mockResolvedValue(grant)
    documentService.register.mockResolvedValue(doc)
    documentService.update.mockResolvedValue(doc)
    documentService.link.mockResolvedValue({ url: 'https://blob/x', expiresAt: '2026-11-12T12:05:00.000Z' })
    documentService.remove.mockResolvedValue(undefined)
    blobStorage.handlePresignedUpload.mockImplementation(async (body: { payload: { pathname: string } }, _req: unknown, sign: (p: string) => Promise<unknown>) => {
      await sign(body.payload.pathname)
      return { type: 'blob.generate-presigned-url', presignedUrlPayload: { signature: 's' } }
    })
  })

  const routes = [uploadRoute, registerRoute, updateRoute, deleteRoute, linkRoute]

  it('every route refuses a caller who is not signed in', async () => {
    for (const route of routes) await expect(call(route, null)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('every route refuses a caller with no household, before touching the service', async () => {
    vi.mocked(readBody).mockResolvedValue({ ...presignBody, id: D, blobPath: 'x', name: 'n', note: 'n' })
    for (const route of routes) await expect(call(route, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    for (const fn of Object.values(documentService)) expect(fn).not.toHaveBeenCalled()
    expect(blobStorage.handlePresignedUpload).not.toHaveBeenCalled()
  })

  describe('upload', () => {
    it('authorises the pathname the browser sent and answers the SDK reply', async () => {
      vi.mocked(readBody).mockResolvedValue(presignBody)
      expect(await call(uploadRoute, 'u1')).toEqual({ type: 'blob.generate-presigned-url', presignedUrlPayload: { signature: 's' } })
      expect(documentService.authorizeUpload).toHaveBeenCalledWith('h1', 'p1', 'households/h1/x.pdf')
      expect(blobStorage.handlePresignedUpload.mock.calls[0][0]).toEqual(presignBody)
    })

    it('passes a refusal from the service through with its status', async () => {
      vi.mocked(readBody).mockResolvedValue(presignBody)
      documentService.authorizeUpload.mockRejectedValue(new HttpError('This project can hold 30 documents', 409))
      await expect(call(uploadRoute, 'u1')).rejects.toMatchObject({ statusCode: 409, message: 'This project can hold 30 documents' })
    })

    it('refuses an upload-completed callback body', async () => {
      vi.mocked(readBody).mockResolvedValue({ type: 'blob.upload-completed', payload: {} })
      blobStorage.handlePresignedUpload.mockRejectedValue(new HttpError('Unsupported upload request', 400))
      await expect(call(uploadRoute, 'u1')).rejects.toMatchObject({ statusCode: 400 })
      expect(documentService.authorizeUpload).not.toHaveBeenCalled()
    })
  })

  describe('register', () => {
    const body = { id: D, blobPath: 'households/h1/x.pdf', name: '  Owens quote ', note: null }

    it('registers with the parsed body and the caller', async () => {
      vi.mocked(readBody).mockResolvedValue(body)
      expect(await call(registerRoute, 'u1', { id: 'p1' })).toEqual(doc)
      expect(documentService.register).toHaveBeenCalledWith('h1', 'p1', 'u1', { id: D, blobPath: 'households/h1/x.pdf', name: 'Owens quote', note: null })
    })

    it('treats a missing note as null', async () => {
      vi.mocked(readBody).mockResolvedValue({ id: D, blobPath: 'x', name: 'n' })
      await call(registerRoute, 'u1', { id: 'p1' })
      expect(documentService.register.mock.calls[0][3].note).toBeNull()
    })

    it('rejects bad bodies without calling the service', async () => {
      for (const bad of [
        { ...body, id: 'not-a-uuid' },
        { ...body, name: '   ' },
        { ...body, name: 'x'.repeat(121) },
        { ...body, note: 'x'.repeat(201) },
        { ...body, blobPath: '' },
        undefined,
      ]) {
        vi.mocked(readBody).mockResolvedValue(bad)
        await expect(call(registerRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(documentService.register).not.toHaveBeenCalled()
    })

    it('passes a 400 from the service through', async () => {
      vi.mocked(readBody).mockResolvedValue(body)
      documentService.register.mockRejectedValue(new HttpError('Upload not found. Try again.', 400))
      await expect(call(registerRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 400, message: 'Upload not found. Try again.' })
    })
  })

  describe('update', () => {
    it('updates the name and note', async () => {
      vi.mocked(readBody).mockResolvedValue({ name: ' New ', note: 'Nov' })
      expect(await call(updateRoute, 'u1')).toEqual(doc)
      expect(documentService.update).toHaveBeenCalledWith('h1', 'p1', D, { name: 'New', note: 'Nov' })
    })

    it('rejects an empty body, a blank name and an overlong note', async () => {
      for (const bad of [{}, { name: '  ' }, { note: 'x'.repeat(201) }]) {
        vi.mocked(readBody).mockResolvedValue(bad)
        await expect(call(updateRoute, 'u1')).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(documentService.update).not.toHaveBeenCalled()
    })
  })

  it('delete removes the document', async () => {
    expect(await call(deleteRoute, 'u1')).toEqual({ success: true })
    expect(documentService.remove).toHaveBeenCalledWith('h1', 'p1', D)
  })

  it('link returns the signed URL', async () => {
    expect(await call(linkRoute, 'u1')).toEqual({ url: 'https://blob/x', expiresAt: '2026-11-12T12:05:00.000Z' })
    expect(documentService.link).toHaveBeenCalledWith('h1', 'p1', D)
  })

  it('link passes a 404 through', async () => {
    documentService.link.mockRejectedValue(new HttpError('Document not found', 404))
    await expect(call(linkRoute, 'u1')).rejects.toMatchObject({ statusCode: 404, message: 'Document not found' })
  })
})
