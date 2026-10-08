import { describe, it, expect, afterEach, vi } from 'vitest'
import { chatModel, suggestionModel, suggestionsEnabledFor } from '@/server/utils/ai-config'

afterEach(() => vi.unstubAllEnvs())

describe('suggestionModel', () => {
  it('defaults to glm-5.3-flash', () => {
    vi.stubEnv('AI_SUGGESTIONS_MODEL', '')
    expect(suggestionModel()).toBe('glm-5.3-flash')
  })
  it('uses the setting when present', () => {
    vi.stubEnv('AI_SUGGESTIONS_MODEL', ' deepseek-v4.1-flash ')
    expect(suggestionModel()).toBe('deepseek-v4.1-flash')
  })
})

describe('chatModel', () => {
  it('defaults to glm-5.3', () => {
    vi.stubEnv('AI_CHAT_MODEL', '')
    expect(chatModel()).toBe('glm-5.3')
  })
  it('uses the setting when present, trimmed', () => {
    vi.stubEnv('AI_CHAT_MODEL', ' glm-5.4 ')
    expect(chatModel()).toBe('glm-5.4')
  })
})

describe('suggestionsEnabledFor', () => {
  it('is on for a listed household when the key is set', () => {
    vi.stubEnv('OLLAMA_API_KEY', 'k')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1, h2')
    expect(suggestionsEnabledFor('h2')).toBe(true)
  })
  it('is off for a household that is not listed', () => {
    vi.stubEnv('OLLAMA_API_KEY', 'k')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
    expect(suggestionsEnabledFor('h9')).toBe(false)
  })
  it('is off when the list is empty or unset', () => {
    vi.stubEnv('OLLAMA_API_KEY', 'k')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', '')
    expect(suggestionsEnabledFor('h1')).toBe(false)
  })
  it('is off when the key is only whitespace, even for a listed household', () => {
    vi.stubEnv('OLLAMA_API_KEY', ' \n')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
    expect(suggestionsEnabledFor('h1')).toBe(false)
  })
  it('is on when the key has a trailing newline around real text', () => {
    vi.stubEnv('OLLAMA_API_KEY', 'k\n')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
    expect(suggestionsEnabledFor('h1')).toBe(true)
  })
  it('is off when the key is unset, even for a listed household', () => {
    vi.stubEnv('OLLAMA_API_KEY', '')
    vi.stubEnv('AI_SUGGESTIONS_HOUSEHOLD_IDS', 'h1')
    expect(suggestionsEnabledFor('h1')).toBe(false)
  })
})
