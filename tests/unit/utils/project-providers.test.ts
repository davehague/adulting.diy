import { describe, it, expect } from 'vitest'
import {
  PROVIDER_LINK_STATUS_LABELS,
  chosenLine,
  neighborLabel,
  providerStatusBadgeClass,
  sortProviderLinks,
  telHref,
} from '@/utils/project-providers'
import { type ProjectProviderStatus } from '@/types/project'

const link = (id: string, status: string) => ({ id, status: status as ProjectProviderStatus })

describe('sortProviderLinks', () => {
  it('orders chosen, contacted, considering, passed', () => {
    const sorted = sortProviderLinks([link('a', 'passed'), link('b', 'considering'), link('c', 'chosen'), link('d', 'contacted')])
    expect(sorted.map((l) => l.id)).toEqual(['c', 'd', 'b', 'a'])
  })

  it('keeps the given order within a status', () => {
    const sorted = sortProviderLinks([link('old', 'considering'), link('x', 'chosen'), link('new', 'considering')])
    expect(sorted.map((l) => l.id)).toEqual(['x', 'old', 'new'])
  })

  it('puts an unknown status last without throwing', () => {
    const sorted = sortProviderLinks([link('odd', 'hired'), link('p', 'passed'), link('c', 'chosen')])
    expect(sorted.map((l) => l.id)).toEqual(['c', 'p', 'odd'])
  })

  it('does not change the array it was given', () => {
    const input = [link('a', 'passed'), link('b', 'chosen')]
    sortProviderLinks(input)
    expect(input.map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('chosenLine', () => {
  it('is null with no names, an empty list, or a missing list', () => {
    expect(chosenLine([])).toBeNull()
    expect(chosenLine(undefined)).toBeNull()
  })

  it('names a single chosen provider', () => {
    expect(chosenLine(['Acme Plumbing'])).toBe('Chosen: Acme Plumbing')
  })

  it('names the first and counts the rest', () => {
    expect(chosenLine(['Acme Plumbing', 'Tile Co'])).toBe('Chosen: Acme Plumbing +1')
    expect(chosenLine(['A', 'B', 'C'])).toBe('Chosen: A +2')
  })
})

describe('neighborLabel', () => {
  it('is null at zero', () => {
    expect(neighborLabel(0)).toBeNull()
  })

  it('uses the singular for one and the plural otherwise', () => {
    expect(neighborLabel(1)).toBe('1 neighbor')
    expect(neighborLabel(3)).toBe('3 neighbors')
  })
})

describe('telHref', () => {
  it('strips formatting', () => {
    expect(telHref('(614) 555-0101')).toBe('tel:6145550101')
    expect(telHref('+1 614.555.0101')).toBe('tel:+16145550101')
  })

  it('drops an extension instead of dialing it', () => {
    expect(telHref('614-555-0101 x12')).toBe('tel:6145550101')
    expect(telHref('614-555-0101 ext. 4')).toBe('tel:6145550101')
  })

  it('is null when there is no usable number', () => {
    expect(telHref(null)).toBeNull()
    expect(telHref('')).toBeNull()
    expect(telHref('call the office')).toBeNull()
    expect(telHref('555')).toBeNull()
  })
})

describe('PROVIDER_LINK_STATUS_LABELS', () => {
  it('has a label for each status', () => {
    expect(PROVIDER_LINK_STATUS_LABELS).toEqual({
      considering: 'Considering', contacted: 'Contacted', chosen: 'Chosen', passed: 'Passed',
    })
  })
})

describe('providerStatusBadgeClass', () => {
  it('colors by status kind', () => {
    expect(providerStatusBadgeClass('positive')).toBe('bg-green-100 text-green-800')
    expect(providerStatusBadgeClass('negative')).toBe('bg-red-50 text-red-700')
    expect(providerStatusBadgeClass('neutral')).toBe('bg-stone-100 text-stone-700')
  })
})
