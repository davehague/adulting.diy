import { z } from 'zod';
import { stepCreateSchema } from '@/server/utils/project-schemas';
import { MAX_STEP_ESTIMATE_MINUTES, MAX_STEP_TEXT_LENGTH } from '@/types/project';
import {
  MAX_BATCH_STEPS,
  MAX_PLAN_DOLLARS,
  MAX_PLAN_MATERIALS,
  MAX_PLAN_MINUTES,
  MAX_PLAN_STEPS,
  MAX_PLAN_TOOLS,
  PLAN_DIFFICULTIES,
  type SavedPlanResult,
} from '@/types/plan';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);
// The model may send fractions or negatives; the clamp below fixes them, so the schema only asks for a number.
const loose = z.number();

// The model's reply. Lenient on numbers and on missing optional fields; strict on shape and on the difficulty word.
export const planReplySchema = z
  .object({
    tooVague: z.boolean(),
    summary: z
      .object({
        totalMinutes: loose,
        costLow: loose,
        costHigh: loose,
        difficulty: z.enum(PLAN_DIFFICULTIES),
        why: text(400),
      })
      .nullish(),
    safety: optionalText(400),
    steps: z
      .array(
        z.object({
          text: text(400),
          minutes: loose,
          costLow: loose,
          costHigh: loose,
          pro: z.boolean().default(false),
          proWhy: optionalText(400),
        }),
      )
      .nullish()
      .transform((value) => value ?? []),
    tools: z
      .array(z.object({ name: text(120), have: z.boolean().default(false), priceLow: loose.default(0), priceHigh: loose.default(0) }))
      .nullish()
      .transform((value) => value ?? []),
    materials: z
      .array(z.object({ name: text(120), quantity: z.string().trim().max(60).default(''), priceLow: loose.default(0), priceHigh: loose.default(0) }))
      .nullish()
      .transform((value) => value ?? []),
  })
  .superRefine((reply, ctx) => {
    if (!reply.tooVague && !reply.summary) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'summary is required' });
  });
export type PlanReply = z.infer<typeof planReplySchema>;

const whole = (value: number, max: number): number => Math.min(max, Math.max(0, Math.round(value)));

const range = (low: number, high: number, max: number): [number, number] => {
  const a = whole(low, max);
  const b = whole(high, max);
  return a <= b ? [a, b] : [b, a];
};

// The limits the model cannot be trusted to keep: counts, number bounds (a step's minutes fit the checklist's estimate limit), text that must fit the checklist, and the pro-step rules.
export const clampPlan = (reply: PlanReply): SavedPlanResult => {
  if (reply.tooVague || !reply.summary) return { tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] };

  const steps = reply.steps.slice(0, MAX_PLAN_STEPS).map((step) => {
    const [costLow, costHigh] = step.pro ? [0, 0] : range(step.costLow, step.costHigh, MAX_PLAN_DOLLARS);
    return {
      text: step.text.slice(0, MAX_STEP_TEXT_LENGTH).trim(),
      minutes: whole(step.minutes, MAX_STEP_ESTIMATE_MINUTES),
      costLow,
      costHigh,
      pro: step.pro,
      proWhy: step.pro ? step.proWhy : null,
    };
  });
  const tools = reply.tools.slice(0, MAX_PLAN_TOOLS).map((tool) => {
    const [priceLow, priceHigh] = tool.have ? [0, 0] : range(tool.priceLow, tool.priceHigh, MAX_PLAN_DOLLARS);
    return { name: tool.name, have: tool.have, priceLow, priceHigh };
  });
  const materials = reply.materials.slice(0, MAX_PLAN_MATERIALS).map((material) => {
    const [priceLow, priceHigh] = range(material.priceLow, material.priceHigh, MAX_PLAN_DOLLARS);
    return { name: material.name, quantity: material.quantity, priceLow, priceHigh };
  });
  const [costLow, costHigh] = range(reply.summary.costLow, reply.summary.costHigh, MAX_PLAN_DOLLARS);

  return {
    tooVague: false,
    summary: {
      totalMinutes: Math.min(MAX_PLAN_MINUTES, steps.reduce((sum, step) => sum + step.minutes, 0)),
      costLow,
      costHigh,
      difficulty: reply.summary.difficulty,
      why: reply.summary.why,
    },
    safety: reply.safety,
    steps,
    tools,
    materials,
  };
};

// What is stored in project_plans.result. A row this build cannot read is treated as no plan.
export const savedPlanSchema = z.object({
  tooVague: z.boolean(),
  summary: z
    .object({ totalMinutes: z.number(), costLow: z.number(), costHigh: z.number(), difficulty: z.enum(PLAN_DIFFICULTIES), why: z.string() })
    .nullable(),
  safety: z.string().nullable(),
  steps: z.array(z.object({ text: z.string(), minutes: z.number(), costLow: z.number(), costHigh: z.number(), pro: z.boolean(), proWhy: z.string().nullable() })),
  tools: z.array(z.object({ name: z.string(), have: z.boolean(), priceLow: z.number(), priceHigh: z.number() })),
  materials: z.array(z.object({ name: z.string(), quantity: z.string(), priceLow: z.number(), priceHigh: z.number() })),
});

export const stepBatchSchema = z.object({
  steps: z
    .array(stepCreateSchema, { required_error: 'Add at least one step', invalid_type_error: 'Add at least one step' })
    .min(1, 'Add at least one step')
    .max(MAX_BATCH_STEPS, `Add at most ${MAX_BATCH_STEPS} steps at a time`),
});
