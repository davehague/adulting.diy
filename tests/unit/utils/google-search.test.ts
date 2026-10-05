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
  it('removes a lone surrogate so the phrase is clean before it is saved', () => {
    const out = withNearMe('leak \uD83D plumber')
    expect(out).toBe('leak plumber near me')
    expect(() => encodeURIComponent(out)).not.toThrow()
  })
  it('keeps a real emoji, which is a valid surrogate pair', () => {
    expect(withNearMe('🔧 plumber')).toBe('🔧 plumber near me')
  })
})

describe('googleSearchUrl', () => {
  it('builds a Google search URL with the phrase encoded', () => {
    expect(googleSearchUrl('plumber & drain near me')).toBe('https://www.google.com/search?q=plumber%20%26%20drain%20near%20me')
  })
  it('cannot be turned into another site by the phrase', () => {
    expect(googleSearchUrl('https://evil.example/?q=x')).toMatch(/^https:\/\/www\.google\.com\/search\?q=https%3A%2F%2Fevil/)
  })
  it('does not throw on a lone surrogate and still returns a Google URL', () => {
    const url = googleSearchUrl('plumber \uD83D near me')
    expect(url).toMatch(/^https:\/\/www\.google\.com\/search\?q=/)
    expect(url).toBe('https://www.google.com/search?q=plumber%20%20near%20me')
  })
  it('removes a lone low surrogate too', () => {
    expect(() => googleSearchUrl('a\uDE00b')).not.toThrow()
    expect(googleSearchUrl('a\uDE00b')).toBe('https://www.google.com/search?q=ab')
  })
  it('keeps a real emoji intact and encodes it', () => {
    expect(googleSearchUrl('🔧 plumber')).toBe('https://www.google.com/search?q=%F0%9F%94%A7%20plumber')
  })
})
