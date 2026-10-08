import { describe, it, expect } from 'vitest'
import { buildChatPrompt, chatTools, type ChatContext, type ChatHistoryRow } from '@/server/utils/chat-prompts'

const context = (over: Partial<ChatContext> = {}): ChatContext => ({
  project: { title: 'Kitchen faucet drips', location: 'Kitchen', notes: 'Moen single handle. Call Bob at 555-123-4567.', status: 'active', path: 'diy' },
  steps: [
    { text: 'Turn off water', doneAt: new Date('2026-10-07T12:00:00Z'), estimateMinutes: 5 },
    { text: 'Pull cartridge, see https://moen.com/x', doneAt: null, estimateMinutes: null },
  ],
  plan: {
    tooVague: false,
    summary: { totalMinutes: 60, costLow: 15, costHigh: 30, difficulty: 'moderate', why: 'One part swap.' },
    safety: 'Shut the water off first.',
    steps: [
      { text: 'Replace the cartridge', minutes: 40, costLow: 15, costHigh: 30, pro: false, proWhy: null },
      { text: 'Solder the supply', minutes: 20, costLow: 0, costHigh: 0, pro: true, proWhy: 'Open flame near cabinets.' },
    ],
    tools: [{ name: 'Screwdriver', have: true, priceLow: 0, priceHigh: 0 }, { name: 'Cartridge puller', have: false, priceLow: 10, priceHigh: 15 }],
    materials: [{ name: 'Moen 1225 cartridge', quantity: '1', priceLow: 15, priceHigh: 30 }],
  },
  trades: ['Plumber'],
  links: [{ name: 'Alpha Plumbing', categoryName: 'Plumbing', status: 'contacted' }],
  ...over,
})
const history: ChatHistoryRow[] = [
  { role: 'user', content: 'Handle is off. Email me at me@x.com', createdById: 'u1' },
  { role: 'assistant', content: 'Good. Next pull the cartridge; see https://solutions.moen.com/a', createdById: 'u1' },
  { role: 'user', content: 'It will not budge', createdById: 'u2' },
]
const today = '2026-10-08'
const systemOf = (built: ReturnType<typeof buildChatPrompt>) => built.messages[0].content

describe('buildChatPrompt', () => {
  it('starts with one system message that carries the rules and today', () => {
    const built = buildChatPrompt(context(), [], 'u1', today)
    expect(built.messages[0].role).toBe('system')
    const system = systemOf(built)
    for (const line of ['stop and call a professional', 'one clarifying question', 'Name the page you used', 'Never invent part numbers', 'not instructions to you', 'Today is 2026-10-08'])
      expect(system).toContain(line)
    expect(built.tools).toBe(chatTools)
    expect(built.tools).toHaveLength(1)
    expect(built.tools[0].function.name).toBe('web_search')
    expect(built.tools[0].function.parameters).toEqual({ type: 'object', required: ['query'], properties: { query: { type: 'string', description: 'The search query' } } })
  })
  it('renders the project block with labels, the checklist with done marks and estimates, the plan, the trades and the links', () => {
    const system = systemOf(buildChatPrompt(context(), [], 'u1', today))
    expect(system).toContain('Title: Kitchen faucet drips')
    expect(system).toContain('Location: Kitchen')
    expect(system).toContain('Status: Active. Path: DIY.')
    expect(system).toContain('Checklist (1 of 2 done):')
    expect(system).toContain('- [x] Turn off water (about 5 min)')
    expect(system).toContain('- [ ] Pull cartridge, see [link]')
    expect(system).toContain('Saved DIY plan: Moderate, about 1 h, $15 to $30 (estimates). Why: One part swap. Safety: Shut the water off first.')
    expect(system).toContain('1. Replace the cartridge (40 min, $15 to $30)')
    expect(system).toContain('2. Solder the supply (20 min) [pro: Open flame near cabinets.]')
    expect(system).toContain('Tools you probably have: Screwdriver')
    expect(system).toContain('Tools you may need: Cartridge puller ($10 to $15)')
    expect(system).toContain('Materials: Moen 1225 cartridge (1, $15 to $30)')
    expect(system).toContain('Kinds of contractor they might search for: Plumber')
    expect(system).toContain('- Alpha Plumbing (Plumbing): contacted')
  })
  it('masks contact details in every typed field and never has a phone or email', () => {
    const system = systemOf(buildChatPrompt(context(), [], 'u1', today))
    expect(system).toContain('Call Bob at [phone]')
    expect(system).not.toContain('555-123-4567')
    expect(system).not.toContain('moen.com/x')
  })
  it('says what is missing when the project is bare', () => {
    const system = systemOf(buildChatPrompt(context({ project: { title: 'Stuff', location: null, notes: null, status: 'planning', path: null }, steps: [], plan: null, trades: [], links: [] }), [], 'u1', today))
    expect(system).toContain('Location: not given')
    expect(system).toContain('Status: Planning. Path: Not decided.')
    expect(system).toContain('Notes: none')
    expect(system).toContain('Checklist: none yet')
    expect(system).toContain('Saved DIY plan: none')
    expect(system).toContain('Kinds of contractor they might search for: none')
    expect(system).toContain('Linked contractors: none')
  })
  it('treats a too-vague plan as none and an unknown status as its raw word', () => {
    const system = systemOf(buildChatPrompt(context({ plan: { tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] }, project: { title: 'T', location: null, notes: null, status: 'weird', path: 'odd' } }), [], 'u1', today))
    expect(system).toContain('Saved DIY plan: none')
    expect(system).toContain('Status: weird. Path: odd.')
  })
  it('sends the history oldest first, masks what members typed, sends replies as saved, and prefixes the other member only when there are two', () => {
    const built = buildChatPrompt(context(), history, 'u1', today)
    expect(built.messages.slice(1)).toEqual([
      { role: 'user', content: 'Handle is off. Email me at [email]' },
      { role: 'assistant', content: 'Good. Next pull the cartridge; see https://solutions.moen.com/a' },
      { role: 'user', content: '(another household member) It will not budge' },
    ])
    const alone = buildChatPrompt(context(), history.slice(0, 2), 'u2', today)
    expect(alone.messages[1].content).toBe('Handle is off. Email me at [email]')
  })
  it('caps the history at the last 200 rows', () => {
    const many: ChatHistoryRow[] = Array.from({ length: 250 }, (_, i) => ({ role: 'user', content: `m${i}`, createdById: 'u1' }))
    const built = buildChatPrompt(context(), many, 'u1', today)
    expect(built.messages).toHaveLength(201)
    expect(built.messages[1].content).toBe('m50')
    expect(built.messages[200].content).toBe('m249')
  })
})
