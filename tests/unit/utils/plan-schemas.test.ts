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

describe('planReplySchema with the small deviations a model makes', () => {
  const clamped = (body: unknown) => clampPlan(planReplySchema.parse(body))
  it('accepts a numeric, null or missing quantity as text', () => {
    const out = clamped(reply({ materials: [material({ quantity: 2 }), material({ quantity: null }), material({ quantity: undefined }), material({ quantity: '  3 sheets ' })] }))
    expect(out.materials.map((m) => m.quantity)).toEqual(['2', '', '', '3 sheets'])
  })
  it('treats a null or missing pro and have as false', () => {
    const out = clamped(reply({ steps: [step({ pro: null, proWhy: 'ignored' }), step({ pro: undefined })], tools: [tool({ have: null, priceLow: 5, priceHigh: 9 })] }))
    expect(out.steps.map((s) => s.pro)).toEqual([false, false])
    expect(out.steps[0].proWhy).toBeNull()
    expect(out.tools[0]).toMatchObject({ have: false, priceLow: 5, priceHigh: 9 })
  })
  it('defaults a step with no minutes or cost fields to zero', () => {
    const out = clamped(reply({ steps: [{ text: 'Sand it' }] }))
    expect(out.steps[0]).toEqual({ text: 'Sand it', minutes: 0, costLow: 0, costHigh: 0, pro: false, proWhy: null })
  })
  it('accepts a difficulty in any case with spaces around it', () => {
    expect(clamped(reply({ summary: summary({ difficulty: 'Moderate' }) })).summary?.difficulty).toBe('moderate')
    expect(clamped(reply({ summary: summary({ difficulty: ' HIRE ' }) })).summary?.difficulty).toBe('hire')
  })
  it('still rejects an unknown or missing difficulty', () => {
    expect(planReplySchema.safeParse(reply({ summary: summary({ difficulty: 'medium' }) })).success).toBe(false)
    expect(planReplySchema.safeParse(reply({ summary: summary({ difficulty: 3 }) })).success).toBe(false)
    expect(planReplySchema.safeParse(reply({ summary: summary({ difficulty: undefined }) })).success).toBe(false)
  })
  it('still rejects a plan that is not too vague and has no usable summary', () => {
    expect(planReplySchema.safeParse(reply({ tooVague: false, summary: undefined })).success).toBe(false)
    expect(planReplySchema.safeParse(reply({ tooVague: false, summary: summary({ why: '   ' }) })).success).toBe(false)
  })
  it('keeps zero minutes at zero', () => {
    expect(clamped(reply({ steps: [step({ minutes: 0 })] })).steps[0].minutes).toBe(0)
  })
  it('cuts over-long text in the clamp instead of rejecting the reply', () => {
    const out = clamped(
      reply({
        summary: summary({ why: 'w'.repeat(500) }),
        safety: 's'.repeat(500),
        steps: [step({ text: 't'.repeat(500), pro: true, proWhy: 'p'.repeat(500) })],
        tools: [tool({ name: 'n'.repeat(500) })],
        materials: [material({ name: 'm'.repeat(500), quantity: 'q'.repeat(500) })],
      }),
    )
    expect(out.summary?.why).toHaveLength(400)
    expect(out.safety).toHaveLength(400)
    expect(out.steps[0].text).toHaveLength(200)
    expect(out.steps[0].proWhy).toHaveLength(400)
    expect(out.tools[0].name).toHaveLength(120)
    expect(out.materials[0].name).toHaveLength(120)
    expect(out.materials[0].quantity).toHaveLength(60)
  })
  it('turns a reply with every deviation into something savedPlanSchema accepts', () => {
    const lenient = {
      tooVague: false,
      summary: { totalMinutes: 12.5, costLow: -4, costHigh: 99.6, difficulty: 'Hard', why: 'w'.repeat(450) },
      safety: 's'.repeat(450),
      steps: [{ text: 't'.repeat(450), pro: null }, { text: 'Hire it', minutes: 20, pro: true, proWhy: 'p'.repeat(450) }],
      tools: [{ name: 'n'.repeat(450), have: null }],
      materials: [{ name: 'm'.repeat(450), quantity: 2 }, { name: 'Screws', quantity: null }],
    }
    const out = clamped(lenient)
    const saved = savedPlanSchema.safeParse(out)
    expect(saved.success).toBe(true)
    if (saved.success) expect(saved.data).toEqual(out)
  })
})

describe('planReplySchema with null lists', () => {
  it('parses a too-vague reply whose lists are null and clamps it to the empty result', () => {
    const parsed = planReplySchema.parse({ tooVague: true, summary: null, safety: null, steps: null, tools: null, materials: null })
    expect(parsed).toMatchObject({ steps: [], tools: [], materials: [] })
    expect(clampPlan(parsed)).toEqual({ tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] })
  })
  it('parses a plan whose lists are null with empty arrays', () => {
    const parsed = planReplySchema.parse(reply({ steps: null, tools: null, materials: null }))
    expect(parsed).toMatchObject({ steps: [], tools: [], materials: [] })
  })
})

describe('planReplySchema with a too-vague reply', () => {
  const empty = { tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] }
  it('ignores a half-filled body', () => {
    expect(planReplySchema.parse({ tooVague: true, summary: {}, steps: [{ text: '' }] })).toEqual(empty)
  })
  it('ignores a summary with an empty why', () => {
    expect(planReplySchema.parse({ tooVague: true, summary: { why: '' } })).toEqual(empty)
  })
  it('still rejects an empty summary when the reply is not too vague', () => {
    expect(planReplySchema.safeParse({ tooVague: false, summary: {} }).success).toBe(false)
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
  it('keeps each step within the checklist estimate limit but lets the total go higher', () => {
    const out = clampPlan(planReplySchema.parse(reply({ steps: [step({ minutes: 10_080 }), step({ minutes: 10_080 })] })))
    expect(out.steps.map((s) => s.minutes)).toEqual([9999, 9999])
    expect(out.summary?.totalMinutes).toBe(10_080)
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
