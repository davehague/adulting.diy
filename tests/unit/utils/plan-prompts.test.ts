import { describe, it, expect } from 'vitest'
import { buildPlanPrompt } from '@/server/utils/plan-prompts'

const project = { title: 'Water stain on ceiling', location: 'Dining room', notes: 'Under the upstairs bath. Call 614-555-0101 if lost.', extra: 'I own a drill' }

describe('buildPlanPrompt', () => {
  const built = buildPlanPrompt(project, [{ name: 'Fix the leak', why: 'It leaks. See https://fb.example/p/1' }, { name: 'Repair the ceiling', why: 'Bubbling drywall.' }], '2026-10-06')
  const sent = JSON.parse(built.user)

  it('sends the project text with blanks for missing fields and the trades as names only', () => {
    expect(Object.keys(sent).sort()).toEqual(['project', 'trades'])
    expect(sent.project).toMatchObject({ title: 'Water stain on ceiling', location: 'Dining room', extra: 'I own a drill' })
    expect(sent.trades).toEqual(['Fix the leak', 'Repair the ceiling'])
  })
  it('masks contact details in every free-text field', () => {
    expect(built.user).not.toContain('614-555-0101')
    expect(built.user).toContain('[phone]')
    expect(built.user).not.toContain('fb.example')
    expect(built.user).not.toContain('It leaks')
    expect(built.user).not.toContain('Bubbling')
  })
  it('sends an empty trades list when there is no saved suggestion', () => {
    expect(JSON.parse(buildPlanPrompt({ ...project, extra: null }, [], '2026-10-06').user)).toMatchObject({ trades: [], project: { extra: '' } })
  })
  it('states the date, the toolkit, the hire rule and the JSON shape in the system prompt', () => {
    expect(built.system).toContain('Today is 2026-10-06.')
    expect(built.system).toContain('basic toolkit')
    expect(built.system).toContain('"hire"')
    expect(built.system).toContain('Reply with one JSON object and nothing else')
    expect(built.system).toContain('"tooVague"')
    expect(built.system).toContain('set summary and safety to null')
    expect(built.system).toContain('not a decision to hire anyone')
    expect(built.system).not.toContain('use them as the outline')
  })
})
