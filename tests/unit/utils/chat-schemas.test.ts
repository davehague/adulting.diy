import { describe, it, expect } from 'vitest'
import { parseChatSendInput } from '@/server/utils/chat-schemas'

describe('parseChatSendInput', () => {
  it('returns the trimmed text', () => {
    expect(parseChatSendInput({ text: '  hello  ' })).toEqual({ text: 'hello' })
  })
  it('returns a retry when retry is exactly true, ignoring any text', () => {
    expect(parseChatSendInput({ retry: true, text: 'x' })).toEqual({ retry: true })
  })
  it('rejects a missing, empty, whitespace, non-string or overlong text with the length message', () => {
    const caught = (body: unknown): unknown => { try { parseChatSendInput(body); return null } catch (e) { return e } }
    for (const body of [null, {}, { text: '' }, { text: '   ' }, { text: 5 }, { text: 'x'.repeat(2001) }, { retry: 'yes' }, { retry: false }])
      expect(caught(body)).toMatchObject({ statusCode: 400, message: 'A message must be 1 to 2000 characters' })
  })
  it('accepts exactly 2000 characters', () => {
    expect(parseChatSendInput({ text: 'x'.repeat(2000) })).toEqual({ text: 'x'.repeat(2000) })
  })
})
