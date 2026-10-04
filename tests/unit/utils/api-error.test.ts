import { describe, it, expect } from 'vitest'
import { ApiError, buildApiError, hasApiStatus } from '@/utils/api-error'

describe('buildApiError', () => {
  it("uses the server's message and keeps the status", () => {
    const error = buildApiError(409, 'Conflict', { message: 'This project already has 100 steps' })
    expect(error.message).toBe('This project already has 100 steps')
    expect(error.status).toBe(409)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toBeInstanceOf(Error)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Not Found'],
    ['an empty object', {}],
    ['a non-string message', { message: 42 }],
    ['a blank message', { message: '   ' }],
  ])('falls back to the status line for a body that is %s', (_label, body) => {
    const error = buildApiError(404, 'Not Found', body)
    expect(error.message).toBe('API Error: 404 Not Found')
    expect(error.status).toBe(404)
  })

  it('handles an empty status text, as on HTTP/2', () => {
    const error = buildApiError(404, '', null)
    expect(error.message).toBe('API Error: 404 ')
    expect(error.status).toBe(404)
  })

  it('trims the server message', () => {
    expect(buildApiError(400, '', { message: '  Step text is required ' }).message).toBe('Step text is required')
  })
})

describe('hasApiStatus', () => {
  it('recognises the new-user sign-up case, whose server message has no digits', () => {
    const error = buildApiError(404, '', { message: 'User not found' })
    expect(hasApiStatus(error, 404)).toBe(true)
    expect(hasApiStatus(error, 409)).toBe(false)
  })

  it('recognises a 409 whose server message is the in-use text', () => {
    const error = buildApiError(409, '', { message: 'Category is used by 2 provider(s); move them first' })
    expect(hasApiStatus(error, 409)).toBe(true)
    expect(hasApiStatus(error, 404)).toBe(false)
  })

  it('decides by status, not by digits in the message', () => {
    expect(hasApiStatus(buildApiError(409, '', { message: 'In use by 404 providers' }), 404)).toBe(false)
  })

  it('still recognises an error built the old way', () => {
    expect(hasApiStatus(new Error('API Error: 404 Not Found'), 404)).toBe(true)
    expect(hasApiStatus(new Error('API Error: 404 Not Found'), 409)).toBe(false)
  })

  it('is false for other errors and non-errors', () => {
    expect(hasApiStatus(new Error('Authentication required'), 404)).toBe(false)
    expect(hasApiStatus('nope', 404)).toBe(false)
    expect(hasApiStatus(null, 404)).toBe(false)
    expect(hasApiStatus(undefined, 404)).toBe(false)
  })
})
