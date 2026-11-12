import { z } from 'zod';
import { HttpError } from '@/server/utils/api-errors';
import {
  DEFAULT_LIST_STATUSES,
  MAX_DOCUMENT_NAME_LENGTH,
  MAX_DOCUMENT_NOTE_LENGTH,
  MAX_PROJECT_STEPS,
  MAX_STEP_ESTIMATE_MINUTES,
  MAX_STEP_TEXT_LENGTH,
  PROJECT_PATHS,
  PROJECT_PROVIDER_STATUSES,
  PROJECT_STATUSES,
  type ProjectPathFilter,
  type ProjectStatus,
} from '@/types/project';

const emptyToNull = (value: string): string | null => (value === '' ? null : value);

const title = z
  .string({ required_error: 'Title is required' })
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer');

const location = z
  .string()
  .trim()
  .max(100, 'Location must be 100 characters or fewer')
  .transform(emptyToNull)
  .nullable()
  .optional();

const notes = z
  .string()
  .trim()
  .max(5000, 'Notes must be 5000 characters or fewer')
  .transform(emptyToNull)
  .nullable()
  .optional();

export const projectCreateSchema = z.object({ title, location, notes });

export const projectUpdateSchema = z.object({
  title: title.optional(),
  location,
  status: z.enum(PROJECT_STATUSES, { message: 'Unknown status' }).optional(),
  path: z.enum(PROJECT_PATHS, { message: 'Unknown path' }).nullable().optional(),
  notes,
  providerCategoryId: z
    .string({ invalid_type_error: 'Unknown provider category' })
    .min(1, 'Unknown provider category')
    .nullable()
    .optional(),
});

const ESTIMATE_MESSAGE = `Estimate must be a whole number of minutes from 1 to ${MAX_STEP_ESTIMATE_MINUTES}`;

const stepText = z
  .string({ required_error: 'Step text is required', invalid_type_error: 'Step text is required' })
  .trim()
  .min(1, 'Step text is required')
  .max(MAX_STEP_TEXT_LENGTH, `Step text must be ${MAX_STEP_TEXT_LENGTH} characters or fewer`);

const estimateMinutes = z
  .number({ invalid_type_error: ESTIMATE_MESSAGE })
  .int(ESTIMATE_MESSAGE)
  .min(1, ESTIMATE_MESSAGE)
  .max(MAX_STEP_ESTIMATE_MINUTES, ESTIMATE_MESSAGE)
  .nullable()
  .optional();

export const stepCreateSchema = z.object({ text: stepText, estimateMinutes });

export const stepUpdateSchema = z.object({
  text: stepText.optional(),
  estimateMinutes,
  done: z.boolean({ invalid_type_error: 'Done must be true or false' }).optional(),
});

export const MAX_PROJECT_INGEST_BATCH = 100;

// Items are validated one at a time inside ProjectIngestService so a single bad item
// cannot fail the whole batch; the envelope only checks shape and size.
export const projectIngestBatchSchema = z.object({
  projects: z.array(z.unknown()).min(1).max(MAX_PROJECT_INGEST_BATCH),
});

export const projectIngestItemSchema = projectCreateSchema.extend({
  status: z.enum(PROJECT_STATUSES, { message: 'Unknown status' }).default('planning'),
  path: z.enum(PROJECT_PATHS, { message: 'Unknown path' }).nullable().default(null),
  steps: z
    .array(stepCreateSchema)
    .max(MAX_PROJECT_STEPS, `A project can have at most ${MAX_PROJECT_STEPS} steps`)
    .default([]),
});

export const projectProviderLinkSchema = z.object(
  {
    providerId: z
      .string({ required_error: 'Provider is required', invalid_type_error: 'Provider is required' })
      .min(1, 'Provider is required'),
  },
  { required_error: 'Provider is required', invalid_type_error: 'Provider is required' },
);

export const projectProviderStatusSchema = z.object({
  status: z.enum(PROJECT_PROVIDER_STATUSES, { message: 'Unknown status' }),
});

const dimension = z.coerce.number().int().min(1).max(20000);
const documentName = z
  .string({ required_error: 'Name is required', invalid_type_error: 'Name is required' })
  .trim()
  .min(1, "Name can't be blank")
  .max(MAX_DOCUMENT_NAME_LENGTH, `Name must be ${MAX_DOCUMENT_NAME_LENGTH} characters or fewer`);

const documentNote = z
  .string()
  .trim()
  .max(MAX_DOCUMENT_NOTE_LENGTH, `Note must be ${MAX_DOCUMENT_NOTE_LENGTH} characters or fewer`)
  .transform(emptyToNull)
  .nullable();

export const documentRegisterSchema = z.object(
  {
    id: z.string().uuid('Invalid document id'),
    blobPath: z.string().min(1, 'Invalid document path').max(400, 'Invalid document path'),
    name: documentName,
    note: documentNote.optional().transform((value) => value ?? null),
  },
  { required_error: 'Document details are required', invalid_type_error: 'Document details are required' },
);

export const documentUpdateSchema = z
  .object(
    { name: documentName.optional(), note: documentNote.optional() },
    { required_error: 'Nothing to update', invalid_type_error: 'Nothing to update' },
  )
  .refine((value) => value.name !== undefined || value.note !== undefined, 'Nothing to update');

export const ingestUploadUrlSchema = z.object(
  { fileName: z.string({ required_error: 'fileName is required', invalid_type_error: 'fileName is required' }).min(1, 'fileName is required').max(255, 'fileName must be 255 characters or fewer') },
  { required_error: 'Body must be { fileName }', invalid_type_error: 'Body must be { fileName }' },
);

export const ingestDocumentRegisterSchema = z.object(
  {
    documentId: z.string({ required_error: 'documentId is required', invalid_type_error: 'documentId is required' }).min(1, 'documentId is required'),
    name: documentName.optional(),
    note: documentNote.optional().transform((value) => value ?? null),
  },
  { required_error: 'Body must be { documentId, name?, note? }', invalid_type_error: 'Body must be { documentId, name?, note? }' },
);

export const photoDimensionsSchema = z.object({ width: dimension, height: dimension });

const isStatus = (value: string): value is ProjectStatus =>
  (PROJECT_STATUSES as readonly string[]).includes(value);

export const parseStatusFilter = (raw: unknown): ProjectStatus[] => {
  if (typeof raw !== 'string' || raw.trim() === '') return [...DEFAULT_LIST_STATUSES];
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean);
  const statuses: ProjectStatus[] = [];
  for (const value of values) {
    if (!isStatus(value)) throw new HttpError(`Unknown status: ${value}`, 400);
    statuses.push(value);
  }
  return statuses;
};

export const parsePathFilter = (raw: unknown): ProjectPathFilter | undefined => {
  if (typeof raw !== 'string' || raw === '') return undefined;
  if (raw === 'none' || (PROJECT_PATHS as readonly string[]).includes(raw)) return raw as ProjectPathFilter;
  throw new HttpError(`Unknown path: ${raw}`, 400);
};
