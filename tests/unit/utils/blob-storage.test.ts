import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }))

import { put, get, del } from '@vercel/blob'
import { putPrivate, getPrivate, readPrivateBytes, removeBlobs } from '@/server/utils/blob-storage'

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
    expect(sdk.del.mock.calls[0][0]).toEqual(['a.jpg', 'b.jpg'])
    sdk.del.mockClear()
    await removeBlobs([])
    expect(sdk.del).not.toHaveBeenCalled()
  })

  describe('readPrivateBytes', () => {
    it('returns the exact bytes of a 200 stream', async () => {
      const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x7f, 0x80])
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, 2))
          controller.enqueue(bytes.slice(2))
          controller.close()
        },
      })
      sdk.get.mockResolvedValue({ statusCode: 200, stream, blob: { etag: '"abc"' } })
      const result = await readPrivateBytes('a.jpg')
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result).toEqual(Buffer.from(bytes))
    })

    it('returns null when the blob does not exist', async () => {
      sdk.get.mockResolvedValue(null)
      expect(await readPrivateBytes('missing.jpg')).toBeNull()
    })

    it('returns null for a 304 with no stream', async () => {
      sdk.get.mockResolvedValue({ statusCode: 304, stream: null, blob: { etag: '"abc"' } })
      expect(await readPrivateBytes('a.jpg')).toBeNull()
    })
  })

  describe('credentials', () => {
    const saved = process.env.BLOB_READ_WRITE_TOKEN
    afterEach(() => {
      if (saved === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
      else process.env.BLOB_READ_WRITE_TOKEN = saved
    })

    it('passes the read-write token explicitly to put, get and del when it is set', async () => {
      // Explicit beats the SDK's OIDC lookup, which a linked repo plus BLOB_STORE_ID would otherwise win locally.
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_store1_secret'
      sdk.get.mockResolvedValue(null)
      await putPrivate('a.jpg', Buffer.from([0xff, 0xd8, 0xff]))
      await getPrivate('a.jpg')
      await removeBlobs(['a.jpg'])
      expect(sdk.put.mock.calls[0][2]).toMatchObject({ token: 'vercel_blob_rw_store1_secret' })
      expect(sdk.get.mock.calls[0][1]).toMatchObject({ token: 'vercel_blob_rw_store1_secret' })
      expect(sdk.del.mock.calls[0][1]).toMatchObject({ token: 'vercel_blob_rw_store1_secret' })
    })

    it('passes no token when the variable is unset so the SDK uses OIDC on Vercel', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN
      sdk.get.mockResolvedValue(null)
      await putPrivate('a.jpg', Buffer.from([0xff, 0xd8, 0xff]))
      await getPrivate('a.jpg')
      await removeBlobs(['a.jpg'])
      expect(sdk.put.mock.calls[0][2]).not.toHaveProperty('token')
      expect(sdk.get.mock.calls[0][1]).not.toHaveProperty('token')
      expect(sdk.del.mock.calls[0][1] ?? {}).not.toHaveProperty('token')
    })
  })
})
