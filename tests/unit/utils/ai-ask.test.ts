import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

vi.mock('@/server/utils/prisma/client', () => ({ default: { aiRequestLog: { count: vi.fn() } } }))

import prisma from '@/server/utils/prisma/client'
import { askJson, askChat, SEARCH_LIMIT_MESSAGE, asksInLastDay, CAPPED_AI_FEATURES, describeError, AskError } from '@/server/utils/ai-ask'
import { ModelCallError } from '@/server/utils/ollama'

const db = prisma as unknown as { aiRequestLog: { count: ReturnType<typeof vi.fn> } }
const schema = z.object({ a: z.number() })
const prompt = { system: 'sys', user: 'usr' }
const reply = (text: string) => ({ text, promptTokens: 10, outputTokens: 5 })

describe('askJson', () => {
  let clock: number
  const now = () => clock
  beforeEach(() => { clock = 1_000_000 })

  it('returns the validated reply and sums usage', async () => {
    const call = vi.fn().mockResolvedValue(reply('{"a":1}'))
    const usage = { promptTokens: 0, outputTokens: 0, reported: false }
    expect(await askJson(call, now, prompt, schema, 'm', clock + 45_000, usage)).toEqual({ a: 1 })
    expect(usage).toEqual({ promptTokens: 10, outputTokens: 5, reported: true })
    expect(call.mock.calls[0][0]).toEqual({ model: 'm', system: 'sys', user: 'usr', timeoutMs: 45_000 })
  })
  it('retries once on a reply that cannot be used, then throws AskError', async () => {
    const call = vi.fn().mockResolvedValueOnce(reply('nope')).mockResolvedValueOnce(reply('{"a":"x"}'))
    await expect(askJson(call, now, prompt, schema, 'm', clock + 45_000, { promptTokens: 0, outputTokens: 0, reported: false })).rejects.toBeInstanceOf(AskError)
    expect(call).toHaveBeenCalledTimes(2)
  })
  it('accepts a fenced reply on the second try', async () => {
    const call = vi.fn().mockResolvedValueOnce(reply('nope')).mockResolvedValueOnce(reply('```json\n{"a":2}\n```'))
    expect(await askJson(call, now, prompt, schema, 'm', clock + 45_000, { promptTokens: 0, outputTokens: 0, reported: false })).toEqual({ a: 2 })
  })
  it('does not start a call with less than two seconds left', async () => {
    const call = vi.fn().mockImplementation(async () => { clock += 50_000; return reply('nope') })
    await expect(askJson(call, now, prompt, schema, 'm', clock + 45_000, { promptTokens: 0, outputTokens: 0, reported: false })).rejects.toBeInstanceOf(AskError)
    expect(call).toHaveBeenCalledTimes(1)
  })
  it('lets a thrown model error through untouched', async () => {
    const call = vi.fn().mockRejectedValue(new ModelCallError('Ollama returned HTTP 500'))
    await expect(askJson(call, now, prompt, schema, 'm', clock + 45_000, { promptTokens: 0, outputTokens: 0, reported: false })).rejects.toBeInstanceOf(ModelCallError)
  })
})

describe('asksInLastDay', () => {
  it('counts only the named features for the household in the last 24 hours', async () => {
    db.aiRequestLog.count.mockResolvedValue(7)
    const clock = Date.UTC(2026, 9, 6, 12)
    expect(await asksInLastDay('h1', ['provider_suggestions', 'diy_plan'], () => clock)).toBe(7)
    expect(db.aiRequestLog.count.mock.calls[0][0]).toEqual({
      where: { householdId: 'h1', feature: { in: ['provider_suggestions', 'diy_plan'] }, createdAt: { gte: new Date(clock - 24 * 60 * 60 * 1000) } },
    })
  })
  it('CAPPED_AI_FEATURES names suggestions and plans and not chat', () => {
    expect(CAPPED_AI_FEATURES).toEqual(['provider_suggestions', 'diy_plan'])
  })
})

describe('describeError', () => {
  it('uses the message only for this feature\'s own errors', () => {
    expect(describeError(new AskError('no usable reply'))).toBe('no usable reply')
    expect(describeError(new ModelCallError('Ollama returned HTTP 404'))).toBe('Ollama returned HTTP 404')
    expect(describeError(new Error('SECRET'))).toBe('Error')
    expect(describeError(Object.assign(new Error('SECRET'), { name: 'PrismaClientKnownRequestError', code: 'P2002' }))).toBe('PrismaClientKnownRequestError P2002')
    expect(describeError('string')).toBe('unknown')
  })
})

describe('askChat', () => {
  let clock: number
  const now = () => clock
  const tools = [{ type: 'function' as const, function: { name: 'web_search', description: 'd', parameters: {} } }]
  const context = () => ({ messages: [{ role: 'system' as const, content: 'sys' }, { role: 'user' as const, content: 'q' }], tools })
  const usage = () => ({ promptTokens: 0, outputTokens: 0, reported: false })
  const text = (t: string) => ({ text: t, toolCalls: [], promptTokens: 10, outputTokens: 5 })
  const toolCall = (query: unknown, name = 'web_search') => ({ text: '', toolCalls: [{ function: { name, arguments: { query } } }], promptTokens: 10, outputTokens: 5 })
  const results = [{ title: 'T', url: 'https://x.y', content: 'c' }]
  beforeEach(() => { clock = 1_000_000 })

  it('returns the text and no searches on a plain reply', async () => {
    const call = vi.fn().mockResolvedValue(text('Hello'))
    const search = vi.fn()
    const u = usage()
    expect(await askChat(call, search, now, context(), 'm', clock + 60_000, u)).toEqual({ text: 'Hello', searches: [] })
    expect(search).not.toHaveBeenCalled()
    expect(call.mock.calls[0][0]).toEqual({ model: 'm', messages: context().messages, tools, timeoutMs: 60_000 })
    expect(u).toEqual({ promptTokens: 10, outputTokens: 5, reported: true })
  })
  it('runs a search the model asks for and sends the tool turn back in the service shape', async () => {
    const call = vi.fn().mockResolvedValueOnce(toolCall('moen 1225')).mockResolvedValueOnce(text('Use the puller.'))
    const search = vi.fn().mockResolvedValue(results)
    const result = await askChat(call, search, now, context(), 'm', clock + 60_000, usage())
    expect(result).toEqual({ text: 'Use the puller.', searches: ['moen 1225'] })
    expect(search).toHaveBeenCalledWith('moen 1225', 10_000)
    expect(call.mock.calls[1][0].messages).toEqual([
      ...context().messages,
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'web_search', arguments: { query: 'moen 1225' } } }] },
      { role: 'tool', tool_name: 'web_search', content: JSON.stringify(results) },
    ])
  })
  it('masks contact details in the query and cuts it to 200 characters before searching', async () => {
    const long = 'call 555-123-4567 about ' + 'x'.repeat(300)
    const call = vi.fn().mockResolvedValueOnce(toolCall(long)).mockResolvedValueOnce(text('ok'))
    const search = vi.fn().mockResolvedValue([])
    const result = await askChat(call, search, now, context(), 'm', clock + 60_000, usage())
    expect(search.mock.calls[0][0]).toBe(('call [phone] about ' + 'x'.repeat(300)).slice(0, 200))
    expect(result.searches).toEqual([search.mock.calls[0][0]])
  })
  it('gives the search at most 10 seconds or the time left, whichever is less', async () => {
    const call = vi.fn().mockImplementation(async () => { clock += 55_000; return call.mock.calls.length === 1 ? toolCall('q') : text('ok') })
    const search = vi.fn().mockResolvedValue([])
    await askChat(call, search, now, context(), 'm', clock + 60_000, usage())
    expect(search.mock.calls[0][1]).toBe(5_000)
  })
  it('answers a failed search with an error result and goes on', async () => {
    const call = vi.fn().mockResolvedValueOnce(toolCall('q')).mockResolvedValueOnce(text('ok'))
    const search = vi.fn().mockRejectedValue(new ModelCallError('Ollama search returned HTTP 500'))
    expect(await askChat(call, search, now, context(), 'm', clock + 60_000, usage())).toEqual({ text: 'ok', searches: ['q'] })
    expect(call.mock.calls[1][0].messages.at(-1)).toEqual({ role: 'tool', tool_name: 'web_search', content: JSON.stringify({ error: 'search failed' }) })
  })
  it('answers an unknown tool or a missing query without searching', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ text: '', toolCalls: [{ function: { name: 'other', arguments: { query: 'q' } } }, { function: { name: 'web_search', arguments: {} } }], promptTokens: null, outputTokens: null })
      .mockResolvedValueOnce(text('ok'))
    const search = vi.fn()
    expect(await askChat(call, search, now, context(), 'm', clock + 60_000, usage())).toEqual({ text: 'ok', searches: [] })
    expect(search).not.toHaveBeenCalled()
    const sent = call.mock.calls[1][0].messages
    expect(sent.at(-2)).toEqual({ role: 'tool', tool_name: 'other', content: JSON.stringify({ error: 'unknown tool or missing query' }) })
    expect(sent.at(-1)).toEqual({ role: 'tool', tool_name: 'web_search', content: JSON.stringify({ error: 'unknown tool or missing query' }) })
  })
  it('stops at three searches across rounds and tells the model, then takes its text', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ text: '', toolCalls: [{ function: { name: 'web_search', arguments: { query: 'a' } } }, { function: { name: 'web_search', arguments: { query: 'b' } } }], promptTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce(toolCall('c'))
      .mockResolvedValueOnce(toolCall('d'))
      .mockResolvedValueOnce(text('done'))
    const search = vi.fn().mockResolvedValue([])
    expect(await askChat(call, search, now, context(), 'm', clock + 60_000, usage())).toEqual({ text: 'done', searches: ['a', 'b', 'c'] })
    expect(search).toHaveBeenCalledTimes(3)
    expect(call.mock.calls[3][0].messages.at(-1)).toEqual({ role: 'tool', tool_name: 'web_search', content: SEARCH_LIMIT_MESSAGE })
  })
  it('fails when the model still asks for a search after the limit message', async () => {
    const call = vi.fn().mockResolvedValue(toolCall('again'))
    const search = vi.fn().mockResolvedValue([])
    await expect(askChat(call, search, now, context(), 'm', clock + 60_000, usage())).rejects.toBeInstanceOf(AskError)
    expect(search).toHaveBeenCalledTimes(3)
    expect(call).toHaveBeenCalledTimes(5)
  })
  it('stops as soon as the model asks again after the limit message', async () => {
    const three = { text: '', toolCalls: ['a', 'b', 'c'].map((query) => ({ function: { name: 'web_search', arguments: { query } } })), promptTokens: 1, outputTokens: 1 }
    const call = vi.fn().mockResolvedValueOnce(three).mockResolvedValueOnce(toolCall('d')).mockResolvedValueOnce(toolCall('e'))
    const search = vi.fn().mockResolvedValue([])
    await expect(askChat(call, search, now, context(), 'm', clock + 60_000, usage())).rejects.toThrow('the model kept asking for tools')
    expect(call).toHaveBeenCalledTimes(3)
    expect(search).toHaveBeenCalledTimes(3)
  })
  it('does not run tools on the last round', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(toolCall('a'))
      .mockResolvedValueOnce(toolCall('b'))
      .mockResolvedValueOnce(toolCall('c'))
      .mockResolvedValueOnce(toolCall('d'))
      .mockResolvedValueOnce(toolCall('e'))
    const search = vi.fn().mockResolvedValue([])
    await expect(askChat(call, search, now, context(), 'm', clock + 60_000, usage())).rejects.toBeInstanceOf(AskError)
    expect(search).toHaveBeenCalledTimes(3)
    expect(call).toHaveBeenCalledTimes(5)
  })
  it('does not run a search on the last round even when the cap was never reached', async () => {
    const other = (query: string) => toolCall(query, 'other')
    const call = vi.fn()
      .mockResolvedValueOnce(other('a'))
      .mockResolvedValueOnce(other('b'))
      .mockResolvedValueOnce(other('c'))
      .mockResolvedValueOnce(other('d'))
      .mockResolvedValueOnce(toolCall('e'))
    const search = vi.fn().mockResolvedValue([])
    await expect(askChat(call, search, now, context(), 'm', clock + 60_000, usage())).rejects.toBeInstanceOf(AskError)
    expect(search).not.toHaveBeenCalled()
    expect(call).toHaveBeenCalledTimes(5)
  })
  it('skips a search with under a second left', async () => {
    const call = vi.fn().mockImplementation(async () => { clock += 59_500; return toolCall('q') })
    const search = vi.fn()
    // With 500 ms left the next call cannot start either (it needs two seconds), so the ask ends; the skipped search is seen in what would have gone back to the model.
    await expect(askChat(call, search, now, context(), 'm', clock + 60_000, usage())).rejects.toBeInstanceOf(AskError)
    expect(search).not.toHaveBeenCalled()
    expect(call).toHaveBeenCalledTimes(1)
    expect(call.mock.calls[0][0].messages.at(-1)).toEqual({ role: 'tool', tool_name: 'web_search', content: JSON.stringify({ error: 'search failed' }) })
  })
  it('sums usage across rounds', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ ...toolCall('q'), promptTokens: 10, outputTokens: 5 })
      .mockResolvedValueOnce({ ...text('done'), promptTokens: 20, outputTokens: 7 })
    const u = usage()
    await askChat(call, vi.fn().mockResolvedValue([]), now, context(), 'm', clock + 60_000, u)
    expect(u).toEqual({ promptTokens: 30, outputTokens: 12, reported: true })
  })
  it('a slow search eats into the next call\'s time', async () => {
    const call = vi.fn().mockResolvedValueOnce(toolCall('q')).mockResolvedValueOnce(text('ok'))
    const search = vi.fn().mockImplementation(async () => { clock += 9_000; return [] })
    await askChat(call, search, now, context(), 'm', clock + 60_000, usage())
    expect(call.mock.calls[0][0].timeoutMs).toBe(60_000)
    expect(call.mock.calls[1][0].timeoutMs).toBe(51_000)
  })
  it('fails on an empty reply', async () => {
    const call = vi.fn().mockResolvedValue(text('  \n'))
    await expect(askChat(call, vi.fn(), now, context(), 'm', clock + 60_000, usage())).rejects.toBeInstanceOf(AskError)
  })
  it('does not start a call with less than two seconds left', async () => {
    const call = vi.fn().mockImplementation(async () => { clock += 59_000; return toolCall('q') })
    await expect(askChat(call, vi.fn().mockResolvedValue([]), now, context(), 'm', clock + 60_000, usage())).rejects.toBeInstanceOf(AskError)
    expect(call).toHaveBeenCalledTimes(1)
  })
  it('lets a thrown model error through untouched', async () => {
    const call = vi.fn().mockRejectedValue(new ModelCallError('Ollama returned HTTP 500'))
    await expect(askChat(call, vi.fn(), now, context(), 'm', clock + 60_000, usage())).rejects.toBeInstanceOf(ModelCallError)
  })
})
