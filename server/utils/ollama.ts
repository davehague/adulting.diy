import { CHAT_SEARCH_RESULTS, CHAT_SNIPPET_CHARS } from '@/types/chat';

export interface ModelCallInput {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
}

export interface ModelCallResult {
  text: string;
  // null when the service does not report them
  promptTokens: number | null;
  outputTokens: number | null;
}

export type ModelCall = (input: ModelCallInput) => Promise<ModelCallResult>;

// Every error this file throws itself. Its message is fixed text plus at most an HTTP status, so it is safe to log.
export class ModelCallError extends Error {}

const OLLAMA_CHAT_URL = 'https://ollama.com/api/chat';

interface OllamaChatResponse {
  message?: { content?: unknown };
  prompt_eval_count?: unknown;
  eval_count?: unknown;
}

const countOf = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const requireKey = (): string => {
  // A key pasted with a trailing space or newline would make the header invalid.
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (!key) throw new ModelCallError('OLLAMA_API_KEY is not set');
  return key;
};

// One non-streaming chat call. Errors carry a status or a fixed message only, never the prompt, the reply or the key.
export const callOllama: ModelCall = async ({ model, system, user, timeoutMs }) => {
  const key = requireKey();

  const response = await fetch(OLLAMA_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new ModelCallError(`Ollama returned HTTP ${response.status}`);

  let body: OllamaChatResponse;
  try {
    body = (await response.json()) as OllamaChatResponse;
  } catch {
    // The parser's own message can quote the reply, so it is replaced.
    throw new ModelCallError('Ollama reply was not JSON');
  }
  const text = body.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new ModelCallError('Ollama returned no content');
  return { text, promptTokens: countOf(body.prompt_eval_count), outputTokens: countOf(body.eval_count) };
};

// Ollama's own wire shapes for a multi-turn chat with tools. The assistant's tool-call turn is sent back exactly as received.
export interface ChatToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ChatToolCall[];
  tool_name?: string;
}

export interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatCallInput {
  model: string;
  messages: ChatMessage[];
  tools: ChatTool[];
  timeoutMs: number;
}

export interface ChatCallResult {
  text: string;
  toolCalls: ChatToolCall[];
  promptTokens: number | null;
  outputTokens: number | null;
}

export type ChatCall = (input: ChatCallInput) => Promise<ChatCallResult>;

interface OllamaChatTurnResponse {
  message?: { content?: unknown; tool_calls?: unknown };
  prompt_eval_count?: unknown;
  eval_count?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const toToolCall = (value: unknown): ChatToolCall | null => {
  if (!isRecord(value) || !isRecord(value.function)) return null;
  const { name, arguments: args } = value.function;
  if (typeof name !== 'string' || !isRecord(args)) return null;
  return { function: { name, arguments: args } };
};

// One non-streaming turn of a chat that may answer with tool calls instead of text. The model's thinking setting is left at its default. Errors carry a status or a fixed message only.
export const callOllamaChat: ChatCall = async ({ model, messages, tools, timeoutMs }) => {
  const key = requireKey();
  const response = await fetch(OLLAMA_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, options: { temperature: 0.3 }, messages, tools }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new ModelCallError(`Ollama returned HTTP ${response.status}`);

  let body: OllamaChatTurnResponse;
  try {
    body = (await response.json()) as OllamaChatTurnResponse;
  } catch {
    throw new ModelCallError('Ollama reply was not JSON');
  }
  const content = body.message?.content;
  const text = typeof content === 'string' ? content : '';
  const rawCalls = body.message?.tool_calls;
  const toolCalls = Array.isArray(rawCalls) ? rawCalls.map(toToolCall).filter((call): call is ChatToolCall => call !== null) : [];
  if (!text.trim() && toolCalls.length === 0) throw new ModelCallError('Ollama returned no content');
  return { text, toolCalls, promptTokens: countOf(body.prompt_eval_count), outputTokens: countOf(body.eval_count) };
};

const OLLAMA_SEARCH_URL = 'https://ollama.com/api/web_search';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export type WebSearch = (query: string, timeoutMs: number) => Promise<SearchResult[]>;

const toSearchResult = (value: unknown): SearchResult | null => {
  if (!isRecord(value)) return null;
  const { title, url, content } = value;
  if (typeof title !== 'string' || typeof url !== 'string' || typeof content !== 'string') return null;
  return { title, url, content: content.slice(0, CHAT_SNIPPET_CHARS) };
};

// One web search on the same key. The query is the model's own words, already masked by the caller.
export const searchOllama: WebSearch = async (query, timeoutMs) => {
  const key = requireKey();
  const response = await fetch(OLLAMA_SEARCH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, max_results: CHAT_SEARCH_RESULTS }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new ModelCallError(`Ollama search returned HTTP ${response.status}`);

  let body: { results?: unknown };
  try {
    body = (await response.json()) as { results?: unknown };
  } catch {
    throw new ModelCallError('Ollama search reply was not JSON');
  }
  return Array.isArray(body.results) ? body.results.map(toSearchResult).filter((row): row is SearchResult => row !== null).slice(0, CHAT_SEARCH_RESULTS) : [];
};
