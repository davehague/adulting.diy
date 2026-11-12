import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Scripts must send x-api-version with their PUT or Blob stores a PDF as a download. The value is copied from the SDK;
// this fails when an SDK upgrade changes it, so the copy is updated with it. Read as text: importing blob-storage pulls the SDK.
describe('BLOB_API_VERSION', () => {
  it('matches the installed @vercel/blob', () => {
    const dist = join(process.cwd(), 'node_modules/@vercel/blob/dist')
    const versions = new Set<string>()
    for (const file of readdirSync(dist).filter((name) => name.endsWith('.js'))) {
      for (const match of readFileSync(join(dist, file), 'utf8').matchAll(/BLOB_API_VERSION = (\d+)/g)) versions.add(match[1])
    }
    expect([...versions]).toHaveLength(1)
    const ours = /export const BLOB_API_VERSION = '(\d+)'/.exec(readFileSync(join(process.cwd(), 'server/utils/blob-storage.ts'), 'utf8'))
    expect(ours?.[1]).toBe([...versions][0])
  })
})
