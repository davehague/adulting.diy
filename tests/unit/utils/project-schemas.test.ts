import { describe, it, expect } from 'vitest'
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectProviderLinkSchema,
  projectProviderStatusSchema,
  photoDimensionsSchema,
  stepCreateSchema,
  stepUpdateSchema,
  parseStatusFilter,
  parsePathFilter,
} from '@/server/utils/project-schemas'

// Returns the statusCode of the error a function throws, or undefined if it does not throw.
const thrownStatus = (fn: () => unknown): number | undefined => {
  try {
    fn()
  } catch (error) {
    return (error as { statusCode?: number }).statusCode
  }
  return undefined
}

describe('projectCreateSchema', () => {
  it('trims the title and accepts a title alone', () => {
    const parsed = projectCreateSchema.parse({ title: '  Paint ceiling spots  ' })
    expect(parsed.title).toBe('Paint ceiling spots')
  })

  it('rejects a title of only spaces', () => {
    const result = projectCreateSchema.safeParse({ title: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Title is required')
  })

  it('rejects a title over 200 characters', () => {
    expect(projectCreateSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false)
  })

  it('stores a location of only spaces as null', () => {
    expect(projectCreateSchema.parse({ title: 'A', location: '   ' }).location).toBeNull()
  })

  it('rejects a location over 100 characters', () => {
    expect(projectCreateSchema.safeParse({ title: 'A', location: 'x'.repeat(101) }).success).toBe(false)
  })

  it('accepts multi-line notes and stores empty notes as null', () => {
    expect(projectCreateSchema.parse({ title: 'A', notes: 'line one\nline two' }).notes).toBe('line one\nline two')
    expect(projectCreateSchema.parse({ title: 'A', notes: '  ' }).notes).toBeNull()
  })
})

describe('projectUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(projectUpdateSchema.parse({ status: 'active' })).toEqual({ status: 'active' })
  })

  it('accepts clearing the path with null', () => {
    expect(projectUpdateSchema.parse({ path: null })).toEqual({ path: null })
  })

  it('rejects an unknown status', () => {
    expect(projectUpdateSchema.safeParse({ status: 'someday' }).success).toBe(false)
  })

  it('rejects an unknown path', () => {
    expect(projectUpdateSchema.safeParse({ path: 'contractor' }).success).toBe(false)
  })

  it('stores empty notes as null', () => {
    expect(projectUpdateSchema.parse({ notes: '  ' }).notes).toBeNull()
  })
})

describe('photoDimensionsSchema', () => {
  it('coerces numeric strings from multipart fields', () => {
    expect(photoDimensionsSchema.parse({ width: '2000', height: '1500' })).toEqual({ width: 2000, height: 1500 })
  })

  it('rejects missing or zero dimensions', () => {
    expect(photoDimensionsSchema.safeParse({ width: undefined, height: '10' }).success).toBe(false)
    expect(photoDimensionsSchema.safeParse({ width: '0', height: '10' }).success).toBe(false)
  })
})

describe('parseStatusFilter', () => {
  it('defaults to planning and active', () => {
    expect(parseStatusFilter(undefined)).toEqual(['planning', 'active'])
    expect(parseStatusFilter('')).toEqual(['planning', 'active'])
  })

  it('parses a comma-separated list', () => {
    expect(parseStatusFilter('active,done')).toEqual(['active', 'done'])
  })

  it('rejects an unknown status with a 400', () => {
    expect(thrownStatus(() => parseStatusFilter('active,someday'))).toBe(400)
  })
})

describe('parsePathFilter', () => {
  it('returns undefined when absent', () => {
    expect(parsePathFilter(undefined)).toBeUndefined()
    expect(parsePathFilter('')).toBeUndefined()
  })

  it('accepts the three paths and none', () => {
    expect(parsePathFilter('diy')).toBe('diy')
    expect(parsePathFilter('none')).toBe('none')
  })

  it('rejects an unknown path with a 400', () => {
    expect(thrownStatus(() => parsePathFilter('contractor'))).toBe(400)
  })
})

const ESTIMATE_MESSAGE = 'Estimate must be a whole number of minutes from 1 to 9999'

describe('stepCreateSchema', () => {
  it('trims the text and accepts text alone', () => {
    const parsed = stepCreateSchema.parse({ text: '  Buy primer  ' })
    expect(parsed.text).toBe('Buy primer')
    expect(parsed.estimateMinutes).toBeUndefined()
  })

  it('rejects missing text and text of only spaces', () => {
    for (const body of [{}, { text: '   ' }]) {
      const result = stepCreateSchema.safeParse(body)
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0].message).toBe('Step text is required')
    }
  })

  it('accepts 200 characters and rejects 201', () => {
    expect(stepCreateSchema.safeParse({ text: 'a'.repeat(200) }).success).toBe(true)
    const result = stepCreateSchema.safeParse({ text: 'a'.repeat(201) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Step text must be 200 characters or fewer')
  })

  it('accepts an estimate from 1 to 9999 and null', () => {
    expect(stepCreateSchema.parse({ text: 'x', estimateMinutes: 1 }).estimateMinutes).toBe(1)
    expect(stepCreateSchema.parse({ text: 'x', estimateMinutes: 9999 }).estimateMinutes).toBe(9999)
    expect(stepCreateSchema.parse({ text: 'x', estimateMinutes: null }).estimateMinutes).toBeNull()
  })

  it('rejects an estimate that is not a whole number from 1 to 9999', () => {
    for (const estimateMinutes of [0, -5, 1.5, 10000, '30', 'abc']) {
      const result = stepCreateSchema.safeParse({ text: 'x', estimateMinutes })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0].message).toBe(ESTIMATE_MESSAGE)
    }
  })
})

describe('stepUpdateSchema', () => {
  it('accepts an empty body and each field alone', () => {
    expect(stepUpdateSchema.parse({})).toEqual({})
    expect(stepUpdateSchema.parse({ done: true })).toEqual({ done: true })
    expect(stepUpdateSchema.parse({ text: ' Sand the patch ' })).toEqual({ text: 'Sand the patch' })
    expect(stepUpdateSchema.parse({ estimateMinutes: null })).toEqual({ estimateMinutes: null })
  })

  it('rejects text of only spaces', () => {
    const result = stepUpdateSchema.safeParse({ text: '  ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Step text is required')
  })

  it('rejects a done value that is not a boolean', () => {
    const result = stepUpdateSchema.safeParse({ done: 'yes' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Done must be true or false')
  })

  it('rejects a bad estimate', () => {
    const result = stepUpdateSchema.safeParse({ estimateMinutes: 1.5 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe(ESTIMATE_MESSAGE)
  })
})

describe('projectUpdateSchema provider category', () => {
  it('accepts a category id and null', () => {
    expect(projectUpdateSchema.parse({ providerCategoryId: 'c1' })).toEqual({ providerCategoryId: 'c1' })
    expect(projectUpdateSchema.parse({ providerCategoryId: null })).toEqual({ providerCategoryId: null })
  })

  it('leaves the category out when it is not sent', () => {
    expect('providerCategoryId' in projectUpdateSchema.parse({ status: 'active' })).toBe(false)
  })

  it('rejects an empty string and a non-string', () => {
    expect(projectUpdateSchema.safeParse({ providerCategoryId: '' }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({ providerCategoryId: 7 }).success).toBe(false)
  })
})

describe('projectProviderLinkSchema', () => {
  it('accepts a provider id', () => {
    expect(projectProviderLinkSchema.parse({ providerId: 'pr1' })).toEqual({ providerId: 'pr1' })
  })

  it('rejects a missing, empty or non-string provider id with the message', () => {
    for (const body of [{}, { providerId: '' }, { providerId: 5 }, null]) {
      const parsed = projectProviderLinkSchema.safeParse(body)
      expect(parsed.success).toBe(false)
    }
    const parsed = projectProviderLinkSchema.safeParse({})
    expect(parsed.success ? '' : parsed.error.issues[0].message).toBe('Provider is required')
  })
})

describe('projectProviderStatusSchema', () => {
  it('accepts each of the four statuses', () => {
    for (const status of ['considering', 'contacted', 'chosen', 'passed']) {
      expect(projectProviderStatusSchema.parse({ status })).toEqual({ status })
    }
  })

  it('rejects anything else with the message', () => {
    for (const body of [{ status: 'hired' }, { status: '' }, {}, { status: 3 }]) {
      const parsed = projectProviderStatusSchema.safeParse(body)
      expect(parsed.success ? '' : parsed.error.issues[0].message).toBe('Unknown status')
    }
  })
})
