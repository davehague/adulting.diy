import { createError } from 'h3';

export class HttpError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Convert any thrown value into an H3 error. Always throws.
 * Errors that already carry a statusCode (H3 errors) pass through untouched.
 */
export const toHttpError = (error: unknown, context: string): never => {
  if (error instanceof HttpError) {
    throw createError({ statusCode: error.statusCode, message: error.message });
  }
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    throw error;
  }
  console.error(`[API] ${context}:`, error);
  throw createError({ statusCode: 500, message: 'Server error' });
};
