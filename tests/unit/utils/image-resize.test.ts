import { describe, it, expect, vi } from 'vitest'
import { fitWithin, looksLikeHeic, decodeImage, FULL_MAX_EDGE, THUMB_MAX_EDGE } from '@/utils/image-resize'

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

describe('looksLikeHeic', () => {
  const ftyp = (brand: string): Uint8Array => {
    const bytes = new Uint8Array(16)
    bytes.set([0, 0, 0, 24], 0)
    bytes.set([...'ftyp'].map((c) => c.charCodeAt(0)), 4)
    bytes.set([...brand].map((c) => c.charCodeAt(0)), 8)
    return bytes
  }

  it('recognises the HEIC and HEIF media types', async () => {
    expect(await looksLikeHeic(new File(['x'], 'a', { type: 'image/heic' }))).toBe(true)
    expect(await looksLikeHeic(new File(['x'], 'a', { type: 'image/HEIF' }))).toBe(true)
  })

  it('recognises a .HEIC name when the browser gives no type (Chrome on a Mac)', async () => {
    expect(await looksLikeHeic(new File(['x'], 'IMG_9925.HEIC', { type: '' }))).toBe(true)
  })

  it('recognises the HEIC file signature when neither type nor name says so', async () => {
    expect(await looksLikeHeic(new File([ftyp('heic').buffer as ArrayBuffer], 'upload', { type: '' }))).toBe(true)
    expect(await looksLikeHeic(new File([ftyp('heix').buffer as ArrayBuffer], 'upload', { type: '' }))).toBe(true)
  })

  it('does not mistake a JPEG or an MP4 for HEIC', async () => {
    expect(await looksLikeHeic(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer as ArrayBuffer], 'a.jpg', { type: 'image/jpeg' }))).toBe(false)
    expect(await looksLikeHeic(new File([ftyp('isom').buffer as ArrayBuffer], 'clip.mp4', { type: 'video/mp4' }))).toBe(false)
  })
})

describe('decodeImage', () => {
  const bitmap = { width: 4032, height: 3024, close: () => {} } as unknown as ImageBitmap
  const heicFile = new File(['x'], 'IMG_9925.HEIC', { type: '' })
  const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })

  it('uses the browser decoder when it can read the file, and never loads the HEIC decoder', async () => {
    const loadHeic = vi.fn()
    const result = await decodeImage(heicFile, { createBitmap: async () => bitmap, loadHeic })
    expect(result).toBe(bitmap)
    expect(loadHeic).not.toHaveBeenCalled()
  })

  it('falls back to the HEIC decoder when the browser cannot read an iPhone photo', async () => {
    const heicTo = vi.fn(async () => bitmap)
    const result = await decodeImage(heicFile, {
      createBitmap: async () => { throw new Error('The source image could not be decoded.') },
      loadHeic: async () => heicTo,
    })
    expect(result).toBe(bitmap)
    expect(heicTo).toHaveBeenCalledWith({ blob: heicFile, type: 'bitmap', options: { imageOrientation: 'from-image' } })
  })

  it('keeps the plain message for a file that is not a photo at all', async () => {
    const loadHeic = vi.fn()
    await expect(decodeImage(textFile, {
      createBitmap: async () => { throw new Error('nope') },
      loadHeic,
    })).rejects.toThrow('Could not read this file as a photo')
    expect(loadHeic).not.toHaveBeenCalled()
  })

  it('says what to do when even the HEIC decoder fails', async () => {
    await expect(decodeImage(heicFile, {
      createBitmap: async () => { throw new Error('nope') },
      loadHeic: async () => async () => { throw new Error('libheif error') },
    })).rejects.toThrow(/HEIC.*JPEG/)
  })
})
