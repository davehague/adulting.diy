import { describe, it, expect } from 'vitest'
import { buildRoutingPrompt, buildPickingPrompt, type PoolProvider } from '@/server/utils/suggestion-prompts'

const project = { title: 'Water stain on ceiling', location: 'Dining room', notes: 'Under the upstairs bath.', extra: null }

const provider = (id: string, overrides: Partial<PoolProvider> = {}): PoolProvider => ({
  id, name: `Provider ${id.replace('uuid-', '').toUpperCase()}`, statusName: 'Lead', statusKind: 'neutral', rating: null, notes: null, comments: [], evidence: [], ...overrides,
})

describe('buildRoutingPrompt', () => {
  const built = buildRoutingPrompt(project, [{ id: 'uuid-plumb', name: 'Plumber' }, { id: 'uuid-dry', name: 'Drywall' }], '2026-10-05')

  it('sends categories under labels and maps the labels back', () => {
    const sent = JSON.parse(built.user)
    expect(sent.categories).toEqual([{ id: 'c1', name: 'Plumber' }, { id: 'c2', name: 'Drywall' }])
    expect(built.categoryIdByLabel.get('c2')).toBe('uuid-dry')
  })
  it('sends the project text with blanks for missing fields', () => {
    expect(JSON.parse(built.user).project).toEqual({ title: 'Water stain on ceiling', location: 'Dining room', notes: 'Under the upstairs bath.', extra: '' })
  })
  it('never sends a database id', () => {
    expect(built.user).not.toContain('uuid-')
  })
  it('states the date and the JSON shape in the system prompt', () => {
    expect(built.system).toContain('Today is 2026-10-05.')
    expect(built.system).toContain('Reply with one JSON object and nothing else')
  })
})

describe('buildPickingPrompt', () => {
  const evidence = Array.from({ length: 10 }, (_, i) => ({
    kind: 'third_party', sourceDate: new Date(Date.UTC(2026, 0, i + 1)), snippet: `post ${i + 1} ${'x'.repeat(700)}`,
  }))
  const parts = [
    { partIndex: 0, name: 'Fix the leak', categoryName: 'Plumber', pool: [provider('uuid-a', { evidence, notes: 'n'.repeat(1200), comments: Array.from({ length: 12 }, (_, i) => `comment ${i}`) }), provider('uuid-b')] },
    { partIndex: 2, name: 'Repaint', categoryName: 'Painter', pool: [provider('uuid-c', { evidence: [{ kind: 'lead', sourceDate: null, snippet: null }] })] },
  ]
  const built = buildPickingPrompt(project, parts, '2026-10-05')
  const sent = JSON.parse(built.user)

  it('labels providers uniquely across the request and maps them back', () => {
    expect(sent.parts[0].pool.map((p: { id: string }) => p.id)).toEqual(['p1', 'p2'])
    expect(sent.parts[1].pool.map((p: { id: string }) => p.id)).toEqual(['p3'])
    expect(built.providerIdByLabel.get('p3')).toBe('uuid-c')
    expect([...built.labelsByPart.get(0)!]).toEqual(['p1', 'p2'])
    expect([...built.labelsByPart.get(2)!]).toEqual(['p3'])
  })
  it('keeps each part index as given', () => {
    expect(sent.parts.map((p: { partIndex: number }) => p.partIndex)).toEqual([0, 2])
  })
  it('sends the 8 most recent evidence rows, newest first, each cut to 600 characters', () => {
    const rows = sent.parts[0].pool[0].evidence
    expect(rows).toHaveLength(8)
    expect(rows[0].date).toBe('2026-01-10')
    expect(rows[7].date).toBe('2026-01-03')
    expect(rows[0].snippet).toHaveLength(600)
  })
  it('cuts notes to 1000 characters and comments to the first 10', () => {
    expect(sent.parts[0].pool[0].notes).toHaveLength(1000)
    expect(sent.parts[0].pool[0].comments).toHaveLength(10)
  })
  it('sends a null date and an empty snippet as they are', () => {
    expect(sent.parts[1].pool[0].evidence).toEqual([{ kind: 'lead', date: null, snippet: '' }])
  })
  it('sends exactly the agreed provider fields and no database id', () => {
    expect(Object.keys(sent.parts[0].pool[0]).sort()).toEqual(['comments', 'evidence', 'id', 'name', 'notes', 'rating', 'status', 'statusKind'])
    expect(built.user).not.toContain('uuid-')
  })
})
