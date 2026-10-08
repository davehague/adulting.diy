import { type z } from 'zod';
import prisma from '@/server/utils/prisma/client';
import { ModelCallError, type ChatCall, type ChatMessage, type ChatTool, type ModelCall, type WebSearch } from '@/server/utils/ollama';
import { parseModelJson } from '@/server/utils/suggestion-schemas';
import { redactContactDetails } from '@/server/utils/suggestion-prompts';
import { PROVIDER_SUGGESTIONS_FEATURE } from '@/types/suggestion';
import { DIY_PLAN_FEATURE } from '@/types/plan';
import { CHAT_SEARCH_TIMEOUT_MS, MAX_CHAT_QUERY_CHARS, MAX_CHAT_SEARCHES } from '@/types/chat';

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

export const SEARCH_LIMIT_MESSAGE = 'Search limit reached for this reply; answer with what you have.';
const SEARCH_TOOL = 'web_search';
// Enough calls for three searches, one more answer, and one answer after the limit message.
const MAX_CHAT_ROUNDS = MAX_CHAT_SEARCHES + 2;

export interface ChatAskResult {
  text: string;
  // the queries actually sent, in order
  searches: string[];
}

// A multi-turn call that runs the searches the model asks for, at most MAX_CHAT_SEARCHES in all, and returns its text. A thrown model error is not retried.
export const askChat = async (
  callChat: ChatCall,
  search: WebSearch,
  now: () => number,
  context: { messages: ChatMessage[]; tools: ChatTool[] },
  model: string,
  deadline: number,
  usage: AskUsage,
): Promise<ChatAskResult> => {
  const messages = [...context.messages];
  const searches: string[] = [];

  for (let round = 0; round < MAX_CHAT_ROUNDS; round++) {
    const remaining = deadline - now();
    if (remaining < MIN_CALL_MS) throw new AskError('the model did not finish in time');
    const reply = await callChat({ model, messages, tools: context.tools, timeoutMs: remaining });
    if (reply.promptTokens !== null || reply.outputTokens !== null) usage.reported = true;
    usage.promptTokens += reply.promptTokens ?? 0;
    usage.outputTokens += reply.outputTokens ?? 0;

    if (reply.toolCalls.length === 0) {
      if (!reply.text.trim()) throw new AskError('the model returned an empty reply');
      return { text: reply.text, searches };
    }

    messages.push({ role: 'assistant', content: reply.text, tool_calls: reply.toolCalls });
    for (const call of reply.toolCalls) {
      const rawQuery = call.function.arguments.query;
      const query = typeof rawQuery === 'string' ? redactContactDetails(rawQuery.trim()).slice(0, MAX_CHAT_QUERY_CHARS) : '';
      let content: string;
      if (call.function.name !== SEARCH_TOOL || !query) {
        content = JSON.stringify({ error: 'unknown tool or missing query' });
      } else if (searches.length >= MAX_CHAT_SEARCHES) {
        content = SEARCH_LIMIT_MESSAGE;
      } else {
        searches.push(query);
        try {
          const results = await search(query, Math.min(CHAT_SEARCH_TIMEOUT_MS, Math.max(deadline - now(), 0)));
          content = JSON.stringify(results);
        } catch {
          // The model can still answer from what it knows; the reason is not logged here because the service logs the ask as a whole.
          content = JSON.stringify({ error: 'search failed' });
        }
      }
      messages.push({ role: 'tool', tool_name: call.function.name, content });
    }
  }
  throw new AskError('the model kept asking for searches');
};

// The features that share the daily cap. Chat is logged like the others but never counted.
export const CAPPED_AI_FEATURES: readonly string[] = [PROVIDER_SUGGESTIONS_FEATURE, DIY_PLAN_FEATURE];

// The daily cap is one number for the household, shared by the named features.
export const asksInLastDay = (householdId: string, features: readonly string[], now: () => number): Promise<number> =>
  prisma.aiRequestLog.count({ where: { householdId, feature: { in: [...features] }, createdAt: { gte: new Date(now() - DAY_MS) } } });
