import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }))

import { put, get, del } from '@vercel/blob'
import { putPrivate, getPrivate, removeBlobs } from '@/server/utils/blob-storage'

const sdk = { put: put as unknown as ReturnType<typeof vi.fn>, get: get as unknown as ReturnType<typeof vi.fn>, del: del as unknown as ReturnType<typeof vi.fn> }

describe('blob-storage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes private JPEGs at the exact pathname', async () => {
    const data = Buffer.from([0xff, 0xd8, 0xff])
    await putPrivate('households/h1/projects/p1/x-full.jpg', data)
    expect(sdk.put).toHaveBeenCalledWith('households/h1/projects/p1/x-full.jpg', data, {
      access: 'private', contentType: 'image/jpeg', addRandomSuffix: false,
    })
  })

  it('returns null when the blob does not exist', async () => {
    sdk.get.mockResolvedValue(null)
    expect(await getPrivate('missing.jpg')).toBeNull()
  })

  it('returns the stream and etag on a 200', async () => {
    const stream = new ReadableStream<Uint8Array>()
    sdk.get.mockResolvedValue({ statusCode: 200, stream, blob: { etag: '"abc"' } })
    expect(await getPrivate('a.jpg')).toEqual({ statusCode: 200, stream, etag: '"abc"' })
  })

  it('passes If-None-Match through and returns a 304 with no stream', async () => {
    sdk.get.mockResolvedValue({ statusCode: 304, stream: null, blob: { etag: '"abc"' } })
    expect(await getPrivate('a.jpg', '"abc"')).toEqual({ statusCode: 304, stream: null, etag: '"abc"' })
    expect(sdk.get).toHaveBeenCalledWith('a.jpg', { access: 'private', ifNoneMatch: '"abc"' })
  })

  it('treats any other status as missing', async () => {
    sdk.get.mockResolvedValue({ statusCode: 404, stream: null, blob: { etag: '' } })
    expect(await getPrivate('a.jpg')).toBeNull()
  })

  it('removes several blobs in one call and skips an empty list', async () => {
    await removeBlobs(['a.jpg', 'b.jpg'])
    expect(sdk.del).toHaveBeenCalledWith(['a.jpg', 'b.jpg'])
    sdk.del.mockClear()
    await removeBlobs([])
    expect(sdk.del).not.toHaveBeenCalled()
  })
})
