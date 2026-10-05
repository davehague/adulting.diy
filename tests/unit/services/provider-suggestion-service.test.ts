import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    providerCategory: { findMany: vi.fn(), findFirst: vi.fn() },
    provider: { findMany: vi.fn() },
    projectSuggestion: { findUnique: vi.fn(), upsert: vi.fn() },
    aiRequestLog: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProviderSuggestionService } from '@/server/services/ProviderSuggestionService'
import { callOllama, ModelCallError } from '@/server/utils/ollama'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const PLUMB = { id: 'cat-plumb', name: 'Plumber' }
const DRY = { id: 'cat-dry', name: 'Drywall' }

const providerRow = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id, name, company: null, phone: '614-555-0101', email: 'owner@example.com', rating: null, notes: null,
  categoryId: PLUMB.id,
  category: { ...PLUMB, sortOrder: 0 },
  status: { id: 's-lead', name: 'Lead', kind: 'neutral', hiddenByDefault: true, sortOrder: 0 },
  evidence: [],
  comments: [],
  ...overrides,
})

const alpha = providerRow('prov-alpha', 'Alpha Plumbing', {
  evidence: [{ kind: 'third_party', sourceDate: new Date('2026-08-01'), snippet: 'Alpha fixed our leak.', sourceUrl: 'https://fb.example/post1', sourceGroup: 'Neighbors Group' }],
})
const beta = providerRow('prov-beta', 'Beta Plumbing')

const reply = (body: unknown) => ({ text: JSON.stringify(body), promptTokens: 100, outputTokens: 50 })
const routingOk = { tooVague: false, parts: [{ name: 'Fix the leak', categoryId: 'c1', why: 'It leaks.', searchPhrase: 'leak plumber' }] }
const pickingOk = { parts: [{ partIndex: 0, picks: [{ providerId: 'p1', reason: 'A neighbor says they fixed a leak.' }, { providerId: 'p9', reason: 'Not in the pool.' }] }] }

let model: ReturnType<typeof vi.fn>
let clock: number
let service: ProviderSuggestionService
let poolRows: unknown[]
let readRows: unknown[]
let fallbackRows: unknown[]

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.stubEnv('OLLAMA_API_KEY', 'k')
  vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
  vi.stubEnv('AI_SUGGESTIONS_MODEL', '')
  clock = Date.UTC(2026, 9, 5, 12)
  model = vi.fn()
  service = new ProviderSuggestionService(model, () => clock)
  poolRows = [beta, alpha]
  readRows = [alpha]
  fallbackRows = []
  db.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Water stain', location: 'Dining room', notes: 'Under the bath.', providerCategoryId: null })
  db.providerCategory.findMany.mockResolvedValue([PLUMB, DRY])
  db.providerCategory.findFirst.mockResolvedValue(PLUMB)
  // The three provider queries are told apart by their where clause.
  db.provider.findMany.mockImplementation(async (args: { where: { id?: unknown; categoryId?: unknown } }) => {
    if (args.where.id) return readRows
    if (typeof args.where.categoryId === 'string') return fallbackRows
    return poolRows
  })
  db.projectSuggestion.findUnique.mockResolvedValue(null)
  db.projectSuggestion.upsert.mockResolvedValue({})
  db.aiRequestLog.count.mockResolvedValue(0)
  db.aiRequestLog.create.mockResolvedValue({ id: 'log1' })
  db.aiRequestLog.update.mockResolvedValue({})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const savedArgs = () => db.projectSuggestion.upsert.mock.calls[0][0]

describe('getState', () => {
  it('returns 404 for a project in another household or a deleted one', async () => {
    db.project.findFirst.mockResolvedValue(null)
    await expect(service.getState('h1', 'p1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
  })

  it('reports not enabled for an unlisted household and looks nothing else up', async () => {
    expect(await service.getState('h9', 'p1')).toEqual({ enabled: false, limitReached: false, suggestion: null })
    expect(db.aiRequestLog.count).not.toHaveBeenCalled()
    expect(db.projectSuggestion.findUnique).not.toHaveBeenCalled()
  })

  it('reports enabled with no suggestion saved', async () => {
    expect(await service.getState('h1', 'p1')).toEqual({ enabled: true, limitReached: false, suggestion: null })
  })

  it('reports the limit reached at 20 asks in the last 24 hours', async () => {
    db.aiRequestLog.count.mockResolvedValue(20)
    expect((await service.getState('h1', 'p1')).limitReached).toBe(true)
    const where = db.aiRequestLog.count.mock.calls[0][0].where
    expect(where.householdId).toBe('h1')
    expect(where.feature).toBe('provider_suggestions')
    expect(where.createdAt.gte).toEqual(new Date(clock - 24 * 60 * 60 * 1000))
  })
})

describe('readSuggestion (through getState)', () => {
  const saved = (result: unknown) =>
    db.projectSuggestion.findUnique.mockResolvedValue({ extraText: 'soon', result, createdAt: new Date('2026-10-05T10:00:00Z') })
  const part = (overrides: Record<string, unknown> = {}) => ({
    name: 'Fix the leak', why: 'It leaks.', categoryId: PLUMB.id, searchPhrase: 'leak plumber near me', poolSize: 2,
    picks: [{ providerId: 'prov-alpha', reason: 'Good.' }, { providerId: 'prov-gone', reason: 'Was good.' }], ...overrides,
  })

  it('returns current provider fields, the saved reason, the category name and a Google link', async () => {
    saved({ tooVague: false, parts: [part()] })
    const { suggestion } = await service.getState('h1', 'p1')
    expect(suggestion).toMatchObject({ tooVague: false, extraText: 'soon', createdAt: new Date('2026-10-05T10:00:00Z') })
    expect(suggestion!.parts[0]).toMatchObject({
      name: 'Fix the leak', category: PLUMB, poolSize: 2,
      searchUrl: 'https://www.google.com/search?q=leak%20plumber%20near%20me',
    })
    expect(suggestion!.parts[0].picks).toHaveLength(1)
    expect(suggestion!.parts[0].picks[0]).toMatchObject({ reason: 'Good.', provider: { id: 'prov-alpha', name: 'Alpha Plumbing', neighborCount: 1 } })
  })

  it('drops a pick whose provider was deleted or now has a negative status, by asking only for eligible ones', async () => {
    saved({ tooVague: false, parts: [part()] })
    await service.getState('h1', 'p1')
    const where = db.provider.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ householdId: 'h1', metaStatus: 'active', status: { kind: { not: 'negative' } } })
    expect(where.id).toEqual({ in: ['prov-alpha', 'prov-gone'] })
  })

  it('asks only for this household\'s categories when it reads the saved result', async () => {
    saved({ tooVague: false, parts: [part()] })
    await service.getState('h1', 'p1')
    expect(db.providerCategory.findMany.mock.calls[0][0].where).toEqual({ householdId: 'h1', id: { in: [PLUMB.id] } })
  })

  it('reads a saved result whose search phrase has a lone surrogate without throwing', async () => {
    saved({ tooVague: false, parts: [part({ searchPhrase: 'leak \uD83D plumber near me' })] })
    const { suggestion } = await service.getState('h1', 'p1')
    expect(suggestion!.parts[0].searchUrl).toBe('https://www.google.com/search?q=leak%20%20plumber%20near%20me')
  })

  it('shows no category when it has since been deleted', async () => {
    saved({ tooVague: false, parts: [part({ categoryId: 'cat-deleted' })] })
    const { suggestion } = await service.getState('h1', 'p1')
    expect(suggestion!.parts[0].category).toBeNull()
  })

  it('returns a too-vague result with no parts and makes no provider query', async () => {
    saved({ tooVague: true, parts: [] })
    const { suggestion } = await service.getState('h1', 'p1')
    expect(suggestion).toMatchObject({ tooVague: true, parts: [] })
    expect(db.provider.findMany).not.toHaveBeenCalled()
  })

  it('ignores a saved result it cannot read', async () => {
    saved({ version: 2, trades: ['plumber'] })
    expect((await service.getState('h1', 'p1')).suggestion).toBeNull()
  })
})

describe('run', () => {
  it('returns 404 for a project in another household', async () => {
    db.project.findFirst.mockResolvedValue(null)
    await expect(service.run('h1', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 403 for an unlisted household without logging or calling the model', async () => {
    await expect(service.run('h9', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 403, message: 'Suggestions are not available' })
    expect(db.aiRequestLog.create).not.toHaveBeenCalled()
    expect(model).not.toHaveBeenCalled()
  })

  it('returns 429 at the cap without logging or calling the model', async () => {
    db.aiRequestLog.count.mockResolvedValue(20)
    await expect(service.run('h1', 'u1', 'p1', null)).rejects.toMatchObject({ statusCode: 429, message: 'Daily limit reached. Try again later.' })
    expect(db.aiRequestLog.create).not.toHaveBeenCalled()
    expect(model).not.toHaveBeenCalled()
  })

  it('routes, builds the pool, picks, checks, saves and logs', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    const response = await service.run('h1', 'u1', 'p1', 'before Thanksgiving')

    expect(response.status).toBe('ok')
    expect(response.fallback).toBeNull()
    expect(model).toHaveBeenCalledTimes(2)
    expect(model.mock.calls[0][0].model).toBe('glm-5.3-flash')

    // Alpha has a neighbor recommendation, so the fixed ranking puts it first: p1 is Alpha.
    expect(savedArgs().where).toEqual({ projectId: 'p1' })
    expect(savedArgs().create).toMatchObject({ projectId: 'p1', extraText: 'before Thanksgiving', model: 'glm-5.3-flash', createdById: 'u1' })
    expect(savedArgs().create.result).toEqual({
      tooVague: false,
      parts: [{
        name: 'Fix the leak', why: 'It leaks.', categoryId: PLUMB.id, searchPhrase: 'leak plumber near me', poolSize: 2,
        picks: [{ providerId: 'prov-alpha', reason: 'A neighbor says they fixed a leak.' }],
      }],
    })
    expect(savedArgs().update.result).toEqual(savedArgs().create.result)

    expect(db.aiRequestLog.update.mock.calls[0][0]).toEqual({
      where: { id: 'log1' },
      data: { outcome: 'ok', durationMs: 0, promptTokens: 200, outputTokens: 100 },
    })
  })

  it('builds the pool from eligible providers in the routed categories that are not on the project', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', null)
    expect(db.provider.findMany.mock.calls[0][0].where).toEqual({
      householdId: 'h1',
      metaStatus: 'active',
      status: { kind: { not: 'negative' } },
      categoryId: { in: [PLUMB.id] },
      projects: { none: { projectId: 'p1' } },
    })
  })

  it('offers the model only this household\'s categories', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', null)
    expect(db.providerCategory.findMany.mock.calls[0][0].where).toEqual({ householdId: 'h1' })
  })

  it('sends no contact details, source links, group names or database ids to the model', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', 'extra words')
    const sent = model.mock.calls.map((call) => `${call[0].system}\n${call[0].user}`).join('\n')
    for (const secret of ['614-555-0101', 'owner@example.com', 'fb.example', 'Neighbors Group', 'prov-alpha', 'prov-beta', 'cat-plumb', 'h1"', 'u1"']) {
      expect(sent).not.toContain(secret)
    }
    expect(sent).toContain('Alpha fixed our leak.')
    expect(sent).toContain('extra words')
  })

  it('writes the log row before calling the model', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', null)
    expect(db.aiRequestLog.create.mock.calls[0][0].data).toEqual({
      householdId: 'h1', userId: 'u1', feature: 'provider_suggestions', model: 'glm-5.3-flash', outcome: 'started',
    })
    expect(db.aiRequestLog.create.mock.invocationCallOrder[0]).toBeLessThan(model.mock.invocationCallOrder[0])
  })

  it('reports the limit reached on the ask that uses the last one', async () => {
    db.aiRequestLog.count.mockResolvedValue(19)
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    expect((await service.run('h1', 'u1', 'p1', null)).limitReached).toBe(true)
  })

  it('saves a too-vague result and skips picking', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: true, parts: [] }))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('too_vague')
    expect(model).toHaveBeenCalledTimes(1)
    expect(savedArgs().create.result).toEqual({ tooVague: true, parts: [] })
    expect(db.aiRequestLog.update.mock.calls[0][0].data.outcome).toBe('too_vague')
  })

  it('saves too_vague after one call when the reply is only {"tooVague": true}', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: true }))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('too_vague')
    expect(model).toHaveBeenCalledTimes(1)
    expect(savedArgs().create.result).toEqual({ tooVague: true, parts: [] })
    expect(db.aiRequestLog.update.mock.calls[0][0].data.outcome).toBe('too_vague')
  })

  it('keeps a part whose categoryId was left out, as a part with no matching category', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: false, parts: [{ name: 'Rebuild the chimney', why: 'Masonry.', searchPhrase: 'chimney mason near me' }] }))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('ok')
    expect(savedArgs().create.result.parts[0]).toMatchObject({ categoryId: null, poolSize: 0, picks: [] })
  })

  it('treats a reply with no parts as too vague', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: false, parts: [] }))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('too_vague')
  })

  it('skips picking when every pool is empty, and keeps the part with a pool size of 0', async () => {
    poolRows = []
    model.mockResolvedValueOnce(reply(routingOk))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('ok')
    expect(model).toHaveBeenCalledTimes(1)
    expect(savedArgs().create.result.parts[0]).toMatchObject({ categoryId: PLUMB.id, poolSize: 0, picks: [] })
  })

  it('keeps a part with no matching category and does not query a pool for it', async () => {
    model.mockResolvedValueOnce(reply({ tooVague: false, parts: [{ name: 'Rebuild the chimney', categoryId: null, why: 'Masonry.', searchPhrase: 'chimney mason near me' }] }))
    await service.run('h1', 'u1', 'p1', null)
    expect(savedArgs().create.result.parts[0]).toMatchObject({ categoryId: null, poolSize: 0, picks: [] })
    expect(db.provider.findMany).not.toHaveBeenCalled()
  })

  it('caps a pool at 40 after ranking, so the best providers survive even when the query returns them last', async () => {
    const positive = { id: 's-fav', name: 'Favorite', kind: 'positive', hiddenByDefault: false, sortOrder: 1 }
    poolRows = [
      ...Array.from({ length: 40 }, (_, i) => providerRow(`prov-${i}`, `Provider ${String(i).padStart(2, '0')}`)),
      ...Array.from({ length: 5 }, (_, i) => providerRow(`prov-top-${i}`, `Top ${i}`, { status: positive })),
    ]
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply({ parts: [{ partIndex: 0, picks: [] }] }))
    await service.run('h1', 'u1', 'p1', null)
    const pool: { name: string }[] = JSON.parse(model.mock.calls[1][0].user).parts[0].pool
    expect(pool).toHaveLength(40)
    expect(pool.slice(0, 5).map((entry) => entry.name)).toEqual(['Top 0', 'Top 1', 'Top 2', 'Top 3', 'Top 4'])
    expect(pool.map((entry) => entry.name)).not.toContain('Provider 39')
    expect(savedArgs().create.result.parts[0].poolSize).toBe(40)
  })

  it('retries once on a reply it cannot use', async () => {
    model
      .mockResolvedValueOnce({ text: '## Part 0\n1. Alpha Plumbing', promptTokens: 100, outputTokens: 50 })
      .mockResolvedValueOnce(reply(routingOk))
      .mockResolvedValueOnce(reply(pickingOk))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('ok')
    expect(model).toHaveBeenCalledTimes(3)
    expect(db.aiRequestLog.update.mock.calls[0][0].data).toMatchObject({ promptTokens: 300, outputTokens: 150 })
  })

  it('fails after two bad replies, saves nothing, and returns the previous result', async () => {
    db.projectSuggestion.findUnique.mockResolvedValue({ extraText: null, result: { tooVague: true, parts: [] }, createdAt: new Date('2026-10-01') })
    model.mockResolvedValue({ text: 'not json', promptTokens: null, outputTokens: null })
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(2)
    expect(db.projectSuggestion.upsert).not.toHaveBeenCalled()
    expect(response.suggestion).toMatchObject({ tooVague: true })
    expect(response.fallback).toBeNull()
    expect(db.aiRequestLog.update.mock.calls[0][0].data).toEqual({ outcome: 'failed', durationMs: 0, promptTokens: null, outputTokens: null })
  })

  it('fails when the model call throws, without retrying', async () => {
    model.mockRejectedValue(new Error('Ollama returned HTTP 500'))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(1)
  })

  it('does not start another call once the 45-second deadline has passed', async () => {
    model.mockImplementation(async () => {
      clock += 50_000
      return { text: 'not json', promptTokens: null, outputTokens: null }
    })
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(model).toHaveBeenCalledTimes(1)
    expect(model.mock.calls[0][0].timeoutMs).toBe(45_000)
    expect(db.aiRequestLog.update.mock.calls[0][0].data.durationMs).toBe(50_000)
  })

  it('returns the fallback list for the project category when the ask fails', async () => {
    db.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Water stain', location: null, notes: null, providerCategoryId: PLUMB.id })
    fallbackRows = [beta, alpha]
    model.mockRejectedValue(new Error('timeout'))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.fallback).toMatchObject({ category: PLUMB, searchUrl: 'https://www.google.com/search?q=Plumber%20near%20me' })
    // Beta has no rating and no neighbor recommendation, so the floor leaves it out.
    expect(response.fallback!.providers.map((p) => p.id)).toEqual(['prov-alpha'])
    expect(db.provider.findMany.mock.calls.at(-1)![0].where).toEqual({
      householdId: 'h1',
      metaStatus: 'active',
      status: { kind: { not: 'negative' } },
      categoryId: PLUMB.id,
      projects: { none: { projectId: 'p1' } },
    })
    expect(db.providerCategory.findFirst.mock.calls[0][0].where).toEqual({ id: PLUMB.id, householdId: 'h1' })
  })

  it('still answers when updating the log row fails', async () => {
    db.aiRequestLog.update.mockRejectedValue(new Error('db down'))
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    expect((await service.run('h1', 'u1', 'p1', null)).status).toBe('ok')
  })

  it('never logs the message of an error thrown by the model call', async () => {
    model.mockRejectedValue(new Error('SECRET PROMPT ECHO'))
    const response = await service.run('h1', 'u1', 'p1', 'SECRET EXTRA')
    expect(response.status).toBe('failed')
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).not.toContain('SECRET')
  })

  it('never logs the message of an error thrown by the database inside the ask', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    db.projectSuggestion.upsert.mockRejectedValue(new Error('SECRET ROW DATA'))
    const response = await service.run('h1', 'u1', 'p1', null)
    expect(response.status).toBe('failed')
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).not.toContain('SECRET')
  })

  it('never logs prompt or reply text to the console', async () => {
    model.mockResolvedValue({ text: 'SECRET REPLY TEXT', promptTokens: null, outputTokens: null })
    await service.run('h1', 'u1', 'p1', 'SECRET EXTRA')
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).not.toContain('SECRET')
    expect(logged).not.toContain('Water stain')
  })
})

describe('diagnosing a failed ask without logging any text', () => {
  const errorLog = () => vi.mocked(console.error).mock.calls.flat().join(' ')
  const infoLog = () => vi.mocked(console.info).mock.calls.flat().join(' ')

  it('logs the status when Ollama answers 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'SECRET body' }) }))
    try {
      const real = new ProviderSuggestionService(callOllama, () => clock)
      expect((await real.run('h1', 'u1', 'p1', 'SECRET EXTRA')).status).toBe('failed')
    } finally {
      vi.unstubAllGlobals()
    }
    expect(errorLog()).toContain('Ollama returned HTTP 404')
    expect(errorLog()).not.toContain('SECRET')
    expect(errorLog()).not.toContain('Bearer')
  })

  it('logs the fixed text of a ModelCallError', async () => {
    model.mockRejectedValue(new ModelCallError('Ollama reply was not JSON'))
    await service.run('h1', 'u1', 'p1', null)
    expect(errorLog()).toContain('Ollama reply was not JSON')
  })

  it('logs only the name of another error type, never its message', async () => {
    model.mockRejectedValue(new TypeError('SECRET invalid header value Bearer abc'))
    await service.run('h1', 'u1', 'p1', null)
    expect(errorLog()).toContain('TypeError')
    expect(errorLog()).not.toContain('SECRET')
    expect(errorLog()).not.toContain('Bearer')
  })

  it('logs the name and string code of a database error, never its message', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    db.projectSuggestion.upsert.mockRejectedValue(Object.assign(new Error('SECRET ROW DATA'), { name: 'PrismaClientKnownRequestError', code: 'P2021' }))
    await service.run('h1', 'u1', 'p1', null)
    expect(errorLog()).toContain('PrismaClientKnownRequestError P2021')
    expect(errorLog()).not.toContain('SECRET')
  })

  it('ignores a code that is not a string', async () => {
    model.mockRejectedValue(Object.assign(new Error('SECRET'), { code: { nested: 'SECRET' } }))
    await service.run('h1', 'u1', 'p1', null)
    expect(errorLog()).not.toContain('SECRET')
  })

  it('logs one line of numbers per ask: status, time, prompt sizes and pool sizes', async () => {
    model.mockResolvedValueOnce(reply(routingOk)).mockResolvedValueOnce(reply(pickingOk))
    await service.run('h1', 'u1', 'p1', 'SECRET EXTRA')
    const routingChars = model.mock.calls[0][0].system.length + model.mock.calls[0][0].user.length
    const pickingChars = model.mock.calls[1][0].system.length + model.mock.calls[1][0].user.length
    expect(vi.mocked(console.info).mock.calls).toEqual([[`[suggestions] ok in 0 ms; routing ${routingChars} chars; picking ${pickingChars} chars; pools 2`]])
    expect(infoLog()).not.toContain('SECRET')
  })

  it('logs the line for a failed ask too, with 0 for a prompt that was never built', async () => {
    db.providerCategory.findMany.mockRejectedValue(new Error('db down'))
    await service.run('h1', 'u1', 'p1', null)
    expect(vi.mocked(console.info).mock.calls).toEqual([['[suggestions] failed in 0 ms; routing 0 chars; picking 0 chars; pools -']])
  })

  it('lists the pool size of every part, including a part with no category', async () => {
    model.mockResolvedValueOnce(reply({
      tooVague: false,
      parts: [
        { name: 'Fix the leak', categoryId: 'c1', why: 'It leaks.', searchPhrase: 'leak plumber' },
        { name: 'Rebuild the chimney', categoryId: null, why: 'Masonry.', searchPhrase: 'chimney mason' },
      ],
    })).mockResolvedValueOnce(reply({ parts: [{ partIndex: 0, picks: [] }] }))
    await service.run('h1', 'u1', 'p1', null)
    expect(infoLog()).toMatch(/pools 2,0$/)
  })
})
