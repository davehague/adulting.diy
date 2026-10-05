import { describe, it, expect } from 'vitest'
import { rankProviders, fallbackProviders, type Rankable } from '@/server/utils/provider-ranking'

const p = (name: string, overrides: Partial<Omit<Rankable, 'status'>> & { kind?: 'neutral' | 'positive' | 'negative' } = {}): Rankable => {
  const { kind = 'neutral', ...rest } = overrides
  return { name, rating: null, neighborCount: 0, lastSightingAt: null, status: { kind }, ...rest }
}
const names = (items: Rankable[]): string[] => items.map((item) => item.name)

describe('rankProviders', () => {
  it('drops negative-kind statuses', () => {
    expect(names(rankProviders([p('Avoided', { kind: 'negative', rating: 5, neighborCount: 9 }), p('Kept')]))).toEqual(['Kept'])
  })

  it('puts positive-kind statuses before all others, whatever the evidence', () => {
    expect(names(rankProviders([p('Lead', { neighborCount: 8 }), p('Hired', { kind: 'positive', rating: 2 })]))).toEqual(['Hired', 'Lead'])
  })

  it('orders by rating within a tier, unrated after rated', () => {
    expect(names(rankProviders([p('Unrated', { neighborCount: 5 }), p('Three', { rating: 3 }), p('Five', { rating: 5 })]))).toEqual(['Five', 'Three', 'Unrated'])
  })

  it('then by neighbor count, then by most recent sighting, then by name', () => {
    const ranked = rankProviders([
      p('Zed', { neighborCount: 2, lastSightingAt: new Date('2026-01-01') }),
      p('Old', { neighborCount: 2, lastSightingAt: new Date('2024-01-01') }),
      p('Many', { neighborCount: 5 }),
      p('Beta'),
      p('Alpha'),
      p('New', { neighborCount: 2, lastSightingAt: '2026-06-01T00:00:00.000Z' }),
    ])
    expect(names(ranked)).toEqual(['Many', 'New', 'Zed', 'Old', 'Alpha', 'Beta'])
  })

  it('does not change the array it was given', () => {
    const input = [p('B'), p('A')]
    rankProviders(input)
    expect(names(input)).toEqual(['B', 'A'])
  })

  it('returns an empty list for no providers', () => {
    expect(rankProviders([])).toEqual([])
  })
})

describe('fallbackProviders', () => {
  it('leaves out a neutral provider with no neighbor recommendations and no rating', () => {
    const result = fallbackProviders([p('Bare'), p('Rated', { rating: 1 }), p('Vouched', { neighborCount: 1 }), p('Hired', { kind: 'positive' })])
    expect(names(result)).toEqual(['Hired', 'Rated', 'Vouched'])
  })

  it('keeps at most five', () => {
    const many = Array.from({ length: 8 }, (_, i) => p(`P${i}`, { neighborCount: 8 - i }))
    expect(fallbackProviders(many)).toHaveLength(5)
  })
})
