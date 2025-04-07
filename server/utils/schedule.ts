import type { ScheduleConfig, OnceScheduleConfig } from "@/types";
import { addDays, addWeeks, addMonths, addYears, startOfDay } from "date-fns"; // Using date-fns for date manipulation

/**
 * Calculates the next due date based on the schedule configuration and the last completion date.
 *
 * @param config The schedule configuration object.
 * @param lastCompletedDate Optional. The date the task was last completed or skipped. Used for variable intervals.
 * @returns The calculated next due date, or null if the schedule cannot determine a next date (e.g., completed end condition).
 */
export function calculateNextDueDate(
  config: ScheduleConfig,
  lastCompletedDate?: Date | null
): Date | null {
  const now = new Date();
  const today = startOfDay(now); // Use start of day for consistent date comparisons

  switch (config.type) {
    case "once":
      // For 'once' tasks, the due date should be explicitly set in the config.
      // If it's missing or in the past, it might be considered immediately due or invalid.
      // Let's assume 'once' requires a 'dueDate' property.
      // Type guard ensures config is OnceScheduleConfig here
      // The dueDate is required and should be a Date object from the API layer
      if (config.dueDate instanceof Date && !isNaN(config.dueDate.getTime())) {
        // Ensure we use the start of the day for consistency
        return startOfDay(config.dueDate);
      } else {
        // This case should ideally not happen if validation is correct upstream
        console.error(
          "Invalid or missing 'dueDate' for schedule type 'once'.",
          config
        );
        // Fallback to today, but this indicates an issue elsewhere
        return today;
      }

    case "fixed_interval":
      // TODO: Implement fixed interval logic
      console.warn("Fixed interval scheduling not yet implemented.");
      return null; // Placeholder

    case "specific_days_of_week":
      // TODO: Implement specific days of week logic
      console.warn("Specific days of week scheduling not yet implemented.");
      return null; // Placeholder

    case "specific_day_of_month":
      // TODO: Implement specific day of month logic
      console.warn("Specific day of month scheduling not yet implemented.");
      return null; // Placeholder

    case "specific_weekday_of_month":
      // TODO: Implement specific weekday of month logic
      console.warn("Specific weekday of month scheduling not yet implemented.");
      return null; // Placeholder

    case "variable_interval":
      // TODO: Implement variable interval logic
      console.warn("Variable interval scheduling not yet implemented.");
      return null; // Placeholder

    default:
      console.error(`Unknown schedule type: ${(config as any).type}`);
      return null;
  }

  // TODO: Consider end conditions (times, date) after calculating the potential next date.
}

// Helper function to check end conditions (implementation needed)
function checkEndCondition(
  config: ScheduleConfig,
  occurrenceCount: number
): boolean {
  if (!config.endCondition || config.endCondition.type === "never") {
    return false; // Not ended
  }
  if (config.endCondition.type === "times") {
    return occurrenceCount >= (config.endCondition.times ?? Infinity);
  }
  if (config.endCondition.type === "date") {
    // Ensure date exists and is a valid Date object before using it
    if (
      !config.endCondition.date ||
      !(config.endCondition.date instanceof Date) ||
      isNaN(config.endCondition.date.getTime())
    ) {
      console.error("Invalid end condition date:", config.endCondition.date);
      return false; // Cannot check condition if date is invalid
    }
    const endDate = startOfDay(config.endCondition.date);
    // This check needs to happen *after* calculating the potential next due date.
    // If the *next* potential due date is after the end date, the task has ended.
    // This function might need refactoring to incorporate this check correctly.
    console.warn(
      "End condition date check needs refinement in scheduling logic."
    );
    return false; // Placeholder
  }
  return false;
}
