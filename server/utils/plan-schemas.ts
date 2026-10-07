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

// Length limits are not checked here: a reply that runs long is cut in clampPlan, not thrown away.
const text = z.string().trim().min(1);
const optionalText = z.string().trim().nullish().transform((value) => value || null);
// The model may send null for a flag it was unsure of; that means false.
const flag = z.boolean().nullish().transform((value) => value ?? false);
// A quantity may arrive as a number or null; it is kept as text.
const quantityText = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => (value === null || value === undefined ? '' : String(value).trim()));
// Case and spaces around the word do not matter; a word that is not a difficulty still fails.
const difficulty = z.preprocess((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value), z.enum(PLAN_DIFFICULTIES));

// What clampPlan cuts text to (a step's text uses the checklist's own limit).
const MAX_NAME_LENGTH = 120;
const MAX_QUANTITY_LENGTH = 60;
const MAX_EXPLANATION_LENGTH = 400;
const cut = (value: string, max: number): string => value.slice(0, max).trim();
// The model may send fractions or negatives; the clamp below fixes them, so the schema only asks for a number.
const loose = z.number();

const TOO_VAGUE_REPLY = { tooVague: true, summary: null, safety: null, steps: [], tools: [], materials: [] };

// A too-vague reply has no plan, so whatever the model put in the rest of it is ignored rather than validated.
const ignoreBodyWhenTooVague = (input: unknown): unknown =>
  typeof input === 'object' && input !== null && 'tooVague' in input && input.tooVague === true ? TOO_VAGUE_REPLY : input;

// The body of a plan reply. Lenient on numbers, flags, text length and missing optional fields; strict on shape and on the difficulty word.
const planReplyBody = z
  .object({
    tooVague: z.boolean(),
    summary: z
      .object({
        totalMinutes: loose,
        costLow: loose,
        costHigh: loose,
        difficulty,
        why: text,
      })
      .nullish(),
    safety: optionalText,
    steps: z
      .array(
        z.object({
          text,
          minutes: loose.default(0),
          costLow: loose.default(0),
          costHigh: loose.default(0),
          pro: flag,
          proWhy: optionalText,
        }),
      )
      .nullish()
      .transform((value) => value ?? []),
    tools: z
      .array(z.object({ name: text, have: flag, priceLow: loose.default(0), priceHigh: loose.default(0) }))
      .nullish()
      .transform((value) => value ?? []),
    materials: z
      .array(z.object({ name: text, quantity: quantityText, priceLow: loose.default(0), priceHigh: loose.default(0) }))
      .nullish()
      .transform((value) => value ?? []),
  })
  .superRefine((reply, ctx) => {
    if (!reply.tooVague && !reply.summary) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'summary is required' });
  });

// The model's reply, as validated: a too-vague reply is accepted whatever its body holds.
export const planReplySchema = z.preprocess(ignoreBodyWhenTooVague, planReplyBody);
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
      text: cut(step.text, MAX_STEP_TEXT_LENGTH),
      minutes: whole(step.minutes, MAX_STEP_ESTIMATE_MINUTES),
      costLow,
      costHigh,
      pro: step.pro,
      proWhy: step.pro && step.proWhy ? cut(step.proWhy, MAX_EXPLANATION_LENGTH) : null,
    };
  });
  const tools = reply.tools.slice(0, MAX_PLAN_TOOLS).map((tool) => {
    const [priceLow, priceHigh] = tool.have ? [0, 0] : range(tool.priceLow, tool.priceHigh, MAX_PLAN_DOLLARS);
    return { name: cut(tool.name, MAX_NAME_LENGTH), have: tool.have, priceLow, priceHigh };
  });
  const materials = reply.materials.slice(0, MAX_PLAN_MATERIALS).map((material) => {
    const [priceLow, priceHigh] = range(material.priceLow, material.priceHigh, MAX_PLAN_DOLLARS);
    return { name: cut(material.name, MAX_NAME_LENGTH), quantity: cut(material.quantity, MAX_QUANTITY_LENGTH), priceLow, priceHigh };
  });
  const [costLow, costHigh] = range(reply.summary.costLow, reply.summary.costHigh, MAX_PLAN_DOLLARS);

  return {
    tooVague: false,
    summary: {
      totalMinutes: Math.min(MAX_PLAN_MINUTES, steps.reduce((sum, step) => sum + step.minutes, 0)),
      costLow,
      costHigh,
      difficulty: reply.summary.difficulty,
      why: cut(reply.summary.why, MAX_EXPLANATION_LENGTH),
    },
    safety: reply.safety ? cut(reply.safety, MAX_EXPLANATION_LENGTH) : null,
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
