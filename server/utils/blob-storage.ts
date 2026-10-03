import { put, get, del } from '@vercel/blob';

// The only module that talks to Vercel Blob. Services depend on these three functions so tests can fake storage.

export interface PrivateBlobRead {
  statusCode: 200 | 304;
  stream: ReadableStream<Uint8Array> | null;
  etag: string;
}

export const putPrivate = async (pathname: string, data: Buffer): Promise<void> => {
  await put(pathname, data, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false });
};

export const getPrivate = async (pathname: string, ifNoneMatch?: string): Promise<PrivateBlobRead | null> => {
  const result = await get(pathname, { access: 'private', ifNoneMatch });
  if (!result) return null;
  if (result.statusCode === 304) return { statusCode: 304, stream: null, etag: result.blob.etag };
  if (result.statusCode !== 200) return null;
  return { statusCode: 200, stream: result.stream, etag: result.blob.etag };
};

export const removeBlobs = async (pathnames: string[]): Promise<void> => {
  if (pathnames.length === 0) return;
  await del(pathnames);
};
