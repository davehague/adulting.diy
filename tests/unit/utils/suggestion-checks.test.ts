import { describe, it, expect } from 'vitest'
import { cleanParts, checkPicks } from '@/server/utils/suggestion-checks'

const labels = new Map([['c1', 'uuid-plumb'], ['c2', 'uuid-dry']])
const part = (name: string, categoryId: string | null, searchPhrase = 'find one') => ({ name, categoryId, why: 'why', searchPhrase })

describe('cleanParts', () => {
  it('maps labels to category ids and finishes the search phrase', () => {
    expect(cleanParts([part('Leak', 'c1', 'leak plumber')], labels)).toEqual([
      { name: 'Leak', why: 'why', categoryId: 'uuid-plumb', searchPhrase: 'leak plumber near me' },
    ])
  })
  it('turns an unknown or invented category into none', () => {
    expect(cleanParts([part('Masonry', 'c9'), part('Other', 'Masonry')], labels).map((p) => p.categoryId)).toEqual([null, null])
  })
  it('drops a later part that repeats a category, but keeps several parts with none', () => {
    const cleaned = cleanParts([part('A', 'c1'), part('B', 'c1'), part('C', null), part('D', null)], labels)
    expect(cleaned.map((p) => p.name)).toEqual(['A', 'C', 'D'])
  })
  it('keeps at most four parts', () => {
    const many = [part('1', null), part('2', null), part('3', null), part('4', null), part('5', null)]
    expect(cleanParts(many, labels)).toHaveLength(4)
  })
})

describe('checkPicks', () => {
  const ids = new Map([['p1', 'uuid-a'], ['p2', 'uuid-b'], ['p3', 'uuid-c']])
  const byPart = new Map([[0, new Set(['p1', 'p2'])], [1, new Set(['p3'])]])
  const pick = (providerId: string, reason = 'r') => ({ providerId, reason })

  it('maps labels back to provider ids, keeping order', () => {
    const result = checkPicks([{ partIndex: 0, picks: [pick('p2', 'second'), pick('p1', 'first')] }], ids, byPart)
    expect(result.get(0)).toEqual([{ providerId: 'uuid-b', reason: 'second' }, { providerId: 'uuid-a', reason: 'first' }])
  })
  it('drops a label that is not in the request at all', () => {
    expect(checkPicks([{ partIndex: 0, picks: [pick('p99'), pick('p1')] }], ids, byPart).get(0)).toEqual([{ providerId: 'uuid-a', reason: 'r' }])
  })
  it("drops a provider from another part's pool", () => {
    expect(checkPicks([{ partIndex: 0, picks: [pick('p3')] }], ids, byPart).get(0)).toEqual([])
  })
  it('drops a duplicate pick within a part', () => {
    expect(checkPicks([{ partIndex: 0, picks: [pick('p1'), pick('p1')] }], ids, byPart).get(0)).toHaveLength(1)
  })
  it('keeps at most three picks', () => {
    const wide = new Map([[0, new Set(['p1', 'p2', 'p3', 'p4'])]])
    const wideIds = new Map([['p1', 'a'], ['p2', 'b'], ['p3', 'c'], ['p4', 'd']])
    expect(checkPicks([{ partIndex: 0, picks: [pick('p1'), pick('p2'), pick('p3'), pick('p4')] }], wideIds, wide).get(0)).toHaveLength(3)
  })
  it('ignores a part index that was never sent, and a repeated part index', () => {
    const result = checkPicks([{ partIndex: 7, picks: [pick('p1')] }, { partIndex: 1, picks: [pick('p3')] }, { partIndex: 1, picks: [] }], ids, byPart)
    expect(result.has(7)).toBe(false)
    expect(result.get(1)).toEqual([{ providerId: 'uuid-c', reason: 'r' }])
  })
})
