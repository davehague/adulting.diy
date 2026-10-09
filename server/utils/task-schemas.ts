import { z } from 'zod';

export const MAX_TASK_INGEST_BATCH = 100;

const DATE_MESSAGE = 'Dates must be YYYY-MM-DD';
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, DATE_MESSAGE)
  .refine((value) => !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime()), DATE_MESSAGE);

const interval = z.number().int().min(1, 'Interval must be at least 1').max(365, 'Interval must be 365 or less');
const unit = z.enum(['day', 'week', 'month', 'year'], { message: 'Unit must be day, week, month or year' });
// Ingested tasks always recur until someone ends them in the app.
const endCondition = z.object({ type: z.literal('never') }).default({ type: 'never' });

// The schedule shapes from types/task.ts that machine callers may send.
const ingestScheduleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('once'), dueDate: dateOnly, endCondition }),
  z.object({ type: z.literal('fixed_interval'), interval, intervalUnit: unit, endCondition }),
  z.object({
    type: z.literal('variable_interval'),
    variableInterval: z.object({ interval, unit }),
    endCondition,
  }),
], { errorMap: () => ({ message: 'scheduleConfig type must be once, fixed_interval or variable_interval' }) });

// Items are validated one at a time inside TaskIngestService so a single bad item
// cannot fail the whole batch; the envelope only checks shape and size.
export const taskIngestBatchSchema = z.object({
  tasks: z.array(z.unknown()).min(1).max(MAX_TASK_INGEST_BATCH),
});

export const taskIngestItemSchema = z
  .object({
    name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(200),
    category: z.string().trim().min(1).max(100).optional(),
    categoryId: z.string().min(1).optional(),
    description: z.string().trim().max(5000).optional(),
    scheduleConfig: ingestScheduleSchema,
    firstDueDate: dateOnly.optional(),
  })
  .refine((item) => !!item.category !== !!item.categoryId, {
    message: 'Give exactly one of category or categoryId',
  })
  .refine((item) => !(item.firstDueDate && item.scheduleConfig.type === 'once'), {
    message: 'A once task takes its date from scheduleConfig.dueDate, not firstDueDate',
  });

export type TaskIngestItem = z.infer<typeof taskIngestItemSchema>;
