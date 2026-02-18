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

  it('returns null for object with empty reminders array', () => {
    expect(validateReminderConfig({ reminders: [] })).toBeNull()
  })

  // --- Accepts valid new format ---
  it('accepts a single before reminder', () => {
    expect(validateReminderConfig({
      reminders: [{ days: 3, timing: 'before' }],
    })).toEqual({
      reminders: [{ days: 3, timing: 'before' }],
    })
  })

  it('accepts a single on reminder', () => {
    expect(validateReminderConfig({
      reminders: [{ days: 0, timing: 'on' }],
    })).toEqual({
      reminders: [{ days: 0, timing: 'on' }],
    })
  })

  it('accepts a single after reminder', () => {
    expect(validateReminderConfig({
      reminders: [{ days: 2, timing: 'after' }],
    })).toEqual({
      reminders: [{ days: 2, timing: 'after' }],
    })
  })

  it('accepts multiple reminders', () => {
    expect(validateReminderConfig({
      reminders: [
        { days: 7, timing: 'before' },
        { days: 0, timing: 'on' },
        { days: 3, timing: 'after' },
      ],
    })).toEqual({
      reminders: [
        { days: 7, timing: 'before' },
        { days: 0, timing: 'on' },
        { days: 3, timing: 'after' },
      ],
    })
  })

  // --- Forces days=0 for 'on' timing ---
  it('forces days to 0 when timing is on', () => {
    expect(validateReminderConfig({
      reminders: [{ days: 5, timing: 'on' }],
    })).toEqual({
      reminders: [{ days: 0, timing: 'on' }],
    })
  })

  // --- Caps at 5 ---
  it('caps at 5 reminders', () => {
    const result = validateReminderConfig({
      reminders: [
        { days: 1, timing: 'before' },
        { days: 2, timing: 'before' },
        { days: 3, timing: 'before' },
        { days: 0, timing: 'on' },
        { days: 1, timing: 'after' },
        { days: 2, timing: 'after' },
        { days: 3, timing: 'after' },
      ],
    })
    expect(result!.reminders).toHaveLength(5)
  })

  // --- Deduplicates ---
  it('deduplicates identical entries', () => {
    expect(validateReminderConfig({
      reminders: [
        { days: 3, timing: 'before' },
        { days: 3, timing: 'before' },
        { days: 1, timing: 'after' },
      ],
    })).toEqual({
      reminders: [
        { days: 3, timing: 'before' },
        { days: 1, timing: 'after' },
      ],
    })
  })

  // --- Rejects invalid entries ---
  it('rejects entries with invalid timing', () => {
    expect(validateReminderConfig({
      reminders: [{ days: 3, timing: 'invalid' }],
    })).toBeNull()
  })

  it('rejects entries with negative days', () => {
    expect(validateReminderConfig({
      reminders: [{ days: -1, timing: 'before' }],
    })).toBeNull()
  })

  it('rejects entries with non-integer days', () => {
    expect(validateReminderConfig({
      reminders: [{ days: 1.5, timing: 'before' }],
    })).toBeNull()
  })

  it('rejects entries with non-number days', () => {
    expect(validateReminderConfig({
      reminders: [{ days: '3', timing: 'before' }],
    })).toBeNull()
  })

  it('filters invalid entries but keeps valid ones', () => {
    expect(validateReminderConfig({
      reminders: [
        { days: 3, timing: 'before' },
        { days: -1, timing: 'before' },
        { days: 2, timing: 'invalid' },
        { days: 1, timing: 'after' },
      ],
    })).toEqual({
      reminders: [
        { days: 3, timing: 'before' },
        { days: 1, timing: 'after' },
      ],
    })
  })

  it('skips non-object entries in array', () => {
    expect(validateReminderConfig({
      reminders: [null, 'bad', 42, { days: 3, timing: 'before' }],
    })).toEqual({
      reminders: [{ days: 3, timing: 'before' }],
    })
  })

  // --- Legacy format auto-conversion ---
  it('converts legacy initialReminder to before', () => {
    expect(validateReminderConfig({ initialReminder: 3 })).toEqual({
      reminders: [{ days: 3, timing: 'before' }],
    })
  })

  it('converts legacy followUpReminder to before', () => {
    expect(validateReminderConfig({ followUpReminder: 1 })).toEqual({
      reminders: [{ days: 1, timing: 'before' }],
    })
  })

  it('converts legacy overdueReminder to after', () => {
    expect(validateReminderConfig({ overdueReminder: 2 })).toEqual({
      reminders: [{ days: 2, timing: 'after' }],
    })
  })

  it('converts all three legacy fields', () => {
    expect(validateReminderConfig({
      initialReminder: 7,
      followUpReminder: 1,
      overdueReminder: 3,
    })).toEqual({
      reminders: [
        { days: 7, timing: 'before' },
        { days: 1, timing: 'before' },
        { days: 3, timing: 'after' },
      ],
    })
  })

  it('deduplicates legacy fields with same value', () => {
    expect(validateReminderConfig({
      initialReminder: 3,
      followUpReminder: 3,
    })).toEqual({
      reminders: [{ days: 3, timing: 'before' }],
    })
  })

  it('returns null for legacy format with only invalid values', () => {
    expect(validateReminderConfig({
      daysBeforeDue: [7, 1],
      enabled: true,
    })).toBeNull()
  })

  it('strips unknown keys from input', () => {
    expect(validateReminderConfig({
      reminders: [{ days: 3, timing: 'before' }],
      bogusField: 'foo',
    })).toEqual({
      reminders: [{ days: 3, timing: 'before' }],
    })
  })
})
