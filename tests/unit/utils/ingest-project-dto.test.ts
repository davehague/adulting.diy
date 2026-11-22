import { describe, it, expect } from 'vitest'
import { toIngestDocument, toIngestPhoto, toIngestProvider, toIngestStep } from '@/server/utils/ingest-project-dto'

describe('ingest project DTO mappers', () => {
  describe('toIngestStep', () => {
    it('marks a step with no doneAt as not done', () => {
      expect(toIngestStep({ id: 's1', text: 'Call', position: 0, doneAt: null, estimateMinutes: 15 })).toEqual({
        id: 's1', text: 'Call', done: false, doneAt: null, estimateMinutes: 15, position: 0,
      })
    })

    it('marks a step with a doneAt as done and keeps the timestamp', () => {
      const doneAt = new Date('2026-11-01T00:00:00Z')
      const step = toIngestStep({ id: 's1', text: 'Call', position: 2, doneAt, estimateMinutes: null })
      expect(step.done).toBe(true)
      expect(step.doneAt).toBe(doneAt)
    })

    it('drops fields outside the contract', () => {
      const step = toIngestStep({ id: 's1', text: 'Call', position: 0, doneAt: null, estimateMinutes: null, projectId: 'p1' } as never)
      expect(Object.keys(step).sort()).toEqual(['done', 'doneAt', 'estimateMinutes', 'id', 'position', 'text'])
    })
  })

  describe('toIngestDocument', () => {
    const createdAt = new Date('2026-11-02T00:00:00Z')
    it('copies the listed fields', () => {
      const doc = { id: 'd1', name: 'Quote', note: null, fileName: 'quote.pdf', contentType: 'application/pdf', sizeBytes: 10, createdAt }
      expect(toIngestDocument(doc)).toEqual(doc)
    })

    it('drops fields outside the contract', () => {
      const doc = toIngestDocument({
        id: 'd1', name: 'Quote', note: 'n', fileName: 'quote.pdf', contentType: 'application/pdf', sizeBytes: 10, createdAt,
        blobPath: 'secret/path', projectId: 'p1',
      } as never)
      expect(Object.keys(doc).sort()).toEqual(['contentType', 'createdAt', 'fileName', 'id', 'name', 'note', 'sizeBytes'])
    })
  })

  describe('toIngestPhoto', () => {
    it('keeps id, position, size and createdAt', () => {
      const createdAt = new Date('2026-11-03T00:00:00Z')
      expect(toIngestPhoto({ id: 'ph1', width: 2000, height: 1500, position: 0, createdAt })).toEqual({
        id: 'ph1', position: 0, width: 2000, height: 1500, createdAt,
      })
    })

    it('drops fields outside the contract', () => {
      const photo = toIngestPhoto({ id: 'ph1', width: 1, height: 1, position: 0, createdAt: 'x', blobPath: 'p' } as never)
      expect(Object.keys(photo).sort()).toEqual(['createdAt', 'height', 'id', 'position', 'width'])
    })
  })

  describe('toIngestProvider', () => {
    it('flattens the link to the provider id and name plus the link status', () => {
      const link = { providerId: 'pr1', status: 'chosen' as const, provider: { id: 'pr1', name: 'Owens', phone: '555', neighborCount: 3 } }
      expect(toIngestProvider(link)).toEqual({ id: 'pr1', name: 'Owens', status: 'chosen' })
    })
  })
})
