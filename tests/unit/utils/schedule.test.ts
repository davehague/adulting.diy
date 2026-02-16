import { describe, it, expect } from 'vitest'
import { startOfDay } from 'date-fns'
import { calculateNextDueDate, checkEndCondition, generateFutureOccurrences } from '@/server/utils/schedule'
import type {
  OnceScheduleConfig,
  FixedIntervalScheduleConfig,
  SpecificDaysScheduleConfig,
  SpecificDayOfMonthScheduleConfig,
  SpecificWeekdayOfMonthScheduleConfig,
  VariableIntervalScheduleConfig,
  ScheduleConfig,
} from '@/types'

// Helper: local-time date constructor to avoid UTC parsing issues with startOfDay
// new Date('2024-01-08') = UTC midnight = previous day in local time zones west of UTC
// localDate(2024, 1, 8) = Jan 8 midnight local time
const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day) // month is 1-indexed for readability

const never = { type: 'never' as const }

const daysOfWeek = (overrides: Partial<Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', boolean>> = {}) => ({
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
  ...overrides,
})

describe('calculateNextDueDate', () => {

  describe('once', () => {
    it('returns the configured due date at start of day', () => {
      const dueDate = localDate(2024, 3, 15)
      dueDate.setHours(14, 30, 0) // add time to verify it normalizes
      const config: OnceScheduleConfig = {
        type: 'once',
        dueDate,
        endCondition: never,
      }
      const result = calculateNextDueDate(config)
      expect(result).toEqual(startOfDay(localDate(2024, 3, 15)))
    })

    it('returns today when dueDate is missing/invalid', () => {
      const config: OnceScheduleConfig = {
        type: 'once',
        dueDate: 'not-a-date' as unknown as Date,
        endCondition: never,
      }
      const result = calculateNextDueDate(config)
      expect(result).toEqual(startOfDay(new Date()))
    })
  })

  describe('fixed_interval', () => {
    it('adds days from today when no lastCompletedDate', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 7,
        intervalUnit: 'day',
        endCondition: never,
      }
      const result = calculateNextDueDate(config)
      const today = startOfDay(new Date())
      const expected = new Date(today)
      expected.setDate(expected.getDate() + 7)
      expect(result).toEqual(expected)
    })

    it('adds days from lastCompletedDate', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 7,
        intervalUnit: 'day',
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 8)))
    })

    it('adds weeks from lastCompletedDate', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 2,
        intervalUnit: 'week',
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
    })

    it('adds months and clamps to end of shorter month', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: never,
      }
      // Jan 31 + 1 month: date-fns clamps to Feb 29 in leap year 2024
      const result = calculateNextDueDate(config, localDate(2024, 1, 31))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 29)))
    })

    it('adds years from lastCompletedDate', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'year',
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2025, 1, 1)))
    })
  })

  describe('specific_days_of_week', () => {
    it('finds next Monday after a Wednesday completion', () => {
      // Wed Jan 3 2024 → starts from Thu Jan 4, scans forward → Mon Jan 8
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 3))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 8)))
    })

    it('picks the nearest matching day when multiple days selected', () => {
      // Tue Jan 2 → starts from Wed Jan 3, first match is Wednesday
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ wednesday: true, friday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 2))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 3)))
    })

    it('wraps to next week if needed', () => {
      // Fri Jan 5 → starts from Sat Jan 6, looking for Monday → Mon Jan 8
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 5))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 8)))
    })

    it('returns null when no days are selected', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek(),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 3))
      expect(result).toBeNull()
    })

    it('finds next occurrence of same day (next week)', () => {
      // Mon Jan 1 → starts from Tue Jan 2, next Monday is Jan 8
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 8)))
    })
  })

  describe('specific_day_of_month', () => {
    it('returns the 15th of next month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 10))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 15)))
    })

    it('skips February for day 31 (goes to March)', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 31,
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      // Feb 2024 has 29 days, no 31st → skip to Mar 31
      expect(result).toEqual(startOfDay(localDate(2024, 3, 31)))
    })

    it('skips non-leap February for day 29', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 29,
        endCondition: never,
      }
      // Jan 2025 → Feb 2025 has 28 days (not leap year) → skip to Mar 29
      const result = calculateNextDueDate(config, localDate(2025, 1, 10))
      expect(result).toEqual(startOfDay(localDate(2025, 3, 29)))
    })

    it('handles leap year February for day 29', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 29,
        endCondition: never,
      }
      // Jan 2024 → Feb 2024 has 29 days (leap year) → Feb 29
      const result = calculateNextDueDate(config, localDate(2024, 1, 10))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 29)))
    })

    it('returns null for invalid day of month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 32,
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 10))
      expect(result).toBeNull()
    })
  })

  describe('specific_weekday_of_month', () => {
    it('finds the first Monday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, first Monday is Feb 5
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 5)))
    })

    it('finds the last Friday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'friday', occurrence: 'last' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, last Friday is Feb 23
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 23)))
    })

    it('finds the third Wednesday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'wednesday', occurrence: 'third' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, third Wednesday is Feb 21
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 21)))
    })

    it('finds the second Saturday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'saturday', occurrence: 'second' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, second Saturday is Feb 10
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 10)))
    })

    it('handles year boundary (Dec → Jan)', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
        endCondition: never,
      }
      // Dec 15 2024 → Jan 2025, first Monday is Jan 6
      const result = calculateNextDueDate(config, localDate(2024, 12, 15))
      expect(result).toEqual(startOfDay(localDate(2025, 1, 6)))
    })
  })

  describe('variable_interval', () => {
    it('adds days from completion date', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 10, unit: 'day' },
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 5))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
    })

    it('adds months from completion date', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 2, unit: 'month' },
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 3, 15)))
    })

    it('adds weeks from completion date', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 3, unit: 'week' },
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 22)))
    })

    it('returns null when no lastCompletedDate provided', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 7, unit: 'day' },
        endCondition: never,
      }
      const result = calculateNextDueDate(config)
      expect(result).toBeNull()
    })

    it('normalizes time component to start of day', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 1, unit: 'day' },
        endCondition: never,
      }
      const morning = localDate(2024, 1, 15)
      morning.setHours(8, 0, 0)
      const evening = localDate(2024, 1, 15)
      evening.setHours(22, 0, 0)
      const morningResult = calculateNextDueDate(config, morning)
      const eveningResult = calculateNextDueDate(config, evening)
      expect(morningResult).toEqual(eveningResult)
    })
  })
})

describe('checkEndCondition', () => {

  it('returns false when endCondition is "never"', () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'never' },
    }
    expect(checkEndCondition(config, 100)).toBe(false)
  })

  it('returns false when endCondition is undefined', () => {
    const config = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
    } as unknown as ScheduleConfig
    expect(checkEndCondition(config, 100)).toBe(false)
  })

  describe('times end condition', () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'times', times: 5 },
    }

    it('returns false when under the limit', () => {
      expect(checkEndCondition(config, 3)).toBe(false)
    })

    it('returns true when at the limit', () => {
      expect(checkEndCondition(config, 5)).toBe(true)
    })

    it('returns true when over the limit', () => {
      expect(checkEndCondition(config, 7)).toBe(true)
    })
  })

  describe('date end condition', () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'date', date: localDate(2024, 3, 1) },
    }

    it('returns false when next due date is before end date', () => {
      expect(checkEndCondition(config, 1, localDate(2024, 2, 15))).toBe(false)
    })

    it('returns true when next due date is on end date', () => {
      expect(checkEndCondition(config, 1, localDate(2024, 3, 1))).toBe(true)
    })

    it('returns true when next due date is after end date', () => {
      expect(checkEndCondition(config, 1, localDate(2024, 3, 15))).toBe(true)
    })
  })
})

describe('generateFutureOccurrences', () => {

  describe('once schedule', () => {
    const config: OnceScheduleConfig = {
      type: 'once',
      dueDate: localDate(2024, 2, 15),
      endCondition: never,
    }

    it('generates one date when no existing occurrences', () => {
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 15)))
    })

    it('generates nothing when occurrence already exists', () => {
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 1)
      expect(result).toHaveLength(0)
    })

    it('generates nothing when due date is past horizon', () => {
      const horizon = localDate(2024, 1, 1) // before dueDate
      const result = generateFutureOccurrences(config, horizon, 0)
      expect(result).toHaveLength(0)
    })
  })

  describe('fixed_interval schedule', () => {
    it('generates weekly occurrences up to horizon', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 1, 29)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 8, Jan 15, Jan 22, Jan 29
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 8)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 15)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 1, 22)))
      expect(result[3]).toEqual(startOfDay(localDate(2024, 1, 29)))
    })

    it('generates daily occurrences and stops at horizon', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'day',
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 1, 6)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 2, 3, 4, 5, 6
      expect(result).toHaveLength(5)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 2)))
      expect(result[4]).toEqual(startOfDay(localDate(2024, 1, 6)))
    })

    it('generates monthly occurrences across year boundary', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 10, 15)
      const horizon = localDate(2025, 2, 28)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Nov 15, Dec 15, Jan 15, Feb 15
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 11, 15)))
      expect(result[3]).toEqual(startOfDay(localDate(2025, 2, 15)))
    })
  })

  describe('specific_days_of_week schedule', () => {
    it('generates occurrences for Mon/Wed/Fri over 2 weeks', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true, wednesday: true, friday: true }),
        endCondition: never,
      }
      // Sun Dec 31 2023 → scan starts Mon Jan 1
      const lastCompleted = localDate(2023, 12, 31) // Sunday
      const horizon = localDate(2024, 1, 14)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Mon Jan 1, Wed Jan 3, Fri Jan 5, Mon Jan 8, Wed Jan 10, Fri Jan 12
      expect(result).toHaveLength(6)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 1)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 3)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 1, 5)))
      expect(result[3]).toEqual(startOfDay(localDate(2024, 1, 8)))
      expect(result[4]).toEqual(startOfDay(localDate(2024, 1, 10)))
      expect(result[5]).toEqual(startOfDay(localDate(2024, 1, 12)))
    })
  })

  describe('variable_interval schedule', () => {
    it('returns empty when no lastCompletedDate', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 7, unit: 'day' },
        endCondition: never,
      }
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, null)
      expect(result).toHaveLength(0)
    })

    it('generates chain of variable occurrences', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 10, unit: 'day' },
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 2, 15)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 11, Jan 21, Jan 31, Feb 10 (Feb 20 past horizon)
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 11)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 21)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 1, 31)))
      expect(result[3]).toEqual(startOfDay(localDate(2024, 2, 10)))
    })
  })

  describe('end conditions in generation loop', () => {
    // Note: generateFutureOccurrences increments count THEN checks endCondition
    // BEFORE pushing. So with times=3 and existingCount=0:
    // iter 1: count=1, check(1>=3)→false, push
    // iter 2: count=2, check(2>=3)→false, push
    // iter 3: count=3, check(3>=3)→true, BREAK
    // Result: 2 items (the 3rd triggers the stop before being added)

    it('stops at times limit', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'times', times: 3 },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // count hits 3 before pushing 3rd item → only 2 generated
      expect(result).toHaveLength(2)
    })

    it('accounts for existing occurrence count in times limit', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'times', times: 5 },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 12, 31)
      // Already have 3 → count starts at 3
      // iter 1: count=4, check(4>=5)→false, push
      // iter 2: count=5, check(5>=5)→true, BREAK → 1 item
      const result = generateFutureOccurrences(config, horizon, 3, lastCompleted)

      expect(result).toHaveLength(1)
    })

    it('stops at date end condition', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'date', date: localDate(2024, 1, 22) },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 8, Jan 15 — Jan 22 is ON the end date (isSameDay → true) so it stops
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 8)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 15)))
    })

    it('generates nothing when already past times limit', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'times', times: 5 },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 12, 31)
      // count starts at 5, first iter: count=6, check(6>=5)→true, BREAK
      const result = generateFutureOccurrences(config, horizon, 5, lastCompleted)

      expect(result).toHaveLength(0)
    })
  })

  describe('specific_day_of_month in generation loop', () => {
    it('generates monthly on the 15th', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: never,
      }
      // From Jan 10, first occurrence is Feb 15, then each subsequent
      // month's 15th uses the previous result as lastDate
      const lastCompleted = localDate(2024, 1, 10)
      const horizon = localDate(2024, 4, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15, Mar 15, Apr 15
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 15)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 15)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 15)))
    })

    it('skips months that lack the target day', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 31,
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 8, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Every date should be the 31st of its month
      result.forEach(date => {
        expect(date.getDate()).toBe(31)
      })
      expect(result.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('specific_weekday_of_month in generation loop', () => {
    it('generates first Monday of each month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
        endCondition: never,
      }
      // From Jan 15, first result is Feb's first Monday
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 4, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // First Monday of: Feb = Feb 5, Mar = Mar 4, Apr = Apr 1
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 5)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 4)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 1)))
    })
  })

  describe('safety and edge cases', () => {
    it('caps at ~1000 occurrences for runaway schedules', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'day',
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2030, 1, 1)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // The code breaks when occurrences.length > 1000 (after pushing),
      // so max is 1001
      expect(result.length).toBeLessThanOrEqual(1001)
      expect(result.length).toBeGreaterThan(999)
    })

    it('returns empty array for unknown schedule type', () => {
      const config = {
        type: 'unknown_type',
        endCondition: never,
      } as unknown as ScheduleConfig
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, localDate(2024, 1, 1))

      expect(result).toHaveLength(0)
    })
  })
})
