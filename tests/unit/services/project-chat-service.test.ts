import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    project: { findFirst: vi.fn() },
    projectStep: { findMany: vi.fn() },
    projectProvider: { findMany: vi.fn() },
    projectSuggestion: { findUnique: vi.fn() },
    projectPlan: { findUnique: vi.fn() },
    projectChatMessage: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    aiRequestLog: { create: vi.fn(), update: vi.fn() },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { ProjectChatService } from '@/server/services/ProjectChatService'
import { ModelCallError } from '@/server/utils/ollama'

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const T0 = Date.UTC(2026, 9, 8, 15)
const at = (offsetMs: number) => new Date(T0 + offsetMs)
const userRow = (over: Record<string, unknown> = {}) => ({ id: 'm1', projectId: 'p1', role: 'user', content: 'It will not budge', createdById: 'u1', searches: [], failedAt: null, createdAt: at(-1000), ...over })
const assistantRow = (over: Record<string, unknown> = {}) => ({ id: 'm2', projectId: 'p1', role: 'assistant', content: 'Use the puller.', createdById: 'u1', searches: ['moen 1225'], failedAt: null, createdAt: at(-500), ...over })
const textReply = (t: string) => ({ text: t, toolCalls: [], promptTokens: 100, outputTokens: 50 })

let chat: ReturnType<typeof vi.fn>
let search: ReturnType<typeof vi.fn>
let clock: number
let service: ProjectChatService

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.stubEnv('OLLAMA_API_KEY', 'k')
  vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
  vi.stubEnv('AI_CHAT_MODEL', '')
  clock = T0
  chat = vi.fn().mockResolvedValue(textReply('Use the puller.'))
  search = vi.fn().mockResolvedValue([])
  service = new ProjectChatService(chat, search, () => clock)
  db.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Faucet drips', location: 'Kitchen', notes: 'Moen. Call 555-123-4567.', status: 'active', path: 'diy' })
  db.projectStep.findMany.mockResolvedValue([{ text: 'Turn off water', doneAt: at(-90_000), estimateMinutes: 5 }])
  db.projectProvider.findMany.mockResolvedValue([{ status: 'contacted', provider: { name: 'Alpha Plumbing', phone: '555-000-0000', category: { name: 'Plumbing' } } }])
  db.projectSuggestion.findUnique.mockResolvedValue(null)
  db.projectPlan.findUnique.mockResolvedValue(null)
  db.projectChatMessage.findMany.mockResolvedValue([])
  db.projectChatMessage.findFirst.mockResolvedValue(null)
  db.projectChatMessage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: data.role === 'user' ? 'new-user' : 'new-assistant', failedAt: null, createdAt: at(0), ...data }))
  db.projectChatMessage.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...userRow(), ...data }))
  db.aiRequestLog.create.mockResolvedValue({ id: 'log1' })
  db.aiRequestLog.update.mockResolvedValue({})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const created = (role: string) => db.projectChatMessage.create.mock.calls.map((c) => c[0].data).find((d) => d.role === role)
const sentMessages = () => chat.mock.calls[0][0].messages as { role: string; content: string }[]

describe('getState', () => {
  it('returns 404 for a project in another household or a deleted one', async () => {
    db.project.findFirst.mockResolvedValue(null)
    await expect(service.getState('h1', 'u1', 'p1')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', householdId: 'h1', metaStatus: 'active' })
  })
  it('reports not enabled for an unlisted household and reads nothing else', async () => {
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'other')
    expect(await service.getState('h1', 'u1', 'p1')).toEqual({ enabled: false, messages: [], pending: false })
    expect(db.projectChatMessage.findMany).not.toHaveBeenCalled()
  })
  it('returns the newest 500 rows oldest first as DTOs with mine and failed', async () => {
    db.projectChatMessage.findMany.mockResolvedValue([assistantRow(), userRow()])
    const state = await service.getState('h1', 'u2', 'p1')
    expect(db.projectChatMessage.findMany.mock.calls[0][0]).toMatchObject({ where: { projectId: 'p1' }, orderBy: { createdAt: 'desc' }, take: 500 })
    expect(state.messages).toEqual([
      { id: 'm1', role: 'user', content: 'It will not budge', mine: false, failed: false, searches: [], createdAt: at(-1000).toISOString() },
      { id: 'm2', role: 'assistant', content: 'Use the puller.', mine: false, failed: false, searches: ['moen 1225'], createdAt: at(-500).toISOString() },
    ])
    expect(state.pending).toBe(false)
    expect((await service.getState('h1', 'u1', 'p1')).messages[0].mine).toBe(true)
  })
  it('is pending while the last row is a fresh unanswered user row, and not once it failed or aged past 75 s', async () => {
    db.projectChatMessage.findMany.mockResolvedValue([userRow()])
    expect((await service.getState('h1', 'u1', 'p1')).pending).toBe(true)
    db.projectChatMessage.findMany.mockResolvedValue([userRow({ failedAt: at(-200) })])
    const failed = await service.getState('h1', 'u1', 'p1')
    expect(failed.pending).toBe(false)
    expect(failed.messages[0].failed).toBe(true)
    db.projectChatMessage.findMany.mockResolvedValue([userRow({ createdAt: at(-75_000) })])
    expect((await service.getState('h1', 'u1', 'p1')).pending).toBe(false)
  })
  it('treats unreadable searches as none', async () => {
    db.projectChatMessage.findMany.mockResolvedValue([assistantRow({ searches: { bad: true } })])
    expect((await service.getState('h1', 'u1', 'p1')).messages[0].searches).toEqual([])
  })
})

describe('send', () => {
  it('returns 403 for an unlisted household without saving or logging', async () => {
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'other')
    await expect(service.send('h1', 'u1', 'p1', { text: 'hi' })).rejects.toMatchObject({ statusCode: 403, message: 'Suggestions are not available' })
    expect(db.projectChatMessage.create).not.toHaveBeenCalled()
    expect(db.aiRequestLog.create).not.toHaveBeenCalled()
  })
  it('saves the user row first, then the log row, then calls the model with the project and the history', async () => {
    // The query returns newest first; the service reverses it.
    db.projectChatMessage.findMany.mockResolvedValue([assistantRow({ createdAt: at(-4000) }), userRow({ id: 'old', content: 'Handle is off', createdAt: at(-5000) })])
    const result = await service.send('h1', 'u1', 'p1', { text: 'It spins' })
    expect(created('user')).toEqual({ projectId: 'p1', role: 'user', content: 'It spins', createdById: 'u1' })
    const order = [db.projectChatMessage.create.mock.invocationCallOrder[0], db.aiRequestLog.create.mock.invocationCallOrder[0], chat.mock.invocationCallOrder[0]]
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(db.aiRequestLog.create.mock.calls[0][0].data).toEqual({ householdId: 'h1', userId: 'u1', feature: 'project_chat', model: 'glm-5.3', outcome: 'started' })
    const sent = sentMessages()
    expect(sent[0].role).toBe('system')
    expect(sent[0].content).toContain('Title: Faucet drips')
    expect(sent[0].content).toContain('- Alpha Plumbing (Plumbing): contacted')
    expect(sent[0].content).not.toContain('555-')
    expect(sent.slice(1)).toEqual([{ role: 'user', content: 'Handle is off' }, { role: 'assistant', content: 'Use the puller.' }])
    expect(db.projectChatMessage.findMany.mock.calls[0][0]).toMatchObject({ where: { projectId: 'p1' }, orderBy: { createdAt: 'desc' }, take: 200 })
    expect(result.userMessage).toMatchObject({ id: 'new-user', role: 'user', content: 'It spins', mine: true, failed: false })
    expect(result.assistantMessage).toMatchObject({ id: 'new-assistant', role: 'assistant', content: 'Use the puller.', mine: false, searches: [] })
  })
  it('reads the history after saving the user row so the new message is the last turn', async () => {
    let saved = false
    db.projectChatMessage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { if (data.role === 'user') saved = true; return { id: 'x', failedAt: null, createdAt: at(0), ...data } })
    db.projectChatMessage.findMany.mockImplementation(async () => (saved ? [userRow({ content: 'It spins', createdAt: at(0) })] : []))
    await service.send('h1', 'u1', 'p1', { text: 'It spins' })
    expect(sentMessages().at(-1)).toEqual({ role: 'user', content: 'It spins' })
  })
  it('saves the reply with its searches, model, duration and tokens, and finishes the log ok', async () => {
    chat.mockResolvedValueOnce({ text: '', toolCalls: [{ function: { name: 'web_search', arguments: { query: 'moen 1225 stuck' } } }], promptTokens: 100, outputTokens: 10 })
      .mockImplementationOnce(async () => { clock += 6000; return textReply('Use the puller; see Moen.') })
    await service.send('h1', 'u1', 'p1', { text: 'It spins' })
    expect(created('assistant')).toEqual({ projectId: 'p1', role: 'assistant', content: 'Use the puller; see Moen.', createdById: 'u1', searches: ['moen 1225 stuck'], model: 'glm-5.3', durationMs: 6000, promptTokens: 200, outputTokens: 60 })
    expect(db.aiRequestLog.update.mock.calls[0][0]).toEqual({ where: { id: 'log1' }, data: { outcome: 'ok', durationMs: 6000, promptTokens: 200, outputTokens: 60 } })
  })
  it('cuts a reply over 8000 characters before saving', async () => {
    chat.mockResolvedValue(textReply('y'.repeat(9000)))
    const result = await service.send('h1', 'u1', 'p1', { text: 'hi' })
    expect(created('assistant').content).toHaveLength(8000)
    expect(result.assistantMessage.content).toHaveLength(8000)
  })
  it('on a model failure marks the user row failed, logs failed, saves no reply, and answers 502', async () => {
    chat.mockRejectedValue(new ModelCallError('Ollama returned HTTP 500'))
    await expect(service.send('h1', 'u1', 'p1', { text: 'hi' })).rejects.toMatchObject({ statusCode: 502, message: "Couldn't get a reply. Try again." })
    expect(created('assistant')).toBeUndefined()
    expect(db.projectChatMessage.update.mock.calls[0][0]).toEqual({ where: { id: 'new-user' }, data: { failedAt: at(0) } })
    expect(db.aiRequestLog.update.mock.calls[0][0].data).toMatchObject({ outcome: 'failed' })
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe('[chat] ask failed: Ollama returned HTTP 500')
  })
  it('a context read that fails also fails the ask cleanly', async () => {
    db.projectStep.findMany.mockRejectedValue(new Error('db down with secret'))
    await expect(service.send('h1', 'u1', 'p1', { text: 'hi' })).rejects.toMatchObject({ statusCode: 502 })
    expect(chat).not.toHaveBeenCalled()
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe('[chat] ask failed: Error')
  })
  it('answers 409 while the last row is a fresh unanswered user row', async () => {
    db.projectChatMessage.findFirst.mockResolvedValue(userRow({ createdAt: at(-30_000) }))
    await expect(service.send('h1', 'u2', 'p1', { text: 'me too' })).rejects.toMatchObject({ statusCode: 409, message: 'A reply is on its way' })
    expect(db.projectChatMessage.create).not.toHaveBeenCalled()
  })
  it('lets a plain send through when the last user row failed or is older than 75 s', async () => {
    db.projectChatMessage.findFirst.mockResolvedValue(userRow({ failedAt: at(-100) }))
    await expect(service.send('h1', 'u2', 'p1', { text: 'me too' })).resolves.toBeDefined()
    db.projectChatMessage.findFirst.mockResolvedValue(userRow({ createdAt: at(-75_000) }))
    await expect(service.send('h1', 'u2', 'p1', { text: 'again' })).resolves.toBeDefined()
    expect(db.projectChatMessage.create.mock.calls.filter((c) => c[0].data.role === 'user')).toHaveLength(2)
  })
  it('retry answers the failed row by refreshing it instead of creating a new one', async () => {
    db.projectChatMessage.findFirst.mockResolvedValue(userRow({ failedAt: at(-100), createdAt: at(-9000) }))
    const result = await service.send('h1', 'u2', 'p1', { retry: true })
    expect(created('user')).toBeUndefined()
    expect(db.projectChatMessage.update.mock.calls[0][0]).toMatchObject({ where: { id: 'm1' }, data: { failedAt: null, createdAt: at(0) } })
    expect(result.userMessage).toMatchObject({ id: 'm1', content: 'It will not budge', mine: false })
    expect(created('assistant')).toMatchObject({ createdById: 'u1' })
  })
  it('retry also answers an unanswered row older than 75 s, and refuses a fresh one or none', async () => {
    db.projectChatMessage.findFirst.mockResolvedValue(userRow({ createdAt: at(-80_000) }))
    await expect(service.send('h1', 'u1', 'p1', { retry: true })).resolves.toBeDefined()
    db.projectChatMessage.findFirst.mockResolvedValue(userRow({ createdAt: at(-10_000) }))
    await expect(service.send('h1', 'u1', 'p1', { retry: true })).rejects.toMatchObject({ statusCode: 409 })
    db.projectChatMessage.findFirst.mockResolvedValue(assistantRow())
    await expect(service.send('h1', 'u1', 'p1', { retry: true })).rejects.toMatchObject({ statusCode: 400, message: 'Nothing to retry' })
    db.projectChatMessage.findFirst.mockResolvedValue(null)
    await expect(service.send('h1', 'u1', 'p1', { retry: true })).rejects.toMatchObject({ statusCode: 400, message: 'Nothing to retry' })
  })
  it('passes the saved plan and the suggestion trades into the prompt, never the picks', async () => {
    db.projectPlan.findUnique.mockResolvedValue({ result: { tooVague: false, summary: { totalMinutes: 30, costLow: 0, costHigh: 20, difficulty: 'easy', why: 'Simple.' }, safety: null, steps: [], tools: [], materials: [] } })
    db.projectSuggestion.findUnique.mockResolvedValue({ result: { tooVague: false, parts: [{ name: 'Plumber', why: 'Leaks.', categoryId: 'c1', searchPhrase: 'x near me', poolSize: 1, picks: [{ providerId: 'prov-9', reason: 'Zeta Plumbing rocks' }] }] } })
    await service.send('h1', 'u1', 'p1', { text: 'hi' })
    const system = sentMessages()[0].content
    expect(system).toContain('Saved DIY plan: Easy, about 30 min, $0 to $20 (estimates). Why: Simple.')
    expect(system).toContain('Kinds of contractor they might search for: Plumber')
    expect(system).not.toContain('Zeta')
    expect(system).not.toContain('prov-9')
  })
  it('logs numbers only on success', async () => {
    await service.send('h1', 'u1', 'p1', { text: 'hi' })
    const line = vi.mocked(console.info).mock.calls[0][0] as string
    expect(line).toMatch(/^\[chat\] ok in \d+ ms; prompt \d+ chars; history \d+; searches 0$/)
  })
  it('uses the chat model setting', async () => {
    vi.stubEnv('AI_CHAT_MODEL', 'glm-5.4')
    await service.send('h1', 'u1', 'p1', { text: 'hi' })
    expect(chat.mock.calls[0][0].model).toBe('glm-5.4')
    expect(created('assistant').model).toBe('glm-5.4')
  })
  it('returns 404 before anything else for an unknown project', async () => {
    db.project.findFirst.mockResolvedValue(null)
    await expect(service.send('h1', 'u1', 'p1', { text: 'hi' })).rejects.toMatchObject({ statusCode: 404 })
    expect(db.projectChatMessage.create).not.toHaveBeenCalled()
  })
})
