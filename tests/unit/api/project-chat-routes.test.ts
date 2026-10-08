import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const chatService = vi.hoisted(() => ({ getState: vi.fn(), send: vi.fn() }))

vi.mock('@/server/services/ProjectChatService', () => ({
  ProjectChatService: vi.fn(() => chatService),
}))

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
import getRoute from '@/server/api/projects/[id]/chat.get'
import postRoute from '@/server/api/projects/[id]/chat.post'

type Handler = (event: unknown) => Promise<unknown>

const call = (handler: unknown, userId: string | null, params: Record<string, string> = { id: 'p1' }) =>
  (handler as Handler)({
    node: { req: { headers: userId ? { 'x-dev-user-id': userId } : {} } },
    context: { params },
  })

const state = { enabled: true, messages: [], pending: false }
const sent = { userMessage: { id: 'a' }, assistantMessage: { id: 'b' } }
const LENGTH_MESSAGE = 'A message must be 1 to 2000 characters'

describe('project chat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(devAuthService.getUserById).mockImplementation((async (id: string) => {
      if (id === 'u1') return { id: 'u1', name: 'u1', email: 'u1@example.com', householdId: 'h1' }
      if (id === 'loner') return { id: 'loner', name: 'loner', email: 'loner@example.com', householdId: null }
      return null
    }) as never)
    chatService.getState.mockResolvedValue(state)
    chatService.send.mockResolvedValue(sent)
    vi.mocked(readBody).mockResolvedValue({ text: 'hello' })
  })

  it('GET returns the state for the caller', async () => {
    expect(await call(getRoute, 'u1')).toEqual(state)
    expect(chatService.getState).toHaveBeenCalledWith('h1', 'u1', 'p1')
  })

  it('GET passes a 404 from the service through', async () => {
    chatService.getState.mockRejectedValue(new HttpError('Project not found', 404))
    await expect(call(getRoute, 'u1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
  })

  it('both routes refuse a caller with no household', async () => {
    await expect(call(getRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    await expect(call(postRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    expect(chatService.getState).not.toHaveBeenCalled()
    expect(chatService.send).not.toHaveBeenCalled()
  })

  it('POST sends the trimmed text', async () => {
    vi.mocked(readBody).mockResolvedValue({ text: '  hello ' })
    expect(await call(postRoute, 'u1')).toEqual(sent)
    expect(chatService.send).toHaveBeenCalledWith('h1', 'u1', 'p1', { text: 'hello' })
  })

  it('POST sends a retry', async () => {
    vi.mocked(readBody).mockResolvedValue({ retry: true })
    await call(postRoute, 'u1')
    expect(chatService.send).toHaveBeenCalledWith('h1', 'u1', 'p1', { retry: true })
  })

  it('POST rejects a null body, an empty object, whitespace text and 2001 characters without calling the service', async () => {
    for (const body of [null, {}, { text: '   ' }, { text: 'x'.repeat(2001) }]) {
      vi.mocked(readBody).mockResolvedValue(body)
      await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: LENGTH_MESSAGE })
    }
    expect(chatService.send).not.toHaveBeenCalled()
  })

  it('POST passes 403, 409 and 502 from the service through', async () => {
    chatService.send.mockRejectedValue(new HttpError('Suggestions are not available', 403))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 403, message: 'Suggestions are not available' })
    chatService.send.mockRejectedValue(new HttpError('A reply is on its way', 409))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 409, message: 'A reply is on its way' })
    chatService.send.mockRejectedValue(new HttpError("Couldn't get a reply. Try again.", 502))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 502, message: "Couldn't get a reply. Try again." })
  })

  it('POST wraps an unknown error as 500', async () => {
    chatService.send.mockRejectedValue(new Error('boom'))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 500 })
    expect(chatService.send).toHaveBeenCalledTimes(1)
  })

  it('POST wraps an unknown error as 500 without its message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    chatService.send.mockRejectedValue(new Error('secret boom'))
    const error = await call(postRoute, 'u1').catch((e: Error) => e)
    expect(error).toMatchObject({ statusCode: 500, message: 'Server error' })
    expect((error as Error).message).not.toContain('secret')
  })

  it('GET and POST reject a missing project id with 400', async () => {
    await expect(call(getRoute, 'u1', {})).rejects.toMatchObject({ statusCode: 400 })
    await expect(call(postRoute, 'u1', {})).rejects.toMatchObject({ statusCode: 400 })
    expect(chatService.getState).not.toHaveBeenCalled()
    expect(chatService.send).not.toHaveBeenCalled()
  })
})
