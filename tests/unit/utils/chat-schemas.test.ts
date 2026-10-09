import { describe, it, expect } from 'vitest'
import { parseChatSendInput } from '@/server/utils/chat-schemas'

const caught = (body: unknown): unknown => { try { parseChatSendInput(body); return null } catch (e) { return e } }

describe('parseChatSendInput', () => {
  it('returns the trimmed text and no photos', () => {
    expect(parseChatSendInput({ text: '  hello  ' })).toEqual({ text: 'hello', photoIds: [] })
  })
  it('returns photos with empty text', () => {
    expect(parseChatSendInput({ photoIds: ['a', 'b'] })).toEqual({ text: '', photoIds: ['a', 'b'] })
    expect(parseChatSendInput({ text: '   ', photoIds: ['a'] })).toEqual({ text: '', photoIds: ['a'] })
  })
  it('returns a retry when retry is exactly true, ignoring the rest', () => {
    expect(parseChatSendInput({ retry: true, text: 'x', photoIds: ['a'] })).toEqual({ retry: true })
  })
  it('needs a message or a photo', () => {
    for (const body of [null, {}, { text: '' }, { text: '   ' }, { photoIds: [] }, { retry: 'yes' }, { retry: false }])
      expect(caught(body)).toMatchObject({ statusCode: 400, message: 'Add a message or a photo' })
  })
  it('rejects over-long or non-string text with the length message', () => {
    for (const body of [{ text: 5 }, { text: 'x'.repeat(2001) }, { text: 'x'.repeat(2001), photoIds: ['a'] }])
      expect(caught(body)).toMatchObject({ statusCode: 400, message: 'A message must be 1 to 2000 characters' })
  })
  it('rejects more than three photos, a non-array, or a non-string id', () => {
    expect(caught({ photoIds: ['a', 'b', 'c', 'd'] })).toMatchObject({ statusCode: 400, message: 'At most 3 photos per message' })
    for (const body of [{ photoIds: 'a' }, { photoIds: [1] }, { photoIds: [''] }])
      expect(caught(body)).toMatchObject({ statusCode: 400, message: 'At most 3 photos per message' })
  })
  it('accepts exactly 2000 characters and exactly three photos', () => {
    expect(parseChatSendInput({ text: 'x'.repeat(2000), photoIds: ['a', 'b', 'c'] })).toEqual({ text: 'x'.repeat(2000), photoIds: ['a', 'b', 'c'] })
  })
})
