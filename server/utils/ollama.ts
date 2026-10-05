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

// One non-streaming chat call. Errors carry a status or a fixed message only, never the prompt, the reply or the key.
export const callOllama: ModelCall = async ({ model, system, user, timeoutMs }) => {
  // A key pasted with a trailing space or newline would make the header invalid.
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (!key) throw new ModelCallError('OLLAMA_API_KEY is not set');

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
