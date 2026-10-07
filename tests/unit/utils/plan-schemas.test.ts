import { describe, it, expect } from 'vitest'
import { planReplySchema, savedPlanSchema, stepBatchSchema, clampPlan } from '@/server/utils/plan-schemas'

const step = (overrides: Record<string, unknown> = {}) => ({ text: 'Cut out the damaged drywall', minutes: 30, costLow: 0, costHigh: 0, pro: false, proWhy: null, ...overrides })
const tool = (overrides: Record<string, unknown> = {}) => ({ name: 'Drywall saw', have: false, priceLow: 10, priceHigh: 15, ...overrides })
const material = (overrides: Record<string, unknown> = {}) => ({ name: 'Joint compound', quantity: '1 qt', priceLow: 8, priceHigh: 12, ...overrides })
const summary = (overrides: Record<string, unknown> = {}) => ({ totalMinutes: 180, costLow: 60, costHigh: 120, difficulty: 'moderate', why: 'Mostly patching.', ...overrides })
const reply = (overrides: Record<string, unknown> = {}) => ({ tooVague: false, summary: summary(), safety: null, steps: [step()], tools: [tool()], materials: [material()], ...overrides })

describe('planReplySchema', () => {
  it('accepts a full plan', () => {
    expect(planReplySchema.safeParse(reply()).success).toBe(true)
  })
  it('accepts a bare too-vague reply', () => {
    expect(planReplySchema.safeParse({ tooVague: true }).success).toBe(true)
  })
  it('rejects a plan with no summary when it is not too vague', () => {
    expect(planReplySchema.safeParse(reply({ summary: null })).success).toBe(false)
  })
  it('rejects an unknown difficulty', () => {
    expect(planReplySchema.safeParse(reply({ summary: summary({ difficulty: 'medium' }) })).success).toBe(false)
  })
  it('accepts fractional and negative numbers, leaving the clamp to fix them', () => {
    expect(planReplySchema.safeParse(reply({ steps: [step({ minutes: 12.5, costLow: -3 })] })).success).toBe(true)
  })
  it('rejects a step without text', () => {
    expect(planReplySchema.safeParse(reply({ steps: [step({ text: '   ' })] })).success).toBe(false)
  })
  it('treats a missing safety or proWhy as null', () => {
    const parsed = planReplySchema.parse(reply({ safety: undefined, steps: [{ text: 'x', minutes: 1, costLow: 0, costHigh: 0, pro: false }] }))
    expect(parsed.safety).toBeNull()
    expect(parsed.steps[0].proWhy).toBeNull()
  })
})

describe('clampPlan', () => {
  it('returns an empty too-vague result', () => {
    expect(clampPlan(planReplySchema.parse({ tooVague: true }))).toEqual({ tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] })
  })
  it('rounds and bounds numbers and swaps a reversed range', () => {
    const out = clampPlan(planReplySchema.parse(reply({ steps: [step({ minutes: 12.5, costLow: 80, costHigh: 40 })], tools: [tool({ priceLow: -5, priceHigh: 1_000_000 })] })))
    expect(out.steps[0]).toMatchObject({ minutes: 13, costLow: 40, costHigh: 80 })
    expect(out.tools[0]).toMatchObject({ priceLow: 0, priceHigh: 100_000 })
  })
  it('keeps at most 30 steps, tools and materials', () => {
    const many = Array.from({ length: 40 }, (_, i) => step({ text: `Step ${i}` }))
    const out = clampPlan(planReplySchema.parse(reply({ steps: many, tools: Array(35).fill(tool()), materials: Array(31).fill(material()) })))
    expect(out.steps).toHaveLength(30)
    expect(out.tools).toHaveLength(30)
    expect(out.materials).toHaveLength(30)
  })
  it('cuts a step text to 200 characters so it can always be added to the checklist', () => {
    const out = clampPlan(planReplySchema.parse(reply({ steps: [step({ text: 'x'.repeat(250) })] })))
    expect(out.steps[0].text).toHaveLength(200)
  })
  it('zeroes a pro step cost and drops proWhy from a non-pro step', () => {
    const out = clampPlan(planReplySchema.parse(reply({ steps: [step({ pro: true, proWhy: 'Licensed plumber.', costLow: 50, costHigh: 90 }), step({ pro: false, proWhy: 'ignored' })] })))
    expect(out.steps[0]).toMatchObject({ pro: true, proWhy: 'Licensed plumber.', costLow: 0, costHigh: 0 })
    expect(out.steps[1].proWhy).toBeNull()
  })
  it('recomputes the total minutes from the steps', () => {
    const out = clampPlan(planReplySchema.parse(reply({ summary: summary({ totalMinutes: 5 }), steps: [step({ minutes: 30 }), step({ minutes: 45 })] })))
    expect(out.summary?.totalMinutes).toBe(75)
  })
  it('clamps the summary cost range and trims text', () => {
    const out = clampPlan(planReplySchema.parse(reply({ summary: summary({ costLow: 200, costHigh: 100, why: '  Because.  ' }), safety: '  Shut off the water.  ' })))
    expect(out.summary).toMatchObject({ costLow: 100, costHigh: 200, why: 'Because.' })
    expect(out.safety).toBe('Shut off the water.')
  })
})

describe('savedPlanSchema', () => {
  it('accepts what clampPlan produces', () => {
    expect(savedPlanSchema.safeParse(clampPlan(planReplySchema.parse(reply()))).success).toBe(true)
  })
  it('rejects a shape it does not know', () => {
    expect(savedPlanSchema.safeParse({ version: 2, plan: 'x' }).success).toBe(false)
  })
})

describe('stepBatchSchema', () => {
  it('accepts up to 30 valid steps', () => {
    expect(stepBatchSchema.safeParse({ steps: Array(30).fill({ text: 'Do it', estimateMinutes: 10 }) }).success).toBe(true)
  })
  it('rejects an empty list and a list over 30 with the messages', () => {
    const empty = stepBatchSchema.safeParse({ steps: [] })
    const many = stepBatchSchema.safeParse({ steps: Array(31).fill({ text: 'Do it' }) })
    expect(empty.success).toBe(false)
    expect(many.success).toBe(false)
    if (!empty.success) expect(empty.error.issues[0].message).toBe('Add at least one step')
    if (!many.success) expect(many.error.issues[0].message).toBe('Add at most 30 steps at a time')
  })
  it('applies the step rules to each entry', () => {
    expect(stepBatchSchema.safeParse({ steps: [{ text: 'x'.repeat(201) }] }).success).toBe(false)
  })
})
