import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const service = vi.hoisted(() => ({ getState: vi.fn(), run: vi.fn() }))

vi.mock('@/server/services/ProviderSuggestionService', () => ({
  ProviderSuggestionService: vi.fn(() => service),
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
import getRoute from '@/server/api/projects/[id]/suggestions.get'
import postRoute from '@/server/api/projects/[id]/suggestions.post'

type Handler = (event: unknown) => Promise<unknown>

const call = (handler: unknown, userId: string | null, params: Record<string, string> = { id: 'p1' }) =>
  (handler as Handler)({
    node: { req: { headers: userId ? { 'x-dev-user-id': userId } : {} } },
    context: { params },
  })

const state = { enabled: true, limitReached: false, suggestion: null }
const ran = { status: 'ok', limitReached: false, suggestion: null, fallback: null }

describe('project suggestion routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(devAuthService.getUserById).mockImplementation((async (id: string) => {
      if (id === 'u1') return { id: 'u1', name: 'u1', email: 'u1@example.com', householdId: 'h1' }
      if (id === 'loner') return { id: 'loner', name: 'loner', email: 'loner@example.com', householdId: null }
      return null
    }) as never)
    service.getState.mockResolvedValue(state)
    service.run.mockResolvedValue(ran)
    vi.mocked(readBody).mockResolvedValue({})
  })

  it('GET returns the state for the caller household', async () => {
    expect(await call(getRoute, 'u1')).toEqual(state)
    expect(service.getState).toHaveBeenCalledWith('h1', 'p1')
  })

  it('GET passes a 404 from the service through', async () => {
    service.getState.mockRejectedValue(new HttpError('Project not found', 404))
    await expect(call(getRoute, 'u1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
  })

  it('both routes refuse a caller with no household', async () => {
    await expect(call(getRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    await expect(call(postRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    expect(service.run).not.toHaveBeenCalled()
  })

  it('POST runs with the trimmed text and the caller', async () => {
    vi.mocked(readBody).mockResolvedValue({ extraText: '  before Thanksgiving  ' })
    expect(await call(postRoute, 'u1')).toEqual(ran)
    expect(service.run).toHaveBeenCalledWith('h1', 'u1', 'p1', 'before Thanksgiving')
  })

  it('POST accepts no body at all', async () => {
    vi.mocked(readBody).mockResolvedValue(undefined)
    await call(postRoute, 'u1')
    expect(service.run).toHaveBeenCalledWith('h1', 'u1', 'p1', null)
  })

  it('POST rejects text over 500 characters without running', async () => {
    vi.mocked(readBody).mockResolvedValue({ extraText: 'x'.repeat(501) })
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: 'Anything to add must be 500 characters or fewer' })
    expect(service.run).not.toHaveBeenCalled()
  })

  it('POST passes 403 and 429 from the service through', async () => {
    service.run.mockRejectedValue(new HttpError('Suggestions are not available', 403))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 403 })
    service.run.mockRejectedValue(new HttpError('Daily limit reached. Try again later.', 429))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 429, message: 'Daily limit reached. Try again later.' })
  })
})
