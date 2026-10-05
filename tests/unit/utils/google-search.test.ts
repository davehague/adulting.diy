import { describe, it, expect } from 'vitest'
import { withNearMe, googleSearchUrl } from '@/utils/google-search'

describe('withNearMe', () => {
  it('appends "near me" when it is missing', () => {
    expect(withNearMe('ceiling leak plumber')).toBe('ceiling leak plumber near me')
  })
  it('leaves a phrase that already ends with it, in any case', () => {
    expect(withNearMe('plumber Near Me')).toBe('plumber Near Me')
  })
  it('trims and collapses whitespace', () => {
    expect(withNearMe('  drywall   repair \n')).toBe('drywall repair near me')
  })
})

describe('googleSearchUrl', () => {
  it('builds a Google search URL with the phrase encoded', () => {
    expect(googleSearchUrl('plumber & drain near me')).toBe('https://www.google.com/search?q=plumber%20%26%20drain%20near%20me')
  })
  it('cannot be turned into another site by the phrase', () => {
    expect(googleSearchUrl('https://evil.example/?q=x')).toMatch(/^https:\/\/www\.google\.com\/search\?q=https%3A%2F%2Fevil/)
  })
})
