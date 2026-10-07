import { type ProjectStepCreateInput, type ProjectStepDto } from '@/types/project';

export const MAX_PLAN_STEPS = 30;
export const MAX_PLAN_TOOLS = 30;
export const MAX_PLAN_MATERIALS = 30;
export const MAX_PLAN_MINUTES = 10_080;
export const MAX_PLAN_DOLLARS = 100_000;
export const MAX_BATCH_STEPS = 30;
export const DIY_PLAN_FEATURE = 'diy_plan';

export const PLAN_DIFFICULTIES = ['easy', 'moderate', 'hard', 'hire'] as const;
export type PlanDifficulty = (typeof PLAN_DIFFICULTIES)[number];
export const PLAN_DIFFICULTY_LABELS: Record<PlanDifficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  hire: 'Hire this out',
};

// What is stored in project_plans.result. Numbers are whole; dollar figures are rounded ranges.
export interface PlanSummary {
  // the sum of the step minutes, recomputed in code
  totalMinutes: number;
  costLow: number;
  costHigh: number;
  difficulty: PlanDifficulty;
  why: string;
}

export interface PlanStep {
  text: string;
  minutes: number;
  costLow: number;
  costHigh: number;
  // needs a licensed or professional trade; cost is always 0 to 0
  pro: boolean;
  proWhy: string | null;
}

export interface PlanTool {
  name: string;
  // part of the basic toolkit the plan assumes; price is 0 to 0
  have: boolean;
  priceLow: number;
  priceHigh: number;
}

export interface PlanMaterial {
  name: string;
  quantity: string;
  priceLow: number;
  priceHigh: number;
}

export interface SavedPlanResult {
  tooVague: boolean;
  // null only when tooVague
  summary: PlanSummary | null;
  safety: string | null;
  steps: PlanStep[];
  tools: PlanTool[];
  materials: PlanMaterial[];
}

export interface ProjectPlanDto extends SavedPlanResult {
  extraText: string | null;
  createdAt: Date | string;
}

export interface PlanStateResponse {
  enabled: boolean;
  limitReached: boolean;
  // the project has a saved provider suggestion that is not too vague
  hasSuggestions: boolean;
  plan: ProjectPlanDto | null;
}

export type PlanRunStatus = 'ok' | 'too_vague' | 'failed';

export interface PlanRunResponse {
  status: PlanRunStatus;
  limitReached: boolean;
  hasSuggestions: boolean;
  // on 'failed' this is the previously saved plan, or null
  plan: ProjectPlanDto | null;
}

export interface StepBatchInput {
  steps: ProjectStepCreateInput[];
}

export interface StepBatchResponse {
  // the whole checklist, in order, after the add
  steps: ProjectStepDto[];
  // how many of the sent steps did not fit under the cap
  skipped: number;
}
