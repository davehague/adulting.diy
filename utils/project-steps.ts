import { type NextStepKind } from '@/types/project';

interface StepLike {
  doneAt?: Date | string | null;
}

export interface NextStepResult<T extends StepLike> {
  kind: NextStepKind;
  step: T | null;
}

// What a project shows in the next-step list. `steps` must already be in display order.
export const nextStepOf = <T extends StepLike>(steps: T[]): NextStepResult<T> => {
  if (steps.length === 0) return { kind: 'noSteps', step: null };
  const next = steps.find((step) => !step.doneAt);
  return next ? { kind: 'step', step: next } : { kind: 'allDone', step: null };
};

export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};
