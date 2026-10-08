export const CHAT_FEATURE = 'project_chat';
export const DEFAULT_CHAT_MODEL = 'glm-5.3';

export const MAX_CHAT_MESSAGE_CHARS = 2000;
export const MAX_CHAT_REPLY_CHARS = 8000;
export const MAX_CHAT_SEARCHES = 3;
export const CHAT_SEARCH_RESULTS = 5;
export const CHAT_SNIPPET_CHARS = 1500;
export const MAX_CHAT_QUERY_CHARS = 200;
export const MAX_CHAT_HISTORY = 200;
export const MAX_CHAT_SCREEN_MESSAGES = 500;
export const CHAT_DEADLINE_MS = 60_000;
export const CHAT_SEARCH_TIMEOUT_MS = 10_000;
// A user message with no reply counts as "a reply is on its way" for this long; it is longer than the deadline so a request is always over before Retry is offered.
export const CHAT_PENDING_MS = 75_000;
export const CHAT_POLL_MS = 3000;

export const CHAT_MESSAGE_LENGTH_MESSAGE = `A message must be 1 to ${MAX_CHAT_MESSAGE_CHARS} characters`;
export const CHAT_NOTHING_TO_RETRY_MESSAGE = 'Nothing to retry';
export const CHAT_BUSY_MESSAGE = 'A reply is on its way';
export const CHAT_FAILED_MESSAGE = "Couldn't get a reply. Try again.";

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageDto {
  id: string;
  role: ChatRole;
  content: string;
  // sent by the signed-in member; always false on assistant rows
  mine: boolean;
  // a user row whose reply failed; the screen offers Retry
  failed: boolean;
  // the queries the model ran for this reply; [] on user rows
  searches: string[];
  createdAt: string;
}

export interface ChatStateResponse {
  enabled: boolean;
  messages: ChatMessageDto[];
  // the last row is a user message with no reply, not failed, younger than CHAT_PENDING_MS
  pending: boolean;
}

export type ChatSendInput = { text: string } | { retry: true };

export interface ChatSendResponse {
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
}
