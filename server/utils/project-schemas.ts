import { z } from 'zod';
import { HttpError } from '@/server/utils/api-errors';
import {
  DEFAULT_LIST_STATUSES,
  PROJECT_PATHS,
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

export const projectCreateSchema = z.object({ title, location });

export const projectUpdateSchema = z.object({
  title: title.optional(),
  location,
  status: z.enum(PROJECT_STATUSES, { message: 'Unknown status' }).optional(),
  path: z.enum(PROJECT_PATHS, { message: 'Unknown path' }).nullable().optional(),
  notes,
});

const dimension = z.coerce.number().int().min(1).max(20000);
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
