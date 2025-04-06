import { ScheduleConfig } from "@/types";
import { addDays, addMonths, addYears } from "date-fns";

/**
 * Calculates the next due date based on the schedule config and the last due date.
 * Returns null if the schedule type is unsupported or invalid.
 */
export function calculateNextDueDate(
  scheduleConfig: ScheduleConfig,
  lastDueDate: Date | null // Use null for the very first calculation
): Date | null {
  const startDate = lastDueDate || new Date(); // Start from today if no previous date

  switch (scheduleConfig.type) {
    case "fixed_interval":
      if (!scheduleConfig.interval || !scheduleConfig.intervalUnit) {
        console.error(
          "[Schedule] Invalid fixed_interval config:",
          scheduleConfig
        );
        return null;
      }
      const interval = scheduleConfig.interval;
      switch (scheduleConfig.intervalUnit) {
        case "day":
          return addDays(startDate, interval);
        case "week":
          return addDays(startDate, interval * 7);
        case "month":
          return addMonths(startDate, interval);
        case "year":
          return addYears(startDate, interval);
        default:
          console.error(
            "[Schedule] Invalid intervalUnit:",
            scheduleConfig.intervalUnit
          );
          return null;
      }

    // TODO: Implement other schedule types (once, specific_days_of_week, etc.)
    case "once":
      // 'once' schedules typically don't generate recurring occurrences automatically
      // Or might have a specific date set elsewhere. For now, return null.
      return null;

    case "specific_days_of_week":
    case "specific_day_of_month":
    case "specific_weekday_of_month":
    case "variable_interval":
      console.warn(
        `[Schedule] Schedule type "${scheduleConfig.type}" not yet implemented for automatic generation.`
      );
      return null;

    default:
      console.error(
        "[Schedule] Unknown or unexpected schedule configuration received:",
        scheduleConfig
      );
      return null;
  }
}

/**
 * Generates a specified number of future due dates based on the schedule.
 */
export function generateFutureDueDates(
  scheduleConfig: ScheduleConfig,
  count: number = 5, // Generate next 5 occurrences by default
  startDate: Date = new Date() // Start generating from today
): Date[] {
  const dueDates: Date[] = [];
  let lastDueDate: Date | null = null; // Start with no previous date for the first calculation

  // Handle 'once' schedule type specifically
  if (scheduleConfig.type === "once") {
    // Check if the end condition specifies a date
    if (
      scheduleConfig.endCondition?.type === "date" &&
      scheduleConfig.endCondition.date
    ) {
      const specificDate = new Date(scheduleConfig.endCondition.date);
      // Only return the date if it's on or after the generation start date
      if (specificDate >= startDate) {
        return [specificDate];
      }
    }
    // If 'once' schedule has no specific date or it's in the past, return empty
    return [];
  }

  // For recurring schedules, generate based on calculateNextDueDate

  for (let i = 0; i < count; i++) {
    const nextDate = calculateNextDueDate(
      scheduleConfig,
      lastDueDate || startDate
    ); // Pass startDate if lastDueDate is null
    if (nextDate) {
      dueDates.push(nextDate);
      lastDueDate = nextDate; // Update lastDueDate for the next iteration
    } else {
      // Stop if we can't calculate the next date (e.g., unsupported type, end of 'once')
      break;
    }
  }
  return dueDates;
}
