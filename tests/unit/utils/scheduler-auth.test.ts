import { describe, it, expect } from 'vitest'

describe('Scheduler API Key Authentication', () => {
  // Test the logic that defineSchedulerProtectedEventHandler implements

  function verifySchedulerKey(headerKey: string | undefined, envKey: string | undefined): { status: number; message: string } | null {
    if (!envKey) {
      return { status: 500, message: 'Server configuration error' }
    }
    if (!headerKey || headerKey !== envKey) {
      return { status: 401, message: 'Unauthorized: Invalid or missing API key' }
    }
    return null // Success
  }

  const validKey = 'test-scheduler-key'

  it('allows request with valid x-scheduler-key', () => {
    const result = verifySchedulerKey(validKey, validKey)
    expect(result).toBeNull()
  })

  it('rejects request with missing key (401)', () => {
    const result = verifySchedulerKey(undefined, validKey)
    expect(result).toEqual({ status: 401, message: 'Unauthorized: Invalid or missing API key' })
  })

  it('rejects request with wrong key (401)', () => {
    const result = verifySchedulerKey('wrong-key', validKey)
    expect(result).toEqual({ status: 401, message: 'Unauthorized: Invalid or missing API key' })
  })

  it('returns 500 when SCHEDULER_API_KEY env var is not set', () => {
    const result = verifySchedulerKey(validKey, undefined)
    expect(result).toEqual({ status: 500, message: 'Server configuration error' })
  })

  it('rejects empty string key (401)', () => {
    const result = verifySchedulerKey('', validKey)
    expect(result).toEqual({ status: 401, message: 'Unauthorized: Invalid or missing API key' })
  })

  it('allows request via Authorization Bearer fallback', () => {
    // Simulates extracting key from "Bearer test-scheduler-key"
    const bearerHeader = 'Bearer test-scheduler-key'
    const extractedKey = bearerHeader.replace('Bearer ', '')
    const result = verifySchedulerKey(extractedKey, validKey)
    expect(result).toBeNull()
  })
})
