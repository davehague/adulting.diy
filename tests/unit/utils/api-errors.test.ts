import { describe, it, expect, vi } from 'vitest'
import { HttpError, toHttpError } from '@/server/utils/api-errors'

describe('toHttpError', () => {
  it('rethrows HttpError with its status code', () => {
    try { toHttpError(new HttpError('nope', 409), 'ctx') } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(409)
      return
    }
    throw new Error('did not throw')
  })
  it('passes through errors that already carry a statusCode', () => {
    try { toHttpError({ statusCode: 403, message: 'no' }, 'ctx') } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(403)
      return
    }
    throw new Error('did not throw')
  })
  it('maps unknown errors to 500', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try { toHttpError(new Error('boom'), 'ctx') } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(500)
      return
    }
    throw new Error('did not throw')
  })
})
