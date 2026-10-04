import { describe, it, expect } from 'vitest'
import { isVariableSchedule } from '@/utils/schedule-type'

describe('isVariableSchedule', () => {
  it.each(['variable_interval', 'annual_variable'])('%s is variable', (type) => {
    expect(isVariableSchedule({ type })).toBe(true)
  })

  it.each([
    'once',
    'fixed_interval',
    'specific_days_of_week',
    'specific_day_of_month',
    'specific_weekday_of_month',
    'annual_fixed',
  ])('%s is anchored, not variable', (type) => {
    expect(isVariableSchedule({ type })).toBe(false)
  })

  it('treats a missing config as not variable', () => {
    expect(isVariableSchedule(undefined)).toBe(false)
    expect(isVariableSchedule(null)).toBe(false)
  })
})
