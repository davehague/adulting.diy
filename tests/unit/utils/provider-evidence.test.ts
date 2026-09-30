import { describe, it, expect } from 'vitest'
import { summarizeEvidence } from '@/server/utils/provider-evidence'

describe('summarizeEvidence', () => {
  it('handles no evidence', () => {
    expect(summarizeEvidence([])).toEqual({ mentionCount: 0, neighborCount: 0, lastSightingAt: null })
  })
  it('counts all rows as mentions and only third_party as neighbors', () => {
    const result = summarizeEvidence([
      { kind: 'third_party', sourceDate: new Date('2026-07-05') },
      { kind: 'third_party', sourceDate: new Date('2026-07-21') },
      { kind: 'self_promo', sourceDate: null },
    ])
    expect(result.mentionCount).toBe(3)
    expect(result.neighborCount).toBe(2)
    expect(result.lastSightingAt).toEqual(new Date('2026-07-21'))
  })
})
