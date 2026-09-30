import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey } from '@/server/utils/api-key'

describe('api keys', () => {
  it('generates a prefixed key whose hash matches hashApiKey', () => {
    const { key, prefix, hashedKey } = generateApiKey()
    expect(key.startsWith('adk_')).toBe(true)
    expect(key.startsWith(prefix)).toBe(true)
    expect(hashedKey).toBe(hashApiKey(key))
    expect(hashedKey).toMatch(/^[0-9a-f]{64}$/)
  })
  it('generates unique keys', () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key)
  })
})
