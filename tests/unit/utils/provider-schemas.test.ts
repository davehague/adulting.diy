import { describe, it, expect } from 'vitest'
import {
  providerInputSchema, ingestBatchSchema, deleteWithMoveSchema, commentSchema,
} from '@/server/utils/provider-schemas'

describe('providerInputSchema', () => {
  it('requires name and categoryId only', () => {
    expect(providerInputSchema.safeParse({ name: 'A', categoryId: 'c1' }).success).toBe(true)
    expect(providerInputSchema.safeParse({ name: '', categoryId: 'c1' }).success).toBe(false)
    expect(providerInputSchema.safeParse({ name: 'A' }).success).toBe(false)
  })
  it('bounds rating to 1-5', () => {
    expect(providerInputSchema.safeParse({ name: 'A', categoryId: 'c', rating: 6 }).success).toBe(false)
    expect(providerInputSchema.safeParse({ name: 'A', categoryId: 'c', rating: 5 }).success).toBe(true)
  })
})

describe('ingestBatchSchema', () => {
  const item = { name: 'Best Exteriors', category: 'Roofing', evidence: [{ sourceUrl: 'https://x.test/1', kind: 'third_party' }] }
  it('accepts a valid batch', () => {
    expect(ingestBatchSchema.safeParse({ providers: [item] }).success).toBe(true)
  })
  it('rejects more than 500 items', () => {
    expect(ingestBatchSchema.safeParse({ providers: Array(501).fill(item) }).success).toBe(false)
  })
  it('does not reject the batch for a single bad item at the schema level', () => {
    // Per-item validation happens in the ingest service so one bad row cannot fail the batch.
    expect(ingestBatchSchema.safeParse({ providers: [item, { nonsense: true }] }).success).toBe(true)
  })
})

describe('other schemas', () => {
  it('deleteWithMoveSchema allows an optional moveToId', () => {
    expect(deleteWithMoveSchema.safeParse({}).success).toBe(true)
    expect(deleteWithMoveSchema.safeParse({ moveToId: 'c2' }).success).toBe(true)
  })
  it('commentSchema rejects blank bodies', () => {
    expect(commentSchema.safeParse({ body: '   ' }).success).toBe(false)
  })
})
