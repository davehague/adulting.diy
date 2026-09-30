import { createHash, randomBytes } from 'node:crypto';

export const hashApiKey = (key: string): string =>
  createHash('sha256').update(key).digest('hex');

export const generateApiKey = (): { key: string; prefix: string; hashedKey: string } => {
  const key = `adk_${randomBytes(32).toString('base64url')}`;
  return { key, prefix: key.slice(0, 8), hashedKey: hashApiKey(key) };
};
