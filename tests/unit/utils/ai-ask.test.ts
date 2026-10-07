import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

vi.mock('@/server/utils/prisma/client', () => ({ default: { aiRequestLog: { count: vi.fn() } } }))

import prisma from '@/server/utils/prisma/client'
import { askJson, asksInLastDay, describeError, AskError } from '@/server/utils/ai-ask'
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
  it('counts every feature for the household in the last 24 hours', async () => {
    db.aiRequestLog.count.mockResolvedValue(7)
    const clock = Date.UTC(2026, 9, 6, 12)
    expect(await asksInLastDay('h1', () => clock)).toBe(7)
    expect(db.aiRequestLog.count.mock.calls[0][0]).toEqual({ where: { householdId: 'h1', createdAt: { gte: new Date(clock - 24 * 60 * 60 * 1000) } } })
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
