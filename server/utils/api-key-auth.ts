import { H3Event, createError, getHeader } from 'h3';
import { ApiKeyService } from '@/server/services/ApiKeyService';

export interface ApiKeyContext {
  householdId: string;
  apiKeyId: string;
  /** The user who created the key. */
  userId: string;
}

export const defineApiKeyProtectedEventHandler = (
  handler: (event: H3Event, ctx: ApiKeyContext) => Promise<any>
) =>
  defineEventHandler(async (event: H3Event) => {
    const key = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '');
    if (!key) {
      throw createError({ statusCode: 401, message: 'Unauthorized: Missing API key' });
    }
    const ctx = await new ApiKeyService().authenticate(key);
    if (!ctx) {
      throw createError({ statusCode: 401, message: 'Unauthorized: Invalid API key' });
    }
    return handler(event, ctx);
  });
