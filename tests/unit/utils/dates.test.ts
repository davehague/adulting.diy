import { describe, it, expect } from 'vitest'
import { parseDateOnly } from '@/server/utils/dates'

describe('parseDateOnly', () => {
  it('parses YYYY-MM-DD as noon UTC', () => {
    const result = parseDateOnly('2026-02-18')
    expect(result.toISOString()).toBe('2026-02-18T12:00:00.000Z')
  })

  it('produces the correct calendar date in UTC-12', () => {
    const result = parseDateOnly('2026-02-18')
    expect(result.getUTCDate()).toBe(18)
    expect(result.getUTCMonth()).toBe(1)
  })

  it('produces the correct calendar date in UTC+12', () => {
    const result = parseDateOnly('2026-02-18')
    expect(result.getUTCHours()).toBe(12)
  })

  it('handles month boundaries', () => {
    const result = parseDateOnly('2026-01-31')
    expect(result.toISOString()).toBe('2026-01-31T12:00:00.000Z')
  })

  it('handles leap year date', () => {
    const result = parseDateOnly('2024-02-29')
    expect(result.toISOString()).toBe('2024-02-29T12:00:00.000Z')
  })

  it('returns invalid Date for garbage input', () => {
    const result = parseDateOnly('not-a-date')
    expect(isNaN(result.getTime())).toBe(true)
  })
})
