import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const planService = vi.hoisted(() => ({ getState: vi.fn(), run: vi.fn() }))
const stepService = vi.hoisted(() => ({ addMany: vi.fn() }))

vi.mock('@/server/services/ProjectPlanService', () => ({
  ProjectPlanService: vi.fn(() => planService),
}))
vi.mock('@/server/services/ProjectStepService', () => ({
  ProjectStepService: vi.fn(() => stepService),
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
import { MAX_STEP_ESTIMATE_MINUTES } from '@/types/project'
import getRoute from '@/server/api/projects/[id]/plan.get'
import postRoute from '@/server/api/projects/[id]/plan.post'
import batchRoute from '@/server/api/projects/[id]/steps/batch.post'

type Handler = (event: unknown) => Promise<unknown>

const call = (handler: unknown, userId: string | null, params: Record<string, string> = { id: 'p1' }) =>
  (handler as Handler)({
    node: { req: { headers: userId ? { 'x-dev-user-id': userId } : {} } },
    context: { params },
  })

const state = { enabled: true, limitReached: false, hasSuggestions: false, plan: null }
const ran = { status: 'ok', limitReached: false, hasSuggestions: false, plan: null }
const batch = { steps: [], skipped: 0 }
const ESTIMATE_MESSAGE = `Estimate must be a whole number of minutes from 1 to ${MAX_STEP_ESTIMATE_MINUTES}`

describe('project plan routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(devAuthService.getUserById).mockImplementation((async (id: string) => {
      if (id === 'u1') return { id: 'u1', name: 'u1', email: 'u1@example.com', householdId: 'h1' }
      if (id === 'loner') return { id: 'loner', name: 'loner', email: 'loner@example.com', householdId: null }
      return null
    }) as never)
    planService.getState.mockResolvedValue(state)
    planService.run.mockResolvedValue(ran)
    stepService.addMany.mockResolvedValue(batch)
    vi.mocked(readBody).mockResolvedValue({})
  })

  it('GET returns the state for the caller household', async () => {
    expect(await call(getRoute, 'u1')).toEqual(state)
    expect(planService.getState).toHaveBeenCalledWith('h1', 'p1')
  })

  it('GET passes a 404 from the service through', async () => {
    planService.getState.mockRejectedValue(new HttpError('Project not found', 404))
    await expect(call(getRoute, 'u1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
  })

  it('all three routes refuse a caller with no household', async () => {
    vi.mocked(readBody).mockResolvedValue({ steps: [{ text: 'Do it' }] })
    await expect(call(getRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    await expect(call(postRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    await expect(call(batchRoute, 'loner')).rejects.toMatchObject({ statusCode: 403 })
    expect(planService.getState).not.toHaveBeenCalled()
    expect(planService.run).not.toHaveBeenCalled()
    expect(stepService.addMany).not.toHaveBeenCalled()
  })

  it('POST plan runs with the trimmed text and the caller', async () => {
    vi.mocked(readBody).mockResolvedValue({ extraText: '  before Thanksgiving  ' })
    expect(await call(postRoute, 'u1')).toEqual(ran)
    expect(planService.run).toHaveBeenCalledWith('h1', 'u1', 'p1', 'before Thanksgiving')
  })

  it('POST plan accepts no body at all', async () => {
    vi.mocked(readBody).mockResolvedValue(undefined)
    await call(postRoute, 'u1')
    expect(planService.run).toHaveBeenCalledWith('h1', 'u1', 'p1', null)
  })

  it('POST plan rejects text over 500 characters without running', async () => {
    vi.mocked(readBody).mockResolvedValue({ extraText: 'x'.repeat(501) })
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: 'Anything to add must be 500 characters or fewer' })
    expect(planService.run).not.toHaveBeenCalled()
  })

  it('POST plan passes 403 and 429 from the service through', async () => {
    planService.run.mockRejectedValue(new HttpError('Suggestions are not available', 403))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 403, message: 'Suggestions are not available' })
    planService.run.mockRejectedValue(new HttpError('Daily limit reached. Try again later.', 429))
    await expect(call(postRoute, 'u1')).rejects.toMatchObject({ statusCode: 429, message: 'Daily limit reached. Try again later.' })
  })

  it('POST batch adds the parsed steps, not the raw body', async () => {
    vi.mocked(readBody).mockResolvedValue({ steps: [{ text: 'Do it', estimateMinutes: 10 }, { text: '  Then this  ' }] })
    expect(await call(batchRoute, 'u1')).toEqual(batch)
    // The schema trims the text and leaves a missing estimate undefined; toEqual treats that as a missing key.
    expect(stepService.addMany).toHaveBeenCalledWith('h1', 'u1', 'p1', [{ text: 'Do it', estimateMinutes: 10 }, { text: 'Then this' }])
  })

  it('POST batch rejects an estimate of 0 without calling the service', async () => {
    vi.mocked(readBody).mockResolvedValue({ steps: [{ text: 'Do it', estimateMinutes: 0 }] })
    await expect(call(batchRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: ESTIMATE_MESSAGE })
    expect(stepService.addMany).not.toHaveBeenCalled()
  })

  it('POST batch rejects an estimate over the maximum without calling the service', async () => {
    vi.mocked(readBody).mockResolvedValue({ steps: [{ text: 'Do it', estimateMinutes: MAX_STEP_ESTIMATE_MINUTES + 1 }] })
    await expect(call(batchRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: ESTIMATE_MESSAGE })
    expect(stepService.addMany).not.toHaveBeenCalled()
  })

  it('POST batch rejects an empty list and more than 30 steps without calling the service', async () => {
    vi.mocked(readBody).mockResolvedValue({ steps: [] })
    await expect(call(batchRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: 'Add at least one step' })
    vi.mocked(readBody).mockResolvedValue({ steps: Array.from({ length: 31 }, (_, i) => ({ text: `Step ${i}` })) })
    await expect(call(batchRoute, 'u1')).rejects.toMatchObject({ statusCode: 400, message: 'Add at most 30 steps at a time' })
    expect(stepService.addMany).not.toHaveBeenCalled()
  })

  it('POST batch rejects a step text over 200 characters', async () => {
    vi.mocked(readBody).mockResolvedValue({ steps: [{ text: 'x'.repeat(201) }] })
    await expect(call(batchRoute, 'u1')).rejects.toMatchObject({ statusCode: 400 })
    expect(stepService.addMany).not.toHaveBeenCalled()
  })
})
