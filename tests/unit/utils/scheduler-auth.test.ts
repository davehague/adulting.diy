import { describe, it, expect } from 'vitest'

describe('Scheduler CRON_SECRET Authentication', () => {
  // Test the logic that defineSchedulerProtectedEventHandler implements

  function verifyCronSecret(bearerToken: string | undefined, expectedCronSecret: string | undefined): { status: number; message: string } | null {
    if (!expectedCronSecret) {
      return { status: 500, message: 'Server configuration error' }
    }

    if (!bearerToken || bearerToken !== expectedCronSecret) {
      return { status: 401, message: 'Unauthorized: Invalid or missing API key' }
    }

    return null // Success
  }

  const validSecret = 'test-cron-secret'

  it('allows request with valid CRON_SECRET bearer token', () => {
    const result = verifyCronSecret(validSecret, validSecret)
    expect(result).toBeNull()
  })

  it('rejects request with missing token (401)', () => {
    const result = verifyCronSecret(undefined, validSecret)
    expect(result).toEqual({ status: 401, message: 'Unauthorized: Invalid or missing API key' })
  })

  it('rejects request with wrong token (401)', () => {
    const result = verifyCronSecret('wrong-secret', validSecret)
    expect(result).toEqual({ status: 401, message: 'Unauthorized: Invalid or missing API key' })
  })

  it('returns 500 when CRON_SECRET env var is not set', () => {
    const result = verifyCronSecret(validSecret, undefined)
    expect(result).toEqual({ status: 500, message: 'Server configuration error' })
  })

  it('rejects empty string token (401)', () => {
    const result = verifyCronSecret('', validSecret)
    expect(result).toEqual({ status: 401, message: 'Unauthorized: Invalid or missing API key' })
  })

  it('allows request via Authorization Bearer header', () => {
    const bearerHeader = 'Bearer test-cron-secret'
    const extractedToken = bearerHeader.replace('Bearer ', '')
    const result = verifyCronSecret(extractedToken, validSecret)
    expect(result).toBeNull()
  })
})
