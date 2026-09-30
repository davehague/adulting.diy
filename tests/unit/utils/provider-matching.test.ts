import { describe, it, expect } from 'vitest'
import { normalizeProviderName } from '@/server/utils/provider-matching'

describe('normalizeProviderName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeProviderName('  Best   Exteriors ')).toBe('best exteriors')
  })
  it('drops parenthetical text', () => {
    expect(normalizeProviderName('Best Exteriors (Drew Paetow)')).toBe('best exteriors')
  })
  it('strips punctuation and treats & as and', () => {
    expect(normalizeProviderName("Bob's Heating & Cooling, LLC.")).toBe('bobs heating and cooling llc')
  })
  it('returns empty string for punctuation-only input', () => {
    expect(normalizeProviderName('()!!')).toBe('')
  })
})
