import { describe, it, expect } from 'vitest'
import { fitWithin, FULL_MAX_EDGE, THUMB_MAX_EDGE } from '@/utils/image-resize'

describe('fitWithin', () => {
  it('scales a landscape photo so the long side is the maximum', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, FULL_MAX_EDGE)).toEqual({ width: 2000, height: 1500 })
  })

  it('scales a portrait photo so the long side is the maximum', () => {
    expect(fitWithin({ width: 3024, height: 4032 }, FULL_MAX_EDGE)).toEqual({ width: 1500, height: 2000 })
  })

  it('leaves an image that already fits untouched', () => {
    expect(fitWithin({ width: 800, height: 600 }, FULL_MAX_EDGE)).toEqual({ width: 800, height: 600 })
    expect(fitWithin({ width: 2000, height: 1000 }, FULL_MAX_EDGE)).toEqual({ width: 2000, height: 1000 })
  })

  it('makes thumbnails at the smaller edge', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, THUMB_MAX_EDGE)).toEqual({ width: 400, height: 300 })
  })

  it('never returns a zero dimension for an extreme panorama', () => {
    expect(fitWithin({ width: 20000, height: 10 }, THUMB_MAX_EDGE)).toEqual({ width: 400, height: 1 })
  })

  it('handles a square image', () => {
    expect(fitWithin({ width: 3000, height: 3000 }, FULL_MAX_EDGE)).toEqual({ width: 2000, height: 2000 })
  })
})
