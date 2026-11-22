import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const apiKeys = vi.hoisted(() => ({ authenticate: vi.fn(), requireOwnerInHousehold: vi.fn() }))
vi.mock('@/server/services/ApiKeyService', () => ({ ApiKeyService: vi.fn(() => apiKeys) }))
const ingest = vi.hoisted(() => ({ getDetail: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('@/server/services/ProjectIngestService', () => ({ ProjectIngestService: vi.fn(() => ingest) }))
vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { HttpError } from '@/server/utils/api-errors'
import getRoute from '@/server/api/ingest/projects/[id].get'
import patchRoute from '@/server/api/ingest/projects/[id].patch'
import deleteRoute from '@/server/api/ingest/projects/[id].delete'

type Handler = (event: unknown) => Promise<unknown>
const call = (handler: unknown, key: string | null = 'adk_good') =>
  (handler as Handler)({ node: { req: { headers: key ? { authorization: `Bearer ${key}` } : {} } }, context: { params: { id: 'p1' } } })

describe('ingest project routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiKeys.authenticate.mockImplementation(async (key: string) => (key === 'adk_good' ? { householdId: 'h1', apiKeyId: 'k1', userId: 'u1' } : null))
    vi.mocked(readBody).mockResolvedValue({})
  })

  it('every route refuses a missing or unknown key', async () => {
    for (const route of [getRoute, patchRoute, deleteRoute]) {
      await expect(call(route, null)).rejects.toMatchObject({ statusCode: 401 })
      await expect(call(route, 'adk_bad')).rejects.toMatchObject({ statusCode: 401 })
    }
    for (const fn of Object.values(ingest)) expect(fn).not.toHaveBeenCalled()
  })

  describe('GET', () => {
    it('returns the detail DTO itself', async () => {
      ingest.getDetail.mockResolvedValue({ id: 'p1', title: 'Shed' })
      expect(await call(getRoute)).toEqual({ id: 'p1', title: 'Shed' })
      expect(ingest.getDetail).toHaveBeenCalledWith('h1', 'p1')
    })

    it('passes 404 through', async () => {
      ingest.getDetail.mockRejectedValue(new HttpError('Project not found', 404))
      await expect(call(getRoute)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('PATCH', () => {
    it('passes the trimmed fields with household, user and id', async () => {
      vi.mocked(readBody).mockResolvedValue({ title: '  New title ', notesAppend: ' Called them ', status: 'active', path: 'diy' })
      ingest.update.mockResolvedValue({ id: 'p1' })
      expect(await call(patchRoute)).toEqual({ id: 'p1' })
      expect(ingest.update).toHaveBeenCalledWith('h1', 'u1', 'p1', { title: 'New title', notesAppend: 'Called them', status: 'active', path: 'diy' })
    })

    it('turns a blank location into null and accepts a null path', async () => {
      vi.mocked(readBody).mockResolvedValue({ location: '', path: null })
      ingest.update.mockResolvedValue({ id: 'p1' })
      await call(patchRoute)
      expect(ingest.update).toHaveBeenCalledWith('h1', 'u1', 'p1', { location: null, path: null })
    })

    it('rejects bad bodies with 400 without calling the service', async () => {
      const bodies = [
        {},
        undefined,
        { note: 'x' },
        { status: 'someday' },
        { path: 'contractor' },
        { title: 'x'.repeat(201) },
        { notes: 'x'.repeat(5001) },
        { notes: 'a', notesAppend: 'b' },
        { notesAppend: '  ' },
        { notesAppend: 'x'.repeat(5001) },
      ]
      for (const body of bodies) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(patchRoute), JSON.stringify(body)).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(ingest.update).not.toHaveBeenCalled()
    })

    it('names the unknown field and the reason in the 400 message', async () => {
      vi.mocked(readBody).mockResolvedValue({ note: 'x' })
      await expect(call(patchRoute)).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('note') })
      vi.mocked(readBody).mockResolvedValue({})
      await expect(call(patchRoute)).rejects.toMatchObject({ message: 'Nothing to update' })
      vi.mocked(readBody).mockResolvedValue({ notes: 'a', notesAppend: 'b' })
      await expect(call(patchRoute)).rejects.toMatchObject({ message: 'Send notes or notesAppend, not both' })
    })

    it('passes 403, 404, 409 and 400 from the service through', async () => {
      vi.mocked(readBody).mockResolvedValue({ title: 'x' })
      for (const status of [403, 404, 409, 400]) {
        ingest.update.mockRejectedValue(new HttpError('nope', status))
        await expect(call(patchRoute)).rejects.toMatchObject({ statusCode: status })
      }
    })
  })

  describe('DELETE', () => {
    it('returns success and passes household, user and id', async () => {
      ingest.remove.mockResolvedValue(undefined)
      expect(await call(deleteRoute)).toEqual({ success: true })
      expect(ingest.remove).toHaveBeenCalledWith('h1', 'u1', 'p1')
    })

    it('passes 404 and 403 through', async () => {
      ingest.remove.mockRejectedValue(new HttpError('Project not found', 404))
      await expect(call(deleteRoute)).rejects.toMatchObject({ statusCode: 404 })
      ingest.remove.mockRejectedValue(new HttpError('gone', 403))
      await expect(call(deleteRoute)).rejects.toMatchObject({ statusCode: 403 })
    })
  })
})
