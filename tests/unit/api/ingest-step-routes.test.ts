import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const apiKeys = vi.hoisted(() => ({ authenticate: vi.fn(), requireOwnerInHousehold: vi.fn() }))
vi.mock('@/server/services/ApiKeyService', () => ({ ApiKeyService: vi.fn(() => apiKeys) }))
const steps = vi.hoisted(() => ({ addBatch: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('@/server/services/ProjectStepIngestService', () => ({ ProjectStepIngestService: vi.fn(() => steps) }))
vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { HttpError } from '@/server/utils/api-errors'
import postRoute from '@/server/api/ingest/projects/[id]/steps.post'
import patchRoute from '@/server/api/ingest/projects/[id]/steps/[stepId].patch'
import deleteRoute from '@/server/api/ingest/projects/[id]/steps/[stepId].delete'

type Handler = (event: unknown) => Promise<unknown>
const call = (handler: unknown, key: string | null = 'adk_good') =>
  (handler as Handler)({
    node: { req: { headers: key ? { authorization: `Bearer ${key}` } : {} } },
    context: { params: { id: 'p1', stepId: 's1' } },
  })

describe('ingest step routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiKeys.authenticate.mockImplementation(async (key: string) => (key === 'adk_good' ? { householdId: 'h1', apiKeyId: 'k1', userId: 'u1' } : null))
    vi.mocked(readBody).mockResolvedValue({})
  })

  it('every route refuses a missing or unknown key', async () => {
    for (const route of [postRoute, patchRoute, deleteRoute]) {
      await expect(call(route, null)).rejects.toMatchObject({ statusCode: 401 })
      await expect(call(route, 'adk_bad')).rejects.toMatchObject({ statusCode: 401 })
    }
    for (const fn of Object.values(steps)) expect(fn).not.toHaveBeenCalled()
  })

  describe('POST steps', () => {
    it('passes the household, user, project and raw items to the service', async () => {
      const items = [{ text: 'Call' }, { nope: true }]
      vi.mocked(readBody).mockResolvedValue({ steps: items })
      steps.addBatch.mockResolvedValue({ created: [], skipped: [], errors: [] })
      expect(await call(postRoute)).toEqual({ created: [], skipped: [], errors: [] })
      expect(steps.addBatch).toHaveBeenCalledWith('h1', 'u1', 'p1', items)
    })

    it('rejects a bad envelope with one message', async () => {
      const bodies = [{}, { steps: [] }, { steps: Array.from({ length: 101 }, () => ({ text: 'x' })) }, { steps: 'nope' }, { steps: { text: 'x' } }, undefined, null]
      for (const body of bodies) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(postRoute)).rejects.toMatchObject({ statusCode: 400, message: 'Body must be { steps: [...] } with 1-100 items' })
      }
      expect(steps.addBatch).not.toHaveBeenCalled()
    })

    it('accepts exactly 100 items', async () => {
      vi.mocked(readBody).mockResolvedValue({ steps: Array.from({ length: 100 }, () => ({ text: 'x' })) })
      steps.addBatch.mockResolvedValue({ created: [], skipped: [], errors: [] })
      await call(postRoute)
      expect(steps.addBatch).toHaveBeenCalled()
    })

    it('passes service errors through', async () => {
      vi.mocked(readBody).mockResolvedValue({ steps: [{ text: 'x' }] })
      steps.addBatch.mockRejectedValueOnce(new HttpError('The API key owner is no longer a member of this household', 403))
      await expect(call(postRoute)).rejects.toMatchObject({ statusCode: 403 })
      steps.addBatch.mockRejectedValueOnce(new HttpError('Project not found', 404))
      await expect(call(postRoute)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('PATCH step', () => {
    it('passes the parsed fields and the ids to the service', async () => {
      vi.mocked(readBody).mockResolvedValue({ text: '  Call  ', estimateMinutes: null, done: true })
      steps.update.mockResolvedValue({ id: 's1' })
      expect(await call(patchRoute)).toEqual({ id: 's1' })
      expect(steps.update).toHaveBeenCalledWith('h1', 'u1', 'p1', 's1', { text: 'Call', estimateMinutes: null, done: true })
    })

    it('rejects {}, a non-object body, an unknown field and bad values', async () => {
      const bodies: [unknown, string?][] = [
        [{}, 'Nothing to update'],
        [undefined, 'Nothing to update'],
        [null, 'Nothing to update'],
        ['text', 'Nothing to update'],
        [{ estimate: 5 }],
        [{ completed: true }],
        [{ text: '   ' }],
        [{ estimateMinutes: 0 }],
        [{ estimateMinutes: 1.5 }],
        [{ done: 'yes' }],
      ]
      for (const [body, message] of bodies) {
        vi.mocked(readBody).mockResolvedValue(body)
        const promise = call(patchRoute)
        await expect(promise).rejects.toMatchObject({ statusCode: 400 })
        if (message) await expect(call(patchRoute)).rejects.toMatchObject({ message })
      }
      expect(steps.update).not.toHaveBeenCalled()
    })

    it('passes service errors through', async () => {
      vi.mocked(readBody).mockResolvedValue({ done: true })
      steps.update.mockRejectedValueOnce(new HttpError('Step not found', 404))
      await expect(call(patchRoute)).rejects.toMatchObject({ statusCode: 404 })
      steps.update.mockRejectedValueOnce(new HttpError('The API key owner is no longer a member of this household', 403))
      await expect(call(patchRoute)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('DELETE step', () => {
    it('removes the step and answers { success: true }', async () => {
      steps.remove.mockResolvedValue(undefined)
      expect(await call(deleteRoute)).toEqual({ success: true })
      expect(steps.remove).toHaveBeenCalledWith('h1', 'u1', 'p1', 's1')
    })

    it('passes service errors through', async () => {
      steps.remove.mockRejectedValueOnce(new HttpError('Step not found', 404))
      await expect(call(deleteRoute)).rejects.toMatchObject({ statusCode: 404 })
      steps.remove.mockRejectedValueOnce(new HttpError('The API key owner is no longer a member of this household', 403))
      await expect(call(deleteRoute)).rejects.toMatchObject({ statusCode: 403 })
    })
  })
})
