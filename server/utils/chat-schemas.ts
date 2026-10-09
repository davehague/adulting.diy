import { z } from 'zod';
import { HttpError } from '@/server/utils/api-errors';
import { CHAT_EMPTY_MESSAGE, CHAT_MESSAGE_LENGTH_MESSAGE, CHAT_PHOTO_COUNT_MESSAGE, MAX_CHAT_MESSAGE_CHARS, MAX_CHAT_PHOTOS, type ChatSendInput } from '@/types/chat';

const bodySchema = z.object({
  text: z.string({ invalid_type_error: CHAT_MESSAGE_LENGTH_MESSAGE }).trim().max(MAX_CHAT_MESSAGE_CHARS, CHAT_MESSAGE_LENGTH_MESSAGE).default(''),
  photoIds: z.array(z.string({ invalid_type_error: CHAT_PHOTO_COUNT_MESSAGE }).min(1, CHAT_PHOTO_COUNT_MESSAGE), { invalid_type_error: CHAT_PHOTO_COUNT_MESSAGE }).max(MAX_CHAT_PHOTOS, CHAT_PHOTO_COUNT_MESSAGE).default([]),
});

// A send is either a retry of the last unanswered message or a new message with text, photos or both. Each failure has one fixed message.
export const parseChatSendInput = (body: unknown): ChatSendInput => {
  if (typeof body === 'object' && body !== null && (body as { retry?: unknown }).retry === true) return { retry: true };
  const isPlainObject = typeof body === 'object' && body !== null && !Array.isArray(body);
  const parsed = bodySchema.safeParse(isPlainObject ? body : {});
  if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
  const { text, photoIds } = parsed.data;
  if (!text && photoIds.length === 0) throw new HttpError(CHAT_EMPTY_MESSAGE, 400);
  return { text, photoIds };
};
