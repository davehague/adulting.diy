import { z } from 'zod';
import { HttpError } from '@/server/utils/api-errors';
import { CHAT_MESSAGE_LENGTH_MESSAGE, MAX_CHAT_MESSAGE_CHARS, type ChatSendInput } from '@/types/chat';

const textSchema = z.object({
  text: z.string({ invalid_type_error: CHAT_MESSAGE_LENGTH_MESSAGE, required_error: CHAT_MESSAGE_LENGTH_MESSAGE }).trim().min(1, CHAT_MESSAGE_LENGTH_MESSAGE).max(MAX_CHAT_MESSAGE_CHARS, CHAT_MESSAGE_LENGTH_MESSAGE),
});

// A send is either a retry of the last unanswered message or a new message. Anything else is a bad request with one fixed message.
export const parseChatSendInput = (body: unknown): ChatSendInput => {
  if (typeof body === 'object' && body !== null && (body as { retry?: unknown }).retry === true) return { retry: true };
  const parsed = textSchema.safeParse(body ?? {});
  if (!parsed.success) throw new HttpError(CHAT_MESSAGE_LENGTH_MESSAGE, 400);
  return { text: parsed.data.text };
};
