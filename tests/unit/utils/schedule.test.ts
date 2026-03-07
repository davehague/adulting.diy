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
  AnnualFixedScheduleConfig,
  AnnualVariableScheduleConfig,
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

    it('single day Sunday: finds next Sunday after Wednesday', () => {
      // Wed Jan 3 2024 → starts from Thu Jan 4, scans → Sun Jan 7
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ sunday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 3))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 7)))
    })

    it('single day Sunday: wraps to next week when completed on Sunday', () => {
      // Sun Jan 7 2024 → starts from Mon Jan 8, scans → Sun Jan 14
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ sunday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 7))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 14)))
    })

    it('multiple days: completed on Tuesday, next is Saturday', () => {
      // Tue Jan 2 2024 → starts from Wed Jan 3, scans → Sat Jan 6
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ tuesday: true, saturday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 2))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 6)))
    })

    it('multiple days: completed on Saturday, next is Tuesday (wraps week)', () => {
      // Sat Jan 6 2024 → starts from Sun Jan 7, scans → Tue Jan 9
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ tuesday: true, saturday: true }),
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 1, 6))
      expect(result).toEqual(startOfDay(localDate(2024, 1, 9)))
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

    it('returns the 1st of next month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 1,
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 3, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 4, 1)))
    })

    it('day 1 wraps year boundary (Dec → Jan)', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 1,
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 12, 15))
      expect(result).toEqual(startOfDay(localDate(2025, 1, 1)))
    })

    it('day 30 skips February (non-leap year)', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 30,
        endCondition: never,
      }
      // Jan 15 2025 → Feb has 28 days, no 30th → Mar 30
      const result = calculateNextDueDate(config, localDate(2025, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2025, 3, 30)))
    })

    it('day 30 skips February (leap year)', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 30,
        endCondition: never,
      }
      // Jan 15 2024 → Feb has 29 days, no 30th → Mar 30
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 3, 30)))
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

    describe('lastDayOfMonth', () => {
      it('returns last day of February (non-leap year)', () => {
        const config: SpecificDayOfMonthScheduleConfig = {
          type: 'specific_day_of_month',
          dayOfMonth: 1, // ignored when lastDayOfMonth is true
          lastDayOfMonth: true,
          endCondition: never,
        }
        const result = calculateNextDueDate(config, localDate(2025, 1, 15))
        expect(result).toEqual(startOfDay(localDate(2025, 2, 28)))
      })

      it('returns last day of February (leap year)', () => {
        const config: SpecificDayOfMonthScheduleConfig = {
          type: 'specific_day_of_month',
          dayOfMonth: 1,
          lastDayOfMonth: true,
          endCondition: never,
        }
        const result = calculateNextDueDate(config, localDate(2024, 1, 15))
        expect(result).toEqual(startOfDay(localDate(2024, 2, 29)))
      })

      it('returns last day of April (30 days)', () => {
        const config: SpecificDayOfMonthScheduleConfig = {
          type: 'specific_day_of_month',
          dayOfMonth: 1,
          lastDayOfMonth: true,
          endCondition: never,
        }
        const result = calculateNextDueDate(config, localDate(2024, 3, 15))
        expect(result).toEqual(startOfDay(localDate(2024, 4, 30)))
      })

      it('returns last day of December (31 days)', () => {
        const config: SpecificDayOfMonthScheduleConfig = {
          type: 'specific_day_of_month',
          dayOfMonth: 1,
          lastDayOfMonth: true,
          endCondition: never,
        }
        const result = calculateNextDueDate(config, localDate(2024, 11, 15))
        expect(result).toEqual(startOfDay(localDate(2024, 12, 31)))
      })

      it('wraps year boundary', () => {
        const config: SpecificDayOfMonthScheduleConfig = {
          type: 'specific_day_of_month',
          dayOfMonth: 1,
          lastDayOfMonth: true,
          endCondition: never,
        }
        const result = calculateNextDueDate(config, localDate(2024, 12, 15))
        expect(result).toEqual(startOfDay(localDate(2025, 1, 31)))
      })
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

    it('finds the fourth Thursday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'thursday', occurrence: 'fourth' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, fourth Thursday is Feb 22
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 22)))
    })

    it('finds the first Sunday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'sunday', occurrence: 'first' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, first Sunday is Feb 4
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 4)))
    })

    it('finds the last Sunday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'sunday', occurrence: 'last' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, last Sunday is Feb 25
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 25)))
    })

    it('finds the last Monday of next month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'last' },
        endCondition: never,
      }
      // Jan 15 2024 → Feb 2024, last Monday is Feb 26
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 26)))
    })

    it('finds the fourth Tuesday of a month where 4th is last', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'tuesday', occurrence: 'fourth' },
        endCondition: never,
      }
      // Feb 2024: Tuesdays are Feb 6, 13, 20, 27 → fourth = Feb 27
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 27)))
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

  describe('annual_fixed', () => {
    it('returns this year\'s date when it is still in the future', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 12,
        dayOfMonth: 25,
        endCondition: never,
      }
      // Completed Jan 1 2024 → Dec 25 2024 is in the future
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2024, 12, 25)))
    })

    it('rolls to next year when date has passed', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 3,
        dayOfMonth: 15,
        endCondition: never,
      }
      // Completed Jul 1 2024 → Mar 15 2024 has passed → Mar 15 2025
      const result = calculateNextDueDate(config, localDate(2024, 7, 1))
      expect(result).toEqual(startOfDay(localDate(2025, 3, 15)))
    })

    it('rolls to next year when completed on the same date', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 4,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Completed on Apr 29 2024 → Apr 29 is not after Apr 29 → next Apr 29 2025
      const result = calculateNextDueDate(config, localDate(2024, 4, 29))
      expect(result).toEqual(startOfDay(localDate(2025, 4, 29)))
    })

    it('preserves fixed date even when completed late', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 4,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Due Apr 29, completed Jul 15 → next Apr 29 (next year since Jul 15 > Apr 29)
      const result = calculateNextDueDate(config, localDate(2024, 7, 15))
      expect(result).toEqual(startOfDay(localDate(2025, 4, 29)))
    })

    it('Jan 1 annual from mid-year rolls to next year', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 1,
        dayOfMonth: 1,
        endCondition: never,
      }
      // Completed Jun 15 2024 → Jan 1 2024 has passed → Jan 1 2025
      const result = calculateNextDueDate(config, localDate(2024, 6, 15))
      expect(result).toEqual(startOfDay(localDate(2025, 1, 1)))
    })

    it('Jan 1 annual from December stays in next year', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 1,
        dayOfMonth: 1,
        endCondition: never,
      }
      // Completed Dec 15 2024 → Jan 1 2025
      const result = calculateNextDueDate(config, localDate(2024, 12, 15))
      expect(result).toEqual(startOfDay(localDate(2025, 1, 1)))
    })

    it('Feb 29 annual lands on leap year', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 2,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Completed Jan 1 2024 → Feb 29 2024 (leap year, still in future)
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 29)))
    })

    it('Feb 29 annual in non-leap year: JS Date rolls to Mar 1', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 2,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Completed Mar 1 2024 → next Feb 29... but 2025 is not a leap year
      // JS Date(2025, 1, 29) = Mar 1 2025
      const result = calculateNextDueDate(config, localDate(2024, 3, 1))
      // This documents current behavior: it becomes Mar 1 in non-leap years
      expect(result).toEqual(startOfDay(localDate(2025, 3, 1)))
    })

    it('Dec 31 annual (last day of year)', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 12,
        dayOfMonth: 31,
        endCondition: never,
      }
      // Completed Jan 15 2024 → Dec 31 2024
      const result = calculateNextDueDate(config, localDate(2024, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2024, 12, 31)))
    })
  })

  describe('annual_variable', () => {
    it('returns 1 year from completion date', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 4,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Completed Aug 10 2024 → next due Aug 10 2025
      const result = calculateNextDueDate(config, localDate(2024, 8, 10))
      expect(result).toEqual(startOfDay(localDate(2025, 8, 10)))
    })

    it('uses anchor date when no completion date provided', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 12,
        dayOfMonth: 25,
        endCondition: never,
      }
      // No completion date, today is mocked implicitly — use anchor
      // Since we can't control "today", test that it returns a Dec 25
      const result = calculateNextDueDate(config)
      expect(result).not.toBeNull()
      expect(result!.getMonth()).toBe(11) // December = month 11 in JS
      expect(result!.getDate()).toBe(25)
    })

    it('shifts date when done late', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 4,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Due Apr 29, done Aug 10 → next Aug 10 (not Apr 29)
      const result = calculateNextDueDate(config, localDate(2024, 8, 10))
      expect(result).toEqual(startOfDay(localDate(2025, 8, 10)))
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

    it('returns false when no nextDueDate provided and current date is before end date', () => {
      const futureConfig: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'date', date: localDate(2099, 12, 31) },
      }
      // No nextDueDate → falls back to checking current date vs end date
      expect(checkEndCondition(futureConfig, 1)).toBe(false)
    })

    it('returns false when endCondition date is invalid', () => {
      const invalidConfig: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'date', date: new Date('invalid') },
      }
      expect(checkEndCondition(invalidConfig, 1, localDate(2024, 3, 1))).toBe(false)
    })

    it('returns false when endCondition date is missing', () => {
      const missingDateConfig: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'date' } as any,
      }
      expect(checkEndCondition(missingDateConfig, 1, localDate(2024, 3, 1))).toBe(false)
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

    it('generates yearly occurrences up to horizon', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'year',
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 6, 1)
      const horizon = localDate(2027, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jun 1 2025, Jun 1 2026, Jun 1 2027
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 6, 1)))
      expect(result[1]).toEqual(startOfDay(localDate(2026, 6, 1)))
      expect(result[2]).toEqual(startOfDay(localDate(2027, 6, 1)))
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

    it('stops at date end condition for specific_days_of_week', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true, wednesday: true, friday: true }),
        endCondition: { type: 'date', date: localDate(2024, 1, 10) },
      }
      // Sun Dec 31 2023 → Mon Jan 1, Wed Jan 3, Fri Jan 5, Mon Jan 8
      // Wed Jan 10 is ON the end date → stops
      const lastCompleted = localDate(2023, 12, 31)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 1, Jan 3, Jan 5, Jan 8 — Jan 10 is on end date so excluded
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 1)))
      expect(result[3]).toEqual(startOfDay(localDate(2024, 1, 8)))
    })

    it('stops at date end condition for specific_day_of_month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: { type: 'date', date: localDate(2024, 4, 15) },
      }
      const lastCompleted = localDate(2024, 1, 10)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15, Mar 15 — Apr 15 is ON the end date so excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 15)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 15)))
    })

    it('stops at date end condition for specific_weekday_of_month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
        endCondition: { type: 'date', date: localDate(2024, 4, 1) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // First Monday of: Feb = Feb 5, Mar = Mar 4
      // First Monday of Apr = Apr 1 which is ON the end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 5)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 4)))
    })

    it('stops at date end condition for variable_interval', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 10, unit: 'day' },
        endCondition: { type: 'date', date: localDate(2024, 1, 25) },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 11, Jan 21 — Jan 31 is after end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 11)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 21)))
    })

    it('stops at date end condition for annual_fixed', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 4,
        dayOfMonth: 29,
        endCondition: { type: 'date', date: localDate(2026, 4, 29) },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2027, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Apr 29 2024, Apr 29 2025 — Apr 29 2026 is ON end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 4, 29)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 4, 29)))
    })

    it('stops at date end condition for annual_variable', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 4,
        dayOfMonth: 29,
        endCondition: { type: 'date', date: localDate(2026, 8, 10) },
      }
      const lastCompleted = localDate(2024, 8, 10)
      const horizon = localDate(2027, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Aug 10 2025 — Aug 10 2026 is ON end date → excluded
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 8, 10)))
    })

    it('stops at date end condition when end date falls between occurrences', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'date', date: localDate(2024, 4, 10) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15, Mar 15 — Apr 15 is after end date Apr 10 → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 15)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 15)))
    })

    it('generates nothing when end date is before first possible occurrence', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'date', date: localDate(2024, 1, 20) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15 is after end date Jan 20 → no occurrences
      expect(result).toHaveLength(0)
    })

    it('stops at times limit for specific_days_of_week', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true, friday: true }),
        endCondition: { type: 'times', times: 3 },
      }
      const lastCompleted = localDate(2023, 12, 31)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Mon Jan 1, Fri Jan 5 — count=3 on next iteration triggers stop
      expect(result).toHaveLength(2)
    })

    it('stops at times limit for single-day specific_days_of_week (Sunday)', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ sunday: true }),
        endCondition: { type: 'times', times: 4 },
      }
      const lastCompleted = localDate(2024, 1, 1) // Mon
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Sun Jan 7, Sun Jan 14, Sun Jan 21 — count=4 on next iteration triggers stop
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 7)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 14)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 1, 21)))
    })

    it('stops at date end condition for single-day specific_days_of_week (Monday)', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true }),
        endCondition: { type: 'date', date: localDate(2024, 1, 20) },
      }
      const lastCompleted = localDate(2024, 1, 1) // Mon
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Mon Jan 8, Mon Jan 15 — Mon Jan 22 is after end date
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 8)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 15)))
    })

    it('stops at times limit for Tue+Sat with existing count', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ tuesday: true, saturday: true }),
        endCondition: { type: 'times', times: 5 },
      }
      const lastCompleted = localDate(2024, 1, 1) // Mon
      const horizon = localDate(2024, 12, 31)
      // Already have 2 existing → count starts at 2
      // iter 1: Tue Jan 2, count=3, check(3>=5)→false, push
      // iter 2: Sat Jan 6, count=4, check(4>=5)→false, push
      // iter 3: Tue Jan 9, count=5, check(5>=5)→true, BREAK
      const result = generateFutureOccurrences(config, horizon, 2, lastCompleted)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 2)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 6)))
    })

    it('stops at times limit for specific_day_of_month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: { type: 'times', times: 4 },
      }
      const lastCompleted = localDate(2024, 1, 10)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15, Mar 15, Apr 15 — count=4 on next triggers stop
      expect(result).toHaveLength(3)
    })

    it('stops at times limit for annual_fixed', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 7,
        dayOfMonth: 4,
        endCondition: { type: 'times', times: 3 },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2030, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jul 4 2024, Jul 4 2025 — count=3 on next triggers stop
      expect(result).toHaveLength(2)
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

    it('generates on the 1st of each month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 1,
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 10, 15)
      const horizon = localDate(2025, 2, 28)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Nov 1, Dec 1, Jan 1, Feb 1
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 11, 1)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 12, 1)))
      expect(result[2]).toEqual(startOfDay(localDate(2025, 1, 1)))
      expect(result[3]).toEqual(startOfDay(localDate(2025, 2, 1)))
    })

    it('generates day 30, skipping February', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 30,
        endCondition: never,
      }
      const lastCompleted = localDate(2025, 1, 1)
      const horizon = localDate(2025, 6, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb has 28 days → skip. Mar 30, Apr 30, May 30, Jun 30
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 3, 30)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 4, 30)))
      expect(result[2]).toEqual(startOfDay(localDate(2025, 5, 30)))
      expect(result[3]).toEqual(startOfDay(localDate(2025, 6, 30)))
    })

    it('day 1 with date end condition', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 1,
        endCondition: { type: 'date', date: localDate(2024, 4, 1) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 1, Mar 1 — Apr 1 is ON end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 1)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 1)))
    })

    it('lastDayOfMonth generates every month (no skipping)', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 1,
        lastDayOfMonth: true,
        endCondition: never,
      }
      const lastCompleted = localDate(2025, 1, 1)
      const horizon = localDate(2025, 6, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 28, Mar 31, Apr 30, May 31, Jun 30
      expect(result).toHaveLength(5)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 2, 28)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 3, 31)))
      expect(result[2]).toEqual(startOfDay(localDate(2025, 4, 30)))
      expect(result[3]).toEqual(startOfDay(localDate(2025, 5, 31)))
      expect(result[4]).toEqual(startOfDay(localDate(2025, 6, 30)))
    })

    it('lastDayOfMonth with date end condition', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 1,
        lastDayOfMonth: true,
        endCondition: { type: 'date', date: localDate(2025, 4, 30) },
      }
      const lastCompleted = localDate(2025, 1, 1)
      const horizon = localDate(2025, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 28, Mar 31 — Apr 30 is ON end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 2, 28)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 3, 31)))
    })

    it('lastDayOfMonth with times end condition', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 1,
        lastDayOfMonth: true,
        endCondition: { type: 'times', times: 4 },
      }
      const lastCompleted = localDate(2025, 1, 1)
      const horizon = localDate(2025, 12, 31)
      // Feb 28 (count=1), Mar 31 (count=2), Apr 30 (count=3), May 31 count=4→stop
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 2, 28)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 3, 31)))
      expect(result[2]).toEqual(startOfDay(localDate(2025, 4, 30)))
    })

    it('day 30 with times end condition skipping February', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 30,
        endCondition: { type: 'times', times: 4 },
      }
      const lastCompleted = localDate(2025, 1, 1)
      const horizon = localDate(2025, 12, 31)
      // Feb skipped. Mar 30 (count=1), Apr 30 (count=2), May 30 (count=3), Jun 30 count=4→stop
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 3, 30)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 4, 30)))
      expect(result[2]).toEqual(startOfDay(localDate(2025, 5, 30)))
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

    it('generates last Friday of each month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'friday', occurrence: 'last' },
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 4, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Last Friday of: Feb = Feb 23, Mar = Mar 29, Apr = Apr 26
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 23)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 29)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 26)))
    })

    it('generates fourth Thursday of each month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'thursday', occurrence: 'fourth' },
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 4, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Fourth Thursday of: Feb = Feb 22, Mar = Mar 28, Apr = Apr 25
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 22)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 28)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 25)))
    })

    it('generates first Sunday of each month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'sunday', occurrence: 'first' },
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 4, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // First Sunday of: Feb = Feb 4, Mar = Mar 3, Apr = Apr 7
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 4)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 3)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 7)))
    })

    it('stops at times limit for second Saturday', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'saturday', occurrence: 'second' },
        endCondition: { type: 'times', times: 4 },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      // Feb 10 (count=1), Mar 9 (count=2), Apr 13 (count=3), May 11 count=4→stop
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 10)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 9)))
      expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 13)))
    })

    it('stops at times limit for last Sunday with existing count', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'sunday', occurrence: 'last' },
        endCondition: { type: 'times', times: 5 },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      // Already have 3 existing → count starts at 3
      // Feb 25 (count=4), Mar 31 count=5→stop
      const result = generateFutureOccurrences(config, horizon, 3, lastCompleted)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 25)))
    })

    it('stops at date end condition for fourth Thursday', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'thursday', occurrence: 'fourth' },
        endCondition: { type: 'date', date: localDate(2024, 3, 28) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      // Feb 22 — Mar 28 is ON end date → excluded
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 22)))
    })
  })

  describe('annual_fixed schedule', () => {
    it('generates yearly occurrences on the same date', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 4,
        dayOfMonth: 29,
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2027, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Apr 29 2024, Apr 29 2025, Apr 29 2026, Apr 29 2027
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 4, 29)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 4, 29)))
      expect(result[2]).toEqual(startOfDay(localDate(2026, 4, 29)))
      expect(result[3]).toEqual(startOfDay(localDate(2027, 4, 29)))
    })

    it('generates Jan 1 annually across years', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 1,
        dayOfMonth: 1,
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 6, 1)
      const horizon = localDate(2027, 6, 30)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 1 2025, Jan 1 2026, Jan 1 2027
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 1, 1)))
      expect(result[1]).toEqual(startOfDay(localDate(2026, 1, 1)))
      expect(result[2]).toEqual(startOfDay(localDate(2027, 1, 1)))
    })

    it('generates Dec 31 annually', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 12,
        dayOfMonth: 31,
        endCondition: never,
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2026, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Dec 31 2024, Dec 31 2025, Dec 31 2026
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 12, 31)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 12, 31)))
      expect(result[2]).toEqual(startOfDay(localDate(2026, 12, 31)))
    })

    it('times end condition with existing count', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 7,
        dayOfMonth: 4,
        endCondition: { type: 'times', times: 5 },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2030, 12, 31)
      // Already have 3 existing → count starts at 3
      // Jul 4 2024 (count=4), Jul 4 2025 count=5→stop
      const result = generateFutureOccurrences(config, horizon, 3, lastCompleted)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 7, 4)))
    })

    it('date end condition for Jan 1', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 1,
        dayOfMonth: 1,
        endCondition: { type: 'date', date: localDate(2027, 1, 1) },
      }
      const lastCompleted = localDate(2024, 6, 1)
      const horizon = localDate(2030, 12, 31)
      // Jan 1 2025, Jan 1 2026 — Jan 1 2027 is ON end date → excluded
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 1, 1)))
      expect(result[1]).toEqual(startOfDay(localDate(2026, 1, 1)))
    })
  })

  describe('annual_variable schedule', () => {
    it('generates yearly occurrences chained from completion', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 4,
        dayOfMonth: 29,
        endCondition: never,
      }
      // "Completed" on Aug 10 2024 → next Aug 10 2025 → Aug 10 2026 → etc
      const lastCompleted = localDate(2024, 8, 10)
      const horizon = localDate(2027, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Aug 10 2025, Aug 10 2026, Aug 10 2027
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 8, 10)))
      expect(result[1]).toEqual(startOfDay(localDate(2026, 8, 10)))
      expect(result[2]).toEqual(startOfDay(localDate(2027, 8, 10)))
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
