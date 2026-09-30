import { z } from 'zod';

const optionalText = z.string().trim().max(500).nullish();

export const providerInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().min(1),
  statusId: z.string().min(1).optional(),
  company: optionalText,
  primaryContactName: optionalText,
  phone: optionalText,
  email: optionalText,
  website: optionalText,
  address: optionalText,
  licenseNumber: optionalText,
  googlePlaceId: optionalText,
  rating: z.number().int().min(1).max(5).nullish(),
  hiredAt: z.coerce.date().nullish(),
  notes: z.string().max(10000).nullish(),
});

export const providerUpdateSchema = providerInputSchema.partial();

export const categoryInputSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const statusInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(['neutral', 'positive', 'negative']).optional(),
  hiddenByDefault: z.boolean().optional(),
});

export const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });

export const deleteWithMoveSchema = z.object({ moveToId: z.string().min(1).optional() });

export const commentSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: optionalText,
  phone: optionalText,
  email: optionalText,
});

// Items are validated one at a time inside ProviderIngestService so a single bad row
// cannot fail the whole batch; the envelope only checks shape and size.
export const ingestBatchSchema = z.object({
  providers: z.array(z.unknown()).min(1).max(500),
});

export const ingestItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  status: z.string().trim().min(1).max(100).optional(),
  company: optionalText,
  primaryContactName: optionalText,
  phone: optionalText,
  email: optionalText,
  website: optionalText,
  address: optionalText,
  licenseNumber: optionalText,
  googlePlaceId: optionalText,
  evidence: z
    .array(
      z.object({
        sourceUrl: z.string().url(),
        sourceGroup: z.string().max(200).optional(),
        sourceDate: z.string().optional(),
        snippet: z.string().max(5000).optional(),
        kind: z.enum(['third_party', 'self_promo', 'lead']),
      })
    )
    .default([]),
});
