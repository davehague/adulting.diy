import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    projectSuggestion: { findUnique: vi.fn() },
    projectPlan: { findUnique: vi.fn(), upsert: vi.fn() },
    aiRequestLog: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectPlanService } from '@/server/services/ProjectPlanService'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const reply = (body: unknown) => ({ text: JSON.stringify(body), promptTokens: 100, outputTokens: 50 })
const okPlan = {
  tooVague: false,
  summary: { totalMinutes: 999, costLow: 60, costHigh: 120, difficulty: 'moderate', why: 'Mostly patching.' },
  safety: null,
  steps: [
    { text: 'Find and stop the leak', minutes: 45, costLow: 20, costHigh: 30, pro: true, proWhy: 'Supply lines need a plumber.' },
    { text: 'Cut out the damaged drywall', minutes: 30, costLow: 0, costHigh: 0, pro: false, proWhy: null },
  ],
  tools: [{ name: 'Drywall saw', have: false, priceLow: 10, priceHigh: 15 }],
  materials: [{ name: 'Joint compound', quantity: '1 qt', priceLow: 8, priceHigh: 12 }],
}
const savedSuggestion = {
  tooVague: false,
  parts: [{ name: 'Fix the leak', why: 'It leaks.', categoryId: 'c1', searchPhrase: 'x near me', poolSize: 2, picks: [{ providerId: 'prov-alpha', reason: 'Alpha Plumbing is great.' }] }],
}

let model: ReturnType<typeof vi.fn>
let clock: number
let service: ProjectPlanService

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.stubEnv('OLLAMA_API_KEY', 'k')
  vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
  vi.stubEnv('AI_SUGGESTIONS_MODEL', '')
  clock = Date.UTC(2026, 9, 6, 12)
  model = vi.fn()
  service = new ProjectPlanService(model, () => clock)
  db.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Water stain', location: 'Dining room', notes: 'Under the bath. Alpha Plumbing quoted $400.', status: 'planning' })
  db.projectSuggestion.findUnique.mockResolvedValue(null)
  db.projectPlan.findUnique.mockResolvedValue(null)
  db.projectPlan.upsert.mockResolvedValue({})
  db.aiRequestLog.count.mockResolvedValue(0)
  db.aiRequestLog.create.mockResolvedValue({ id: 'log1' })
  db.aiRequestLog.update.mockResolvedValue({})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const savedArgs = () => db.projectPlan.upsert.mock.calls[0][0]

describe('getState', () => {
  it('returns 404 for a project in another household or a deleted one', async () => {
    db.project.findFirst.mockResolvedValue(null)
    await expect(service.getState('h1', 'p1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
  })
  it('reports not enabled for an unlisted household and looks nothing else up', async () => {
    expect(await service.getState('h9', 'p1')).toEqual({ enabled: false, limitReached: false, hasSuggestions: false, plan: null })
    expect(db.aiRequestLog.count).not.toHaveBeenCalled()
    expect(db.projectPlan.findUnique).not.toHaveBeenCalled()
  })
  it('reports enabled with no plan and no suggestions', async () => {
    expect(await service.getState('h1', 'p1')).toEqual({ enabled: true, limitReached: false, hasSuggestions: false, plan: null })
  })
  it('reports hasSuggestions only for a usable, not-too-vague saved suggestion', async () => {
    db.projectSuggestion.findUnique.mockResolvedValue({ result: savedSuggestion })
    expect((await service.getState('h1', 'p1')).hasSuggestions).toBe(true)
    db.projectSuggestion.findUnique.mockResolvedValue({ result: { tooVague: true, parts: [] } })
    expect((await service.getState('h1', 'p1')).hasSuggestions).toBe(false)
    db.projectSuggestion.findUnique.mockResolvedValue({ result: { junk: 1 } })
    expect((await service.getState('h1', 'p1')).hasSuggestions).toBe(false)
  })
  it('returns the saved plan with its extra text and date', async () => {
    db.projectPlan.findUnique.mockResolvedValue({ extraText: 'I own a drill', result: { ...okPlan, summary: { ...okPlan.summary, totalMinutes: 75 } }, createdAt: new Date('2026-10-06T10:00:00Z') })
    const { plan } = await service.getState('h1', 'p1')
    expect(plan).toMatchObject({ extraText: 'I own a drill', createdAt: new Date('2026-10-06T10:00:00Z'), summary: { difficulty: 'moderate' } })
    expect(plan!.steps).toHaveLength(2)
  })
  it('ignores a saved plan it cannot read', async () => {
    db.projectPlan.findUnique.mockResolvedValue({ extraText: null, result: { version: 2 }, createdAt: new Date() })
    expect((await service.getState('h1', 'p1')).plan).toBeNull()
  })
  it('reports the limit reached at 20 asks of any feature in the last 24 hours', async () => {
    db.aiRequestLog.count.mockResolvedValue(20)
    expect((await service.getState('h1', 'p1')).limitReached).toBe(true)
    expect(db.aiRequestLog.count.mock.calls[0][0]).toEqual({ where: { householdId: 'h1', createdAt: { gte: new Date(clock - 24 * 60 * 60 * 1000) } } })
  })
})

describe('run', () => {
  it('returns 403 for an unlisted household without logging or calling the model', async () => {
    await expect(service.run('h9', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 403, message: 'Suggestions are not available' })
    expect(db.aiRequestLog.create).not.toHaveBeenCalled()
    expect(model).not.toHaveBeenCalled()
  })
  it('returns 429 at the shared cap without logging or calling the model', async () => {
    db.aiRequestLog.count.mockResolvedValue(20)
    await expect(service.run('h1', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 429, message: 'Daily limit reached. Try again later.' })
    expect(model).not.toHaveBeenCalled()
  })
  it('asks once, clamps, saves and logs', async () => {
    model.mockResolvedValueOnce(reply(okPlan))
    const response = await service.run('h1', 'u1', 'p1', 'I own a drill')
    expect(response.status).toBe('ok')
    expect(model).toHaveBeenCalledTimes(1)
    expect(model.mock.calls[0][0].model).toBe('glm-5.3-flash')
    expect(savedArgs().where).toEqual({ projectId: 'p1' })
    expect(savedArgs().create).toMatchObject({ projectId: 'p1', extraText: 'I own a drill', model: 'glm-5.3-flash', createdById: 'u1' })
    const saved = savedArgs().create.result
    expect(saved.summary.totalMinutes).toBe(75)
    expect(saved.steps[0]).toMatchObject({ pro: true, costLow: 0, costHigh: 0, proWhy: 'Supply lines need a plumber.' })
    expect(savedArgs().update.result).toEqual(saved)
    expect(db.aiRequestLog.create.mock.calls[0][0].data).toEqual({ householdId: 'h1', userId: 'u1', feature: 'diy_plan', model: 'glm-5.3-flash', outcome: 'started' })
    expect(db.aiRequestLog.create.mock.invocationCallOrder[0]).toBeLessThan(model.mock.invocationCallOrder[0])
    expect(db.aiRequestLog.update.mock.calls[0][0]).toEqual({ where: { id: 'log1' }, data: { outcome: 'ok', durationMs: 0, promptTokens: 100, outputTokens: 50 } })
  })
  it('returns the newly saved plan', async () => {
    model.mockResolvedValueOnce(reply(okPlan))
    db.projectPlan.findUnique.mockImplementation(async () => (db.projectPlan.upsert.mock.calls.length ? { extraText: null, result: savedArgs().create.result, createdAt: new Date(clock) } : null))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.plan?.summary?.totalMinutes).toBe(75)
  })
  it('sends the project text and the saved trade names, never the whys, provider names or picks', async () => {
    db.projectSuggestion.findUnique.mockResolvedValue({ result: savedSuggestion })
    model.mockResolvedValueOnce(reply(okPlan))
    await service.run('h1', 'u1', 'p1', 'extra words')
    const sent = `${model.mock.calls[0][0].system}\n${model.mock.calls[0][0].user}`
    expect(sent).toContain('Fix the leak')
    // Only the trade's name goes; its why reads like a hiring decision.
    expect(sent).not.toContain('It leaks.')
    expect(sent).toContain('extra words')
    expect(sent).not.toContain('prov-alpha')
    expect(sent).not.toContain('Alpha Plumbing is great.')
    expect(sent).not.toContain('h1"')
  })
  it('sends an empty trades list when the saved suggestion is too vague or unreadable', async () => {
    db.projectSuggestion.findUnique.mockResolvedValue({ result: { tooVague: true, parts: [] } })
    model.mockResolvedValueOnce(reply(okPlan))
    await service.run('h1', 'u1', 'p1', null)
    expect(JSON.parse(model.mock.calls[0][0].user).trades).toEqual([])
  })
  it('saves a too-vague result', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: true }))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('too_vague')
    expect(savedArgs().create.result).toEqual({ tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] })
    expect(db.aiRequestLog.update.mock.calls[0][0].data.outcome).toBe('too_vague')
  })
  it('retries once on a reply without a summary', async () => {
    model.mockResolvedValueOnce(reply({ ...okPlan, summary: null })).mockResolvedValueOnce(reply(okPlan))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('ok')
    expect(model).toHaveBeenCalledTimes(2)
  })
  it('fails after two bad replies, saves nothing, and returns the previous plan', async () => {
    db.projectPlan.findUnique.mockResolvedValue({ extraText: null, result: { tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] }, createdAt: new Date('2026-10-01') })
    model.mockResolvedValue({ text: 'not json', promptTokens: null, outputTokens: null })
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(db.projectPlan.upsert).not.toHaveBeenCalled()
    expect(response.plan).toMatchObject({ tooVague: true })
    expect(db.aiRequestLog.update.mock.calls[0][0].data).toEqual({ outcome: 'failed', durationMs: 0, promptTokens: null, outputTokens: null })
  })
  it('fails when the model throws, without retrying', async () => {
    model.mockRejectedValue(new Error('Ollama returned HTTP 500'))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(1)
  })
  it('fails cleanly when reading the saved suggestion fails: no model call, no save, previous plan kept, nothing logged with project text', async () => {
    db.projectSuggestion.findUnique.mockRejectedValue(new Error('SECRET ROW DATA Water stain'))
    db.projectPlan.findUnique.mockResolvedValue({ extraText: null, result: { tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] }, createdAt: new Date('2026-10-01') })
    const response = await service.run('h1', 'u1', 'p1', 'SECRET EXTRA')
    expect(response.status).toBe('failed')
    expect(response.hasSuggestions).toBe(false)
    expect(response.plan).toMatchObject({ tooVague: true })
    expect(model).not.toHaveBeenCalled()
    expect(db.projectPlan.upsert).not.toHaveBeenCalled()
    expect(db.aiRequestLog.update.mock.calls[0][0]).toEqual({ where: { id: 'log1' }, data: { outcome: 'failed', durationMs: 0, promptTokens: null, outputTokens: null } })
    const logged = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.info).mock.calls].flat().join(' ')
    expect(logged).not.toContain('SECRET')
    expect(logged).not.toContain('Water stain')
  })
  it('does not start a second call once the deadline has passed', async () => {
    model.mockImplementation(async () => { clock += 50_000; return { text: 'not json', promptTokens: null, outputTokens: null } })
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(1)
    expect(model.mock.calls[0][0].timeoutMs).toBe(45_000)
  })
  it('reports the limit reached on the ask that uses the last one', async () => {
    db.aiRequestLog.count.mockResolvedValue(19)
    model.mockResolvedValueOnce(reply(okPlan))
    expect((await service.run('h1', 'u1', 'p1', null)).limitReached).toBe(true)
  })
  it('still answers when updating the log row fails', async () => {
    db.aiRequestLog.update.mockRejectedValue(new Error('db down'))
    model.mockResolvedValueOnce(reply(okPlan))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('ok')
  })
  it('never logs prompt, reply or project text to the console', async () => {
    model.mockRejectedValue(new Error('SECRET PROMPT ECHO'))
    await service.run('h1', 'u1', 'p1', 'SECRET EXTRA')
    db.projectPlan.upsert.mockRejectedValue(new Error('SECRET ROW DATA'))
    model.mockReset().mockResolvedValue(reply(okPlan))
    await service.run('h1', 'u1', 'p1', 'SECRET EXTRA')
    const logged = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.info).mock.calls].flat().join(' ')
    expect(logged).not.toContain('SECRET')
    expect(logged).not.toContain('Water stain')
    expect(logged).not.toContain('Alpha')
  })
})
