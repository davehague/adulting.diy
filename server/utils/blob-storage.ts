import { put, get, del } from '@vercel/blob';

// The only module that talks to Vercel Blob. Services depend on these three functions so tests can fake storage.

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
