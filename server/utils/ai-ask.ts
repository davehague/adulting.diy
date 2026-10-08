import { type z } from 'zod';
import prisma from '@/server/utils/prisma/client';
import { ModelCallError, type ModelCall } from '@/server/utils/ollama';
import { parseModelJson } from '@/server/utils/suggestion-schemas';
import { PROVIDER_SUGGESTIONS_FEATURE } from '@/types/suggestion';
import { DIY_PLAN_FEATURE } from '@/types/plan';

const DAY_MS = 24 * 60 * 60 * 1000;
// A model call given less time than this cannot finish, so it is not started.
export const MIN_CALL_MS = 2000;
export const LIMIT_MESSAGE = 'Daily limit reached. Try again later.';

// An expected failure with a message that is safe to log: it never carries prompt or reply text.
export class AskError extends Error {}

export interface AskUsage {
  promptTokens: number;
  outputTokens: number;
  // false until the service reports a count at least once
  reported: boolean;
}

export const promptChars = (prompt: { system: string; user: string }): number => prompt.system.length + prompt.user.length;

// What to log for a failed ask. Only our own errors have messages that are safe to log; any other error's message could carry prompt text, so only its kind (and a code, which is a fixed value such as Prisma's P2002) is used.
export const describeError = (error: unknown): string => {
  if (error instanceof AskError || error instanceof ModelCallError) return error.message;
  if (!(error instanceof Error)) return 'unknown';
  return 'code' in error && typeof error.code === 'string' ? `${error.name} ${error.code}` : error.name;
};

// One call, validated; a reply that cannot be used is retried once if there is time left. A thrown model error is not retried.
export const askJson = async <T>(
  callModel: ModelCall,
  now: () => number,
  prompt: { system: string; user: string },
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  model: string,
  deadline: number,
  usage: AskUsage,
): Promise<T> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - now();
    if (remaining < MIN_CALL_MS) break;
    const reply = await callModel({ model, system: prompt.system, user: prompt.user, timeoutMs: remaining });
    if (reply.promptTokens !== null || reply.outputTokens !== null) usage.reported = true;
    usage.promptTokens += reply.promptTokens ?? 0;
    usage.outputTokens += reply.outputTokens ?? 0;

    let raw: unknown;
    try {
      raw = parseModelJson(reply.text);
    } catch {
      continue;
    }
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  throw new AskError('the model did not return a usable reply in time');
};

// The features that share the daily cap. Chat is logged like the others but never counted.
export const CAPPED_AI_FEATURES: readonly string[] = [PROVIDER_SUGGESTIONS_FEATURE, DIY_PLAN_FEATURE];

// The daily cap is one number for the household, shared by the named features.
export const asksInLastDay = (householdId: string, features: readonly string[], now: () => number): Promise<number> =>
  prisma.aiRequestLog.count({ where: { householdId, feature: { in: [...features] }, createdAt: { gte: new Date(now() - DAY_MS) } } });
