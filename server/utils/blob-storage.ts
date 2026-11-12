import type { IncomingMessage } from 'node:http';
import { put, get, del, head, list, issueSignedToken, presignUrl, BlobNotFoundError } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { HttpError } from '@/server/utils/api-errors';

// The only module that talks to Vercel Blob. Services depend on these functions so tests can fake storage.

export interface PrivateBlobRead {
  statusCode: 200 | 304;
  stream: ReadableStream<Uint8Array> | null;
  etag: string;
}

// Local dev authenticates with BLOB_READ_WRITE_TOKEN. On Vercel the variable is unset and the SDK uses the
// project's OIDC token. Passing the token explicitly stops a linked repo (.vercel/) plus BLOB_STORE_ID from
// switching local dev onto a development OIDC token, which the store refuses with a 403.
const authOptions = (): { token?: string } => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token ? { token } : {};
};

export const putPrivate = async (pathname: string, data: Buffer): Promise<void> => {
  await put(pathname, data, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false, ...authOptions() });
};

export const getPrivate = async (pathname: string, ifNoneMatch?: string): Promise<PrivateBlobRead | null> => {
  const result = await get(pathname, { access: 'private', ifNoneMatch, ...authOptions() });
  if (!result) return null;
  if (result.statusCode === 304) return { statusCode: 304, stream: null, etag: result.blob.etag };
  if (result.statusCode !== 200) return null;
  return { statusCode: 200, stream: result.stream, etag: result.blob.etag };
};

// The whole object as bytes, for sending a photo to the model. null when the blob does not exist.
export const readPrivateBytes = async (pathname: string): Promise<Buffer | null> => {
  const result = await getPrivate(pathname);
  if (!result || !result.stream) return null;
  return Buffer.from(await new Response(result.stream).arrayBuffer());
};

export const removeBlobs = async (pathnames: string[]): Promise<void> => {
  if (pathnames.length === 0) return;
  await del(pathnames, authOptions());
};

// Size and stored type of one blob, or null when it does not exist.
export const headPrivate = async (pathname: string): Promise<{ size: number; contentType: string } | null> => {
  try {
    const result = await head(pathname, authOptions());
    return { size: result.size, contentType: result.contentType };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
};

// A GET URL for one private blob that works for anyone holding it until it expires. Served from the Blob domain, never ours.
export const presignPrivateGet = async (pathname: string, ttlMs: number): Promise<string> => {
  const validUntil = Date.now() + ttlMs;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil, ...authOptions() });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  return presignedUrl;
};

export interface UploadGrant {
  contentType: string;
  maxBytes: number;
  ttlMs: number;
}

// handleUploadPresigned only uses this key to verify upload-completed callbacks. We never register one and refuse
// callback bodies before calling it, so it is never read; local dev has no BLOB_WEBHOOK_PUBLIC_KEY.
const NO_CALLBACK_KEY = 'unused';

// Answers the browser's uploadPresigned: `sign` authorises the exact pathname (throwing refuses it) and says what may
// be uploaded there. The resulting URL can write only that pathname, only that type and size, never over an existing blob.
export const handlePresignedUpload = async (
  body: unknown,
  request: IncomingMessage,
  sign: (pathname: string) => Promise<UploadGrant>,
): Promise<unknown> => {
  if (typeof body !== 'object' || body === null || (body as { type?: unknown }).type !== 'blob.generate-presigned-url') {
    throw new HttpError('Unsupported upload request', 400);
  }
  return handleUploadPresigned({
    body: body as HandleUploadPresignedBody,
    request,
    webhookPublicKey: NO_CALLBACK_KEY,
    getSignedToken: async (pathname) => {
      const grant = await sign(pathname);
      const validUntil = Date.now() + grant.ttlMs;
      const token = await issueSignedToken({
        pathname,
        operations: ['put'],
        allowedContentTypes: [grant.contentType],
        maximumSizeInBytes: grant.maxBytes,
        validUntil,
        ...authOptions(),
      });
      return { token, urlOptions: { addRandomSuffix: false, allowOverwrite: false, validUntil } };
    },
  });
};

// The Blob API version @vercel/blob sends on every request (its own BLOB_API_VERSION). A script PUTting to a presigned
// URL must send it too, or Blob stores a PDF as a download rather than one that opens in the browser.
// tests/unit/utils/blob-api-version.test.ts fails if an SDK upgrade changes it.
export const BLOB_API_VERSION = '12';

// A PUT URL a script can use with plain HTTP (curl, Python): one path, one type, the size cap, no overwrite.
export const presignPrivatePut = async (
  pathname: string,
  grant: UploadGrant,
): Promise<{ url: string; headers: Record<string, string>; expiresAt: string }> => {
  const validUntil = Date.now() + grant.ttlMs;
  const limits = { allowedContentTypes: [grant.contentType], maximumSizeInBytes: grant.maxBytes };
  const token = await issueSignedToken({ pathname, operations: ['put'], validUntil, ...limits, ...authOptions() });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'put',
    pathname,
    access: 'private',
    validUntil,
    ...limits,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  return { url: presignedUrl, headers: { 'x-api-version': BLOB_API_VERSION }, expiresAt: new Date(validUntil).toISOString() };
};

// The one blob under a prefix, or null when there is none or (never expected) more than one.
export const findPrivateBlob = async (prefix: string): Promise<string | null> => {
  const { blobs } = await list({ prefix, limit: 2, ...authOptions() });
  return blobs.length === 1 ? blobs[0].pathname : null;
};
