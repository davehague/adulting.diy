import { describe, it, expect } from 'vitest'
import {
  parseModelJson, routingReplySchema, pickingReplySchema, savedResultSchema, suggestionRequestSchema,
} from '@/server/utils/suggestion-schemas'

describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 })
  })
  it('parses JSON wrapped in a code fence', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('parses JSON with prose before and after', () => {
    expect(parseModelJson('Here you go:\n{"a":{"b":2}}\nHope that helps.')).toEqual({ a: { b: 2 } })
  })
  it('throws on prose with no object', () => {
    expect(() => parseModelJson('## Part 0\n1. Miller Plumbing')).toThrow()
  })
  it('throws on a broken object', () => {
    expect(() => parseModelJson('{"a": 1,')).toThrow()
  })
})

describe('routingReplySchema', () => {
  const part = { name: 'Fix the leak', categoryId: 'c1', why: 'Because.', searchPhrase: 'leak plumber near me' }
  it('accepts a valid reply and a null category', () => {
    expect(routingReplySchema.safeParse({ tooVague: false, parts: [part, { ...part, categoryId: null }] }).success).toBe(true)
  })
  it('rejects renamed or missing fields', () => {
    expect(routingReplySchema.safeParse({ tooVague: false, parts: [{ name: 'x', why: 'y', search: 'z' }] }).success).toBe(false)
  })
  it('rejects an empty name', () => {
    expect(routingReplySchema.safeParse({ tooVague: false, parts: [{ ...part, name: '  ' }] }).success).toBe(false)
  })
  it('rejects a missing tooVague', () => {
    expect(routingReplySchema.safeParse({ parts: [] }).success).toBe(false)
  })
  it('accepts a too-vague reply that leaves out parts', () => {
    const result = routingReplySchema.safeParse({ tooVague: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ tooVague: true, parts: [] })
  })
  it('turns a part with no categoryId into a null category', () => {
    const { categoryId: _omitted, ...withoutCategory } = part
    const result = routingReplySchema.safeParse({ tooVague: false, parts: [withoutCategory] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.parts[0].categoryId).toBeNull()
  })
  it('still rejects parts without tooVague, even when parts is empty', () => {
    expect(routingReplySchema.safeParse({ parts: [] }).success).toBe(false)
    expect(routingReplySchema.safeParse({ parts: [part] }).success).toBe(false)
  })
})

describe('pickingReplySchema', () => {
  it('accepts picks and empty picks', () => {
    const reply = { parts: [{ partIndex: 0, picks: [{ providerId: 'p1', reason: 'Good.' }] }, { partIndex: 1, picks: [] }] }
    expect(pickingReplySchema.safeParse(reply).success).toBe(true)
  })
  it('rejects a pick without a reason', () => {
    expect(pickingReplySchema.safeParse({ parts: [{ partIndex: 0, picks: [{ providerId: 'p1', reason: '' }] }] }).success).toBe(false)
  })
  it('rejects a non-integer part index', () => {
    expect(pickingReplySchema.safeParse({ parts: [{ partIndex: 'zero', picks: [] }] }).success).toBe(false)
  })
})

describe('savedResultSchema', () => {
  it('accepts what the service saves', () => {
    const saved = { tooVague: false, parts: [{ name: 'n', why: 'w', categoryId: null, searchPhrase: 's near me', poolSize: 0, picks: [] }] }
    expect(savedResultSchema.safeParse(saved).success).toBe(true)
  })
  it('rejects a shape it does not know', () => {
    expect(savedResultSchema.safeParse({ version: 2, trades: [] }).success).toBe(false)
  })
})

describe('suggestionRequestSchema', () => {
  it('trims the text and turns blank into null', () => {
    expect(suggestionRequestSchema.parse({ extraText: '  before Thanksgiving ' })).toEqual({ extraText: 'before Thanksgiving' })
    expect(suggestionRequestSchema.parse({ extraText: '   ' })).toEqual({ extraText: null })
    expect(suggestionRequestSchema.parse({})).toEqual({ extraText: null })
  })
  it('rejects more than 500 characters with the message', () => {
    const result = suggestionRequestSchema.safeParse({ extraText: 'x'.repeat(501) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Anything to add must be 500 characters or fewer')
  })
})
