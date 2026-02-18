import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startOfDay } from 'date-fns'
import { calculateCatchUpDueDate } from '@/server/utils/schedule'
import type {
  OnceScheduleConfig,
  FixedIntervalScheduleConfig,
  SpecificDaysScheduleConfig,
  SpecificDayOfMonthScheduleConfig,
  SpecificWeekdayOfMonthScheduleConfig,
  VariableIntervalScheduleConfig,
} from '@/types'

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

describe('calculateCatchUpDueDate', () => {
  // Fix "today" to Feb 17 2026 (Tuesday) for deterministic tests
  const fakeToday = new Date(2026, 1, 17)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fakeToday)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('once', () => {
    it('returns null — no new occurrence for one-time tasks', () => {
      const config: OnceScheduleConfig = {
        type: 'once',
        dueDate: new Date(2025, 0, 1),
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toBeNull()
    })
  })

  describe('fixed_interval', () => {
    it('walks forward preserving schedule anchor (2-week cadence)', () => {
      // Every 2 weeks, last overdue was Jan 6 2026
      // Jan 6 → Jan 20 → Feb 3 → Feb 17 (today, >= today) ✓
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 2,
        intervalUnit: 'week',
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2026, 0, 6))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 17)))
    })

    it('walks forward from far in the past (monthly)', () => {
      // Every 1 month, last overdue was Jun 15 2024
      // Walks: Jul 15, Aug 15, ... Feb 15 2026 (< today), Mar 15 2026 ✓
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2024, 5, 15))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 15)))
    })

    it('returns next interval from recent overdue (daily)', () => {
      // Every 7 days, last overdue was Feb 16 2026 (yesterday)
      // Feb 16 + 7d = Feb 23 (>= today) ✓
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 7,
        intervalUnit: 'day',
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2026, 1, 16))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 23)))
    })
  })

  describe('variable_interval', () => {
    it('returns today + interval (days)', () => {
      // 10 days after catch-up → Feb 17 + 10 = Feb 27
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 10, unit: 'day' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 27)))
    })

    it('returns today + interval (weeks)', () => {
      // 2 weeks → Feb 17 + 14 = Mar 3
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 2, unit: 'week' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2024, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 3)))
    })

    it('returns today + interval (months)', () => {
      // 1 month → Feb 17 + 1mo = Mar 17
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 1, unit: 'month' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2024, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 17)))
    })
  })

  describe('specific_days_of_week', () => {
    it('returns next matching weekday from today (Monday)', () => {
      // Today is Tuesday Feb 17. Looking for Monday.
      // calculateNextDueDate with yesterday (Feb 16, Mon) as base
      // → scans from Feb 17 (Tue): Tue,Wed,Thu,Fri,Sat,Sun,Mon → Mon Feb 23 ✓
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true }),
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 23)))
    })

    it('returns today if today matches the weekday', () => {
      // Today is Tuesday Feb 17. Looking for Tuesday.
      // calculateNextDueDate with yesterday (Feb 16) as base
      // → scans from Feb 17 → Feb 17 (Tue) ✓
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ tuesday: true }),
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 17)))
    })
  })

  describe('specific_day_of_month', () => {
    it('returns next month occurrence when day has passed this month', () => {
      // Day 15, today Feb 17 → calculateNextDueDate(config, yesterday=Feb 16)
      // → next month from Feb 16 = Mar 15
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 15)))
    })
  })

  describe('specific_weekday_of_month', () => {
    it('returns next month occurrence (first Monday)', () => {
      // Today Feb 17 2026. calculateNextDueDate(config, yesterday=Feb 16)
      // → next month from Feb 16 = Mar → First Monday of Mar 2026 = Mar 2
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 2)))
    })
  })
})
