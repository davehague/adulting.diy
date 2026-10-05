import { z } from 'zod';
import { MAX_EXTRA_TEXT_LENGTH } from '@/types/suggestion';

// The service's own setting for forcing a reply shape was shown not to hold (bake-off, 2026-10-05), so every reply is parsed and validated here.
export const parseModelJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    // fall through: the reply may be wrapped in a code fence or have prose around it
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Reply is not JSON');
  return JSON.parse(text.slice(start, end + 1));
};

const shortText = (max: number) => z.string().trim().min(1).max(max);

// A too-vague reply may leave out `parts` (the prompt says "return no parts"), and a part may leave out a null `categoryId`.
export const routingReplySchema = z.object({
  tooVague: z.boolean(),
  parts: z
    .array(
      z.object({
        name: shortText(100),
        categoryId: z
          .string()
          .nullish()
          .transform((value) => value ?? null),
        why: shortText(500),
        searchPhrase: shortText(150),
      }),
    )
    .default([]),
});
export type RoutingReply = z.infer<typeof routingReplySchema>;

export const pickingReplySchema = z.object({
  parts: z.array(
    z.object({
      partIndex: z.number().int(),
      picks: z.array(z.object({ providerId: z.string(), reason: shortText(600) })),
    }),
  ),
});
export type PickingReply = z.infer<typeof pickingReplySchema>;

// What is stored in project_suggestions.result. A row this build cannot read is treated as no suggestion.
export const savedResultSchema = z.object({
  tooVague: z.boolean(),
  parts: z.array(
    z.object({
      name: z.string(),
      why: z.string(),
      categoryId: z.string().nullable(),
      searchPhrase: z.string(),
      poolSize: z.number().int(),
      picks: z.array(z.object({ providerId: z.string(), reason: z.string() })),
    }),
  ),
});

const TOO_LONG = `Anything to add must be ${MAX_EXTRA_TEXT_LENGTH} characters or fewer`;

export const suggestionRequestSchema = z.object({
  extraText: z
    .string({ invalid_type_error: TOO_LONG })
    .trim()
    .max(MAX_EXTRA_TEXT_LENGTH, TOO_LONG)
    .nullish()
    .transform((value) => (value ? value : null)),
});
