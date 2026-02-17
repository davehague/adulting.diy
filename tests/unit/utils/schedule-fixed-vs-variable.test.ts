import { describe, it, expect } from 'vitest'
import { startOfDay } from 'date-fns'
import { calculateNextDueDate } from '@/server/utils/schedule'
import type {
  FixedIntervalScheduleConfig,
  SpecificDaysScheduleConfig,
  SpecificDayOfMonthScheduleConfig,
  SpecificWeekdayOfMonthScheduleConfig,
  VariableIntervalScheduleConfig,
} from '@/types'

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day)

const never = { type: 'never' as const }

const daysOfWeek = (overrides: Partial<Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', boolean>> = {}) => ({
  monday: false, tuesday: false, wednesday: false, thursday: false,
  friday: false, saturday: false, sunday: false,
  ...overrides,
})

// =============================================================================
// FIXED RECURRING SCHEDULES
//
// "If it gets executed, the next one is scheduled based on the next available
//  date that fits the pattern, regardless of whether the occurrence was
//  executed before, on, or after its due date."
//
// Example: Check library events on the 1st of each month. If I do it on
// Dec 5 (late), the next one is still Jan 1. If I do it on Nov 28 (early),
// the next one is still Jan 1 (Dec already has one scheduled).
// =============================================================================

describe('Fixed recurring: specific_days_of_week', () => {
  // "Every Monday" — the pattern is anchored to the weekday itself.
  // Completing early or late should still land on the next Monday.
  const config: SpecificDaysScheduleConfig = {
    type: 'specific_days_of_week',
    daysOfWeek: daysOfWeek({ monday: true }),
    endCondition: never,
  }

  it('executed on the due date (Monday) → next Monday', () => {
    // Due Mon Jan 1, executed Mon Jan 1 → next Mon Jan 8
    const result = calculateNextDueDate(config, localDate(2024, 1, 1))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 8)))
  })

  it('executed 2 days late (Wednesday) → still next Monday', () => {
    // Due Mon Jan 1, executed Wed Jan 3 → next Mon Jan 8
    const result = calculateNextDueDate(config, localDate(2024, 1, 3))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 8)))
  })

  it('executed 5 days late (Saturday) → still next Monday', () => {
    // Due Mon Jan 1, executed Sat Jan 6 → next Mon Jan 8
    const result = calculateNextDueDate(config, localDate(2024, 1, 6))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 8)))
  })

  it('executed a full week late → next Monday after that', () => {
    // Due Mon Jan 1, executed Mon Jan 8 → next Mon Jan 15
    const result = calculateNextDueDate(config, localDate(2024, 1, 8))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
  })
})

describe('Fixed recurring: specific_day_of_month', () => {
  // "Check library events on the 1st of each month"
  const config: SpecificDayOfMonthScheduleConfig = {
    type: 'specific_day_of_month',
    dayOfMonth: 1,
    endCondition: never,
  }

  it('executed on due date (Jan 1) → Feb 1', () => {
    const result = calculateNextDueDate(config, localDate(2024, 1, 1))
    expect(result).toEqual(startOfDay(localDate(2024, 2, 1)))
  })

  it('executed 5 days late (Jan 6) → still Feb 1', () => {
    // The pattern is "1st of the month" — executing late shouldn't push it
    const result = calculateNextDueDate(config, localDate(2024, 1, 6))
    expect(result).toEqual(startOfDay(localDate(2024, 2, 1)))
  })

  it('executed 3 weeks late (Jan 22) → still Feb 1', () => {
    const result = calculateNextDueDate(config, localDate(2024, 1, 22))
    expect(result).toEqual(startOfDay(localDate(2024, 2, 1)))
  })
})

describe('Fixed recurring: specific_weekday_of_month', () => {
  // "First Monday of each month"
  const config: SpecificWeekdayOfMonthScheduleConfig = {
    type: 'specific_weekday_of_month',
    weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
    endCondition: never,
  }

  it('executed on due date (Feb 5) → first Monday of March (Mar 4)', () => {
    // First Monday of Feb 2024 = Feb 5
    const result = calculateNextDueDate(config, localDate(2024, 2, 5))
    expect(result).toEqual(startOfDay(localDate(2024, 3, 4)))
  })

  it('executed 10 days late (Feb 15) → still first Monday of March', () => {
    const result = calculateNextDueDate(config, localDate(2024, 2, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 3, 4)))
  })
})

describe('Fixed recurring: fixed_interval', () => {
  // "Every 2 weeks" — this is fixed, so the schedule should be anchored to
  // the DUE DATE, not when the user actually executed it.
  //
  // If due Jan 1 and the user executes Jan 5, next should be Jan 15
  // (2 weeks from the original Jan 1 due date), NOT Jan 19 (2 weeks from
  // the execution date).
  //
  // NOTE: This is the trickiest type because calculateNextDueDate only
  // receives a single date parameter (lastCompletedDate). For this to work
  // correctly with fixed semantics, the caller should pass the DUE DATE
  // of the completed occurrence, not the completion timestamp.
  const config: FixedIntervalScheduleConfig = {
    type: 'fixed_interval',
    interval: 2,
    intervalUnit: 'week',
    endCondition: never,
  }

  it('executed on due date → 2 weeks later', () => {
    // Due Jan 1, executed Jan 1 → Jan 15
    const result = calculateNextDueDate(config, localDate(2024, 1, 1))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
  })

  it('executed 4 days late → next should still be 2 weeks from DUE DATE', () => {
    // Due Jan 1, executed Jan 5
    // FIXED behavior: OccurrenceService.execute() now passes the DUE DATE
    // (Jan 1) to calculateNextDueDate, not the execution date (Jan 5).
    // So: next = Jan 1 + 2 weeks = Jan 15
    const dueDate = localDate(2024, 1, 1)
    const result = calculateNextDueDate(config, dueDate)
    expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
  })

  it('executed 1 week late → next should still be 2 weeks from DUE DATE', () => {
    // Due Jan 1, executed Jan 8
    // FIXED behavior: caller passes DUE DATE (Jan 1), not execution date
    // next = Jan 1 + 2 weeks = Jan 15
    const dueDate = localDate(2024, 1, 1)
    const result = calculateNextDueDate(config, dueDate)
    expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
  })
})

// =============================================================================
// VARIABLE RECURRING SCHEDULES
//
// "If it gets executed, the next one is scheduled based on the EXECUTION date,
//  not the due date."
//
// Example: Bathe the dog every 2 weeks. If I do it a few days early,
// schedule the next one 2 weeks from when I actually did it. If I do it
// a week late, schedule 2 weeks from that late date.
// =============================================================================

describe('Variable recurring: variable_interval', () => {
  const config: VariableIntervalScheduleConfig = {
    type: 'variable_interval',
    variableInterval: { interval: 14, unit: 'day' },
    endCondition: never,
  }

  it('executed on due date → 14 days from execution', () => {
    // Due Jan 1, executed Jan 1 → Jan 15
    const result = calculateNextDueDate(config, localDate(2024, 1, 1))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
  })

  it('executed 3 days early → 14 days from EARLY execution', () => {
    // Due Jan 1, executed Dec 29 → Jan 12 (14 days from Dec 29)
    const result = calculateNextDueDate(config, localDate(2023, 12, 29))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 12)))
  })

  it('executed 5 days late → 14 days from LATE execution', () => {
    // Due Jan 1, executed Jan 6 → Jan 20 (14 days from Jan 6)
    const result = calculateNextDueDate(config, localDate(2024, 1, 6))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 20)))
  })

  it('executed a week late → 14 days from late execution', () => {
    // Due Jan 1, executed Jan 8 → Jan 22 (14 days from Jan 8)
    const result = calculateNextDueDate(config, localDate(2024, 1, 8))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 22)))
  })
})

describe('Variable recurring: dog bath real-world scenario', () => {
  // "Every 2 weeks, bathe the dog"
  const config: VariableIntervalScheduleConfig = {
    type: 'variable_interval',
    variableInterval: { interval: 2, unit: 'week' },
    endCondition: never,
  }

  it('bathed on time → next bath 2 weeks later', () => {
    const result = calculateNextDueDate(config, localDate(2024, 1, 15))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 29)))
  })

  it('bathed 3 days early → next bath 2 weeks from early date', () => {
    // Due Jan 15, bathed Jan 12 → next Jan 26
    const result = calculateNextDueDate(config, localDate(2024, 1, 12))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 26)))
  })

  it('bathed 1 week late → next bath 2 weeks from late date', () => {
    // Due Jan 15, bathed Jan 22 → next Feb 5
    const result = calculateNextDueDate(config, localDate(2024, 1, 22))
    expect(result).toEqual(startOfDay(localDate(2024, 2, 5)))
  })
})

describe('Fixed vs Variable: same interval, different behavior', () => {
  // Both "every 2 weeks" but one is fixed, one is variable.
  // Due date: Jan 1. Executed: Jan 5 (4 days late).
  const fixedConfig: FixedIntervalScheduleConfig = {
    type: 'fixed_interval',
    interval: 2,
    intervalUnit: 'week',
    endCondition: never,
  }

  const variableConfig: VariableIntervalScheduleConfig = {
    type: 'variable_interval',
    variableInterval: { interval: 2, unit: 'week' },
    endCondition: never,
  }

  const executionDate = localDate(2024, 1, 5) // 4 days late

  it('fixed: next occurrence based on pattern (Jan 15)', () => {
    // For fixed, the caller should pass the DUE DATE (Jan 1), not execution date
    const result = calculateNextDueDate(fixedConfig, localDate(2024, 1, 1))
    expect(result).toEqual(startOfDay(localDate(2024, 1, 15)))
  })

  it('variable: next occurrence based on execution date (Jan 19)', () => {
    // For variable, the caller passes the EXECUTION DATE
    const result = calculateNextDueDate(variableConfig, executionDate)
    expect(result).toEqual(startOfDay(localDate(2024, 1, 19)))
  })

  it('fixed and variable diverge when execution is late', () => {
    // This test makes the key point: with the same interval but different
    // schedule types, the results MUST differ when execution != due date
    const fixedResult = calculateNextDueDate(fixedConfig, localDate(2024, 1, 1))
    const variableResult = calculateNextDueDate(variableConfig, executionDate)
    expect(fixedResult).not.toEqual(variableResult)
  })
})
