import { describe, it, expect } from 'vitest'
import { validateReminderConfig } from '@/server/utils/validation'

describe('validateReminderConfig', () => {
  // --- Returns null for non-object / empty inputs ---
  it('returns null for null input', () => {
    expect(validateReminderConfig(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(validateReminderConfig(undefined)).toBeNull()
  })

  it('returns null for string input', () => {
    expect(validateReminderConfig('hello')).toBeNull()
  })

  it('returns null for array input', () => {
    expect(validateReminderConfig([1, 2])).toBeNull()
  })

  it('returns null for empty object', () => {
    expect(validateReminderConfig({})).toBeNull()
  })

  // --- Strips legacy format fields ---
  it('returns null for legacy daysBeforeDue format (no valid new fields)', () => {
    expect(validateReminderConfig({
      daysBeforeDue: [7, 1],
      enabled: true,
    })).toBeNull()
  })

  it('strips legacy fields but keeps valid new fields', () => {
    expect(validateReminderConfig({
      daysBeforeDue: [7, 1],
      enabled: true,
      initialReminder: 3,
    })).toEqual({ initialReminder: 3 })
  })

  // --- Accepts valid new format ---
  it('accepts initialReminder only', () => {
    expect(validateReminderConfig({ initialReminder: 3 })).toEqual({
      initialReminder: 3,
    })
  })

  it('accepts followUpReminder only', () => {
    expect(validateReminderConfig({ followUpReminder: 1 })).toEqual({
      followUpReminder: 1,
    })
  })

  it('accepts overdueReminder only', () => {
    expect(validateReminderConfig({ overdueReminder: 2 })).toEqual({
      overdueReminder: 2,
    })
  })

  it('accepts all three fields together', () => {
    expect(validateReminderConfig({
      initialReminder: 7,
      followUpReminder: 1,
      overdueReminder: 3,
    })).toEqual({
      initialReminder: 7,
      followUpReminder: 1,
      overdueReminder: 3,
    })
  })

  it('accepts zero as a valid value', () => {
    expect(validateReminderConfig({ initialReminder: 0 })).toEqual({
      initialReminder: 0,
    })
  })

  // --- Rejects invalid field values ---
  it('rejects negative numbers', () => {
    expect(validateReminderConfig({ initialReminder: -1 })).toBeNull()
  })

  it('rejects string values for numeric fields', () => {
    expect(validateReminderConfig({ initialReminder: '3' })).toBeNull()
  })

  it('ignores unknown extra fields', () => {
    expect(validateReminderConfig({
      initialReminder: 5,
      bogusField: 'foo',
      anotherJunk: 99,
    })).toEqual({ initialReminder: 5 })
  })

  it('filters out invalid fields while keeping valid ones', () => {
    expect(validateReminderConfig({
      initialReminder: 3,
      followUpReminder: -1,
      overdueReminder: 'bad',
    })).toEqual({ initialReminder: 3 })
  })
})
