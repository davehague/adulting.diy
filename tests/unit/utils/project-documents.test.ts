import { describe, it, expect } from 'vitest'
import {
  defaultDocumentName,
  documentBlobPath,
  documentExtension,
  formatDocumentSize,
  parseDocumentBlobPath,
  safeDocumentFileName,
} from '@/utils/project-documents'
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, MAX_PROJECT_DOCUMENTS } from '@/types/project'

const H = '11111111-1111-4111-8111-111111111111'
const P = '22222222-2222-4222-8222-222222222222'
const D = '33333333-3333-4333-8333-333333333333'

describe('document constants', () => {
  it('pins the caps and the five allowed types', () => {
    expect(MAX_PROJECT_DOCUMENTS).toBe(30)
    expect(MAX_DOCUMENT_BYTES).toBe(25 * 1024 * 1024)
    expect(DOCUMENT_TYPES).toEqual({
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    })
  })
})

describe('documentExtension', () => {
  it('returns the lower-cased allowed extension', () => {
    expect(documentExtension('Quote.PDF')).toBe('pdf')
    expect(documentExtension('plan.v2.xlsx')).toBe('xlsx')
  })
  it('returns null for anything else', () => {
    expect(documentExtension('a.doc')).toBeNull()
    expect(documentExtension('noext')).toBeNull()
    expect(documentExtension('page.html')).toBeNull()
    expect(documentExtension('x.pdf.html')).toBeNull()
  })
})

describe('safeDocumentFileName', () => {
  it('turns spaces into dashes and keeps the extension', () => {
    expect(safeDocumentFileName('Back porch and lower room brief.pdf')).toBe('Back-porch-and-lower-room-brief.pdf')
  })
  it('never leaves a slash or a dot-dot', () => {
    const name = safeDocumentFileName('../../etc/passwd.pdf')
    expect(name).not.toBeNull()
    expect(name).not.toContain('/')
    expect(name).not.toContain('..')
    expect(name!.endsWith('.pdf')).toBe(true)
  })
  it('drops characters outside the safe set and lower-cases the extension', () => {
    expect(safeDocumentFileName('Ünïcode ✓.JPEG')).toMatch(/^[A-Za-z0-9._-]+\.jpeg$/)
  })
  it('falls back to document when nothing is left', () => {
    expect(safeDocumentFileName('.pdf')).toBe('document.pdf')
    expect(safeDocumentFileName('✓✓✓.png')).toBe('document.png')
  })
  it('refuses a type that is not allowed', () => {
    expect(safeDocumentFileName('x.html')).toBeNull()
  })
  it('cuts a long base to 80 characters', () => {
    const name = safeDocumentFileName(`${'a'.repeat(200)}.pdf`)
    expect(name).toBe(`${'a'.repeat(80)}.pdf`)
  })
  it('is idempotent', () => {
    for (const input of ['Back porch brief.pdf', '  weird -- name__.PNG', 'Owens quote, Nov 2026.docx', '.pdf']) {
      const once = safeDocumentFileName(input)!
      expect(safeDocumentFileName(once)).toBe(once)
    }
  })
})

describe('defaultDocumentName', () => {
  it('strips only the last extension', () => {
    expect(defaultDocumentName('Owens quote.final.pdf')).toBe('Owens quote.final')
  })
  it('falls back to Document', () => {
    expect(defaultDocumentName('.pdf')).toBe('Document')
    expect(defaultDocumentName('   .pdf')).toBe('Document')
  })
  it('cuts to 120 characters', () => {
    expect(defaultDocumentName(`${'b'.repeat(300)}.pdf`)).toHaveLength(120)
  })
})

describe('document blob paths', () => {
  it('round-trips', () => {
    const path = documentBlobPath(H, P, D, 'Back-porch-brief.pdf')
    expect(path).toBe(`households/${H}/projects/${P}/documents/${D}/Back-porch-brief.pdf`)
    expect(parseDocumentBlobPath(path)).toEqual({
      householdId: H, projectId: P, documentId: D, fileName: 'Back-porch-brief.pdf', extension: 'pdf',
    })
  })
  it('refuses anything off the exact shape', () => {
    const bad = [
      `households/${H}/projects/${P}/documents/Back-porch-brief.pdf`,
      `households/AAAAAAAA-1111-4111-8111-111111111111/projects/${P}/documents/${D}/a.pdf`,
      `households/not-a-uuid/projects/${P}/documents/${D}/a.pdf`,
      `households/${H}/projects/${P}/documents/${D}/../a.pdf`,
      `households/${H}/projects/${P}/documents/${D}/foo/../x.pdf`,
      `households/${H}/projects/${P}/documents/${D}/page.html`,
      `households/${H}/projects/${P}/documents/${D}/has space.pdf`,
      `households/${H}/projects/${P}/documents/${D}/a.pdf/`,
      `/households/${H}/projects/${P}/documents/${D}/a.pdf`,
      `households/${H}/projects/${P}/photos/${D}/a.pdf`,
    ]
    for (const path of bad) expect(parseDocumentBlobPath(path), path).toBeNull()
  })
})

describe('formatDocumentSize', () => {
  it('shows KB below 1 MB and MB from 1 MB', () => {
    expect(formatDocumentSize(500)).toBe('1 KB')
    expect(formatDocumentSize(860160)).toBe('840 KB')
    expect(formatDocumentSize(2516582)).toBe('2.4 MB')
    expect(formatDocumentSize(1024 * 1024)).toBe('1.0 MB')
  })
})
