import { describe, it, expect } from 'vitest'
import { startOfDay } from 'date-fns'
import { calculateNextDueDate, generateFutureOccurrences } from '@/server/utils/schedule'
import type {
  SpecificDayOfMonthScheduleConfig,
  SpecificWeekdayOfMonthScheduleConfig,
  VariableIntervalScheduleConfig,
  AnnualFixedScheduleConfig,
  AnnualVariableScheduleConfig,
} from '@/types'

// Helper: local-time date constructor (month is 1-indexed for readability)
const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day)

const never = { type: 'never' as const }

// =============================================================================
// 1. DAY-OF-MONTH EDGE CASES: months with fewer days than the target
// =============================================================================

describe('specific_day_of_month: month-length boundaries', () => {

  it('day 30 skips February in a non-leap year (28 days)', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 30,
      endCondition: never,
    }
    // Jan 15 2025 → Feb 2025 has 28 days, no 30th → Mar 30
    const result = calculateNextDueDate(config, localDate(2025, 1, 15))
    expect(result).toEqual(startOfDay(localDate(2025, 3, 30)))
  })

  it('day 30 skips February in a leap year (29 days)', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 30,
      endCondition: never,
    }
    // Jan 15 2024 → Feb 2024 has 29 days but no 30th → Mar 30
    const result = calculateNextDueDate(config, localDate(2024, 1, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 3, 30)))
  })

  it('day 31 skips April (30 days) and lands on May 31', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 31,
      endCondition: never,
    }
    // Mar 15 2024 → Apr has 30 days → May 31
    const result = calculateNextDueDate(config, localDate(2024, 3, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 5, 31)))
  })

  it('day 31 skips June (30 days) and lands on July 31', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 31,
      endCondition: never,
    }
    // May 15 2024 → Jun has 30 days → Jul 31
    const result = calculateNextDueDate(config, localDate(2024, 5, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 7, 31)))
  })

  it('day 31 skips September (30 days) and lands on October 31', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 31,
      endCondition: never,
    }
    // Aug 15 2024 → Sep has 30 days → Oct 31
    const result = calculateNextDueDate(config, localDate(2024, 8, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 10, 31)))
  })

  it('day 31: consecutive 31-day months go month-to-month (Jul → Aug)', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 31,
      endCondition: never,
    }
    // Jul 15 2024 → Aug has 31 days → Aug 31
    const result = calculateNextDueDate(config, localDate(2024, 7, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 8, 31)))
  })

  it('day 31 generates the correct full-year sequence (7 months with 31 days)', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 31,
      endCondition: never,
    }
    const result = generateFutureOccurrences(
      config, localDate(2024, 12, 31), 0, localDate(2023, 12, 15)
    )

    // Months with 31 days: Jan, Mar, May, Jul, Aug, Oct, Dec
    // Skips: Feb(28/29), Apr(30), Jun(30), Sep(30), Nov(30)
    const expected = [
      localDate(2024, 1, 31),
      localDate(2024, 3, 31),
      localDate(2024, 5, 31),
      localDate(2024, 7, 31),
      localDate(2024, 8, 31),
      localDate(2024, 10, 31),
      localDate(2024, 12, 31),
    ]

    expect(result).toHaveLength(7)
    expected.forEach((date, i) => {
      expect(result[i]).toEqual(startOfDay(date))
    })
  })

  it('day 30 generates the correct full-year sequence (skips only Feb)', () => {
    const config: SpecificDayOfMonthScheduleConfig = {
      type: 'specific_day_of_month',
      dayOfMonth: 30,
      endCondition: never,
    }
    const result = generateFutureOccurrences(
      config, localDate(2024, 12, 31), 0, localDate(2023, 12, 15)
    )

    // Day 30 exists in every month except Feb
    const expected = [
      localDate(2024, 1, 30),
      localDate(2024, 3, 30),
      localDate(2024, 4, 30),
      localDate(2024, 5, 30),
      localDate(2024, 6, 30),
      localDate(2024, 7, 30),
      localDate(2024, 8, 30),
      localDate(2024, 9, 30),
      localDate(2024, 10, 30),
      localDate(2024, 11, 30),
      localDate(2024, 12, 30),
    ]

    expect(result).toHaveLength(11)
    expected.forEach((date, i) => {
      expect(result[i]).toEqual(startOfDay(date))
    })
  })
})

// =============================================================================
// 2. WEEKDAY-OF-MONTH: "last" vs "fourth" and month variations
// =============================================================================

describe('specific_weekday_of_month: last occurrence edge cases', () => {

  it('last Friday in a 5-Friday month (Mar 2024: Fri 1,8,15,22,29)', () => {
    const config: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'friday', occurrence: 'last' },
      endCondition: never,
    }
    // Feb 15 → next month = Mar 2024
    const result = calculateNextDueDate(config, localDate(2024, 2, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 3, 29)))
  })

  it('last Friday in a 4-Friday month (Apr 2024: Fri 5,12,19,26)', () => {
    const config: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'friday', occurrence: 'last' },
      endCondition: never,
    }
    // Mar 15 → next month = Apr 2024
    const result = calculateNextDueDate(config, localDate(2024, 3, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 4, 26)))
  })

  it('fourth and last Friday differ in a 5-Friday month', () => {
    // Mar 2024: Fri 1,8,15,22,29 → fourth=22, last=29
    const fourthConfig: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'friday', occurrence: 'fourth' },
      endCondition: never,
    }
    const lastConfig: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'friday', occurrence: 'last' },
      endCondition: never,
    }

    const fourthResult = calculateNextDueDate(fourthConfig, localDate(2024, 2, 15))
    const lastResult = calculateNextDueDate(lastConfig, localDate(2024, 2, 15))

    expect(fourthResult).toEqual(startOfDay(localDate(2024, 3, 22)))
    expect(lastResult).toEqual(startOfDay(localDate(2024, 3, 29)))
    expect(fourthResult).not.toEqual(lastResult)
  })

  it('fourth and last Friday are the same in a 4-Friday month', () => {
    // Apr 2024: Fri 5,12,19,26 → fourth=26, last=26
    const fourthConfig: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'friday', occurrence: 'fourth' },
      endCondition: never,
    }
    const lastConfig: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'friday', occurrence: 'last' },
      endCondition: never,
    }

    const fourthResult = calculateNextDueDate(fourthConfig, localDate(2024, 3, 15))
    const lastResult = calculateNextDueDate(lastConfig, localDate(2024, 3, 15))

    expect(fourthResult).toEqual(startOfDay(localDate(2024, 4, 26)))
    expect(lastResult).toEqual(startOfDay(localDate(2024, 4, 26)))
    expect(fourthResult).toEqual(lastResult)
  })

  it('last Sunday uses day index 0 correctly (Mar 2024: Sun 3,10,17,24,31)', () => {
    const config: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'sunday', occurrence: 'last' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2024, 2, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 3, 31)))
  })

  it('last Monday in leap-year February (Feb 2024: Mon 5,12,19,26)', () => {
    const config: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'monday', occurrence: 'last' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2024, 1, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 2, 26)))
  })

  it('last Monday in non-leap February (Feb 2025: Mon 3,10,17,24)', () => {
    const config: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'monday', occurrence: 'last' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2025, 1, 15))
    expect(result).toEqual(startOfDay(localDate(2025, 2, 24)))
  })

  it('last Saturday across year boundary (Jan 2025: Sat 4,11,18,25)', () => {
    const config: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'saturday', occurrence: 'last' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2024, 12, 15))
    expect(result).toEqual(startOfDay(localDate(2025, 1, 25)))
  })

  it('generates last Friday across months with varying Friday counts', () => {
    const config: SpecificWeekdayOfMonthScheduleConfig = {
      type: 'specific_weekday_of_month',
      weekdayOfMonth: { weekday: 'friday', occurrence: 'last' },
      endCondition: never,
    }
    const result = generateFutureOccurrences(
      config, localDate(2024, 6, 30), 0, localDate(2024, 1, 15)
    )

    // Last Friday of each month Feb–Jun 2024:
    // Feb: Fri 2,9,16,23       → last = 23
    // Mar: Fri 1,8,15,22,29    → last = 29 (5 Fridays)
    // Apr: Fri 5,12,19,26      → last = 26
    // May: Fri 3,10,17,24,31   → last = 31 (5 Fridays)
    // Jun: Fri 7,14,21,28      → last = 28
    expect(result).toHaveLength(5)
    expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 23)))
    expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 29)))
    expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 26)))
    expect(result[3]).toEqual(startOfDay(localDate(2024, 5, 31)))
    expect(result[4]).toEqual(startOfDay(localDate(2024, 6, 28)))
  })
})

// =============================================================================
// 3. VARIABLE INTERVAL: late completion and month/year boundary cases
// =============================================================================

describe('variable_interval: late completion and boundary edge cases', () => {

  it('very late completion: every 14 days, completed 2 months late', () => {
    // Due Jan 1, user finally completes on Mar 5 → next = Mar 19
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 14, unit: 'day' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2024, 3, 5))
    expect(result).toEqual(startOfDay(localDate(2024, 3, 19)))
  })

  it('month interval crossing year boundary (Nov + 2 months → Jan)', () => {
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 2, unit: 'month' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2024, 11, 15))
    expect(result).toEqual(startOfDay(localDate(2025, 1, 15)))
  })

  it('month interval clamps Jan 31 to Feb 29 in leap year', () => {
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 1, unit: 'month' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2024, 1, 31))
    expect(result).toEqual(startOfDay(localDate(2024, 2, 29)))
  })

  it('month interval clamps Jan 31 to Feb 28 in non-leap year', () => {
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 1, unit: 'month' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2025, 1, 31))
    expect(result).toEqual(startOfDay(localDate(2025, 2, 28)))
  })

  it('year interval from Feb 29 clamps to Feb 28 in non-leap year', () => {
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 1, unit: 'year' },
      endCondition: never,
    }
    // Feb 29 2024 (leap) + 1 year → Feb 28 2025 (non-leap, date-fns clamps)
    const result = calculateNextDueDate(config, localDate(2024, 2, 29))
    expect(result).toEqual(startOfDay(localDate(2025, 2, 28)))
  })

  it('week interval crossing year boundary (Dec 30 + 1 week → Jan 6)', () => {
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 1, unit: 'week' },
      endCondition: never,
    }
    const result = calculateNextDueDate(config, localDate(2024, 12, 30))
    expect(result).toEqual(startOfDay(localDate(2025, 1, 6)))
  })

  it('month interval chain propagates clamping (Jan 31 → Feb 29 → Mar 29 → ...)', () => {
    // Variable interval chains from previous occurrence, not the original date.
    // Once Jan 31 clamps to Feb 29, subsequent months use 29 as the day.
    const config: VariableIntervalScheduleConfig = {
      type: 'variable_interval',
      variableInterval: { interval: 1, unit: 'month' },
      endCondition: never,
    }
    const result = generateFutureOccurrences(
      config, localDate(2024, 5, 31), 0, localDate(2024, 1, 31)
    )

    // Jan 31 +1mo → Feb 29 (clamped)
    // Feb 29 +1mo → Mar 29 (drift: not Mar 31!)
    // Mar 29 +1mo → Apr 29
    // Apr 29 +1mo → May 29
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 29)))
    expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 29)))
    expect(result[2]).toEqual(startOfDay(localDate(2024, 4, 29)))
    expect(result[3]).toEqual(startOfDay(localDate(2024, 5, 29)))
  })
})

// =============================================================================
// 4. ANNUAL SCHEDULES: Feb 29 and leap year transitions
// =============================================================================

describe('annual schedules: Feb 29 and leap year edge cases', () => {

  describe('annual_fixed on Feb 29', () => {
    it('returns Feb 29 correctly in a leap year', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 2,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Jan 1 2024 → Feb 29 2024 is in the future (leap year)
      const result = calculateNextDueDate(config, localDate(2024, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2024, 2, 29)))
    })

    it('overflows to March 1 in non-leap year (JS Date behavior)', () => {
      // NOTE: This documents current behavior. new Date(2025, 1, 29) = Mar 1 in JS.
      // The code uses raw Date constructor without leap-year validation.
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 2,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Jan 1 2025 (non-leap) → new Date(2025, 1, 29) = Mar 1
      const result = calculateNextDueDate(config, localDate(2025, 1, 1))
      expect(result).toEqual(startOfDay(localDate(2025, 3, 1)))
    })

    it('generates annual sequence showing leap/non-leap overflow', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 2,
        dayOfMonth: 29,
        endCondition: never,
      }
      const result = generateFutureOccurrences(
        config, localDate(2027, 12, 31), 0, localDate(2024, 1, 1)
      )

      // 2024: Feb 29 (leap year — correct)
      // 2025: new Date(2025,1,29) = Mar 1 (JS overflow)
      // 2026: new Date(2026,1,29) = Mar 1 (JS overflow)
      // 2027: new Date(2027,1,29) = Mar 1 (JS overflow)
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 29)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 3, 1)))
      expect(result[2]).toEqual(startOfDay(localDate(2026, 3, 1)))
      expect(result[3]).toEqual(startOfDay(localDate(2027, 3, 1)))
    })
  })

  describe('annual_variable from Feb 29', () => {
    it('completed Feb 29 in leap year → date-fns clamps to Feb 28 next year', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 2,
        dayOfMonth: 29,
        endCondition: never,
      }
      // Feb 29 2024 + 1 year via addYears → Feb 28 2025 (date-fns clamps)
      const result = calculateNextDueDate(config, localDate(2024, 2, 29))
      expect(result).toEqual(startOfDay(localDate(2025, 2, 28)))
    })

    it('completed Feb 28 in non-leap year → Feb 28 next year', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 2,
        dayOfMonth: 28,
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2025, 2, 28))
      expect(result).toEqual(startOfDay(localDate(2026, 2, 28)))
    })
  })

  describe('annual_fixed on Dec 31 with late completion', () => {
    it('completed late in January → targets Dec 31 of same year', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 12,
        dayOfMonth: 31,
        endCondition: never,
      }
      // Due Dec 31 2024, completed Jan 15 2025 → Dec 31 2025 is in future
      const result = calculateNextDueDate(config, localDate(2025, 1, 15))
      expect(result).toEqual(startOfDay(localDate(2025, 12, 31)))
    })

    it('completed on Dec 31 → rolls to Dec 31 next year', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 12,
        dayOfMonth: 31,
        endCondition: never,
      }
      const result = calculateNextDueDate(config, localDate(2024, 12, 31))
      expect(result).toEqual(startOfDay(localDate(2025, 12, 31)))
    })
  })
})
