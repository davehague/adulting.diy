import { describe, it, expect } from 'vitest'
import { nextStepOf, formatMinutes } from '@/utils/project-steps'

const step = (id: string, doneAt: Date | string | null = null) => ({ id, doneAt })

describe('nextStepOf', () => {
  it('reports noSteps for an empty list', () => {
    expect(nextStepOf([])).toEqual({ kind: 'noSteps', step: null })
  })

  it('returns the first step that is not done', () => {
    const steps = [step('a', new Date()), step('b'), step('c')]
    expect(nextStepOf(steps)).toEqual({ kind: 'step', step: steps[1] })
  })

  it('returns the first step when none are done', () => {
    const steps = [step('a'), step('b')]
    expect(nextStepOf(steps).step).toBe(steps[0])
  })

  it('reports allDone when every step is done', () => {
    expect(nextStepOf([step('a', new Date()), step('b', '2026-10-04T12:00:00.000Z')])).toEqual({ kind: 'allDone', step: null })
  })

  it('treats a step with no doneAt key as not done', () => {
    const steps: { id: string; doneAt?: string }[] = [{ id: 'a' }]
    expect(nextStepOf(steps)).toEqual({ kind: 'step', step: steps[0] })
  })
})

describe('formatMinutes', () => {
  it('shows minutes under an hour', () => {
    expect(formatMinutes(30)).toBe('30 min')
  })

  it('shows whole hours without minutes', () => {
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(120)).toBe('2 h')
  })

  it('shows hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatMinutes(9999)).toBe('166 h 39 min')
  })
})
