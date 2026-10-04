/**
 * Variable schedules float with the work: the next due date is based on when an
 * occurrence was actually completed or skipped, not on its due date. Every other
 * recurring type stays anchored to its pattern.
 */
export const isVariableSchedule = (config?: { type?: string } | null): boolean =>
  config?.type === "variable_interval" || config?.type === "annual_variable";
