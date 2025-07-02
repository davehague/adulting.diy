import type { ScheduleConfig, OnceScheduleConfig, FixedIntervalScheduleConfig, SpecificDaysScheduleConfig, SpecificDayOfMonthScheduleConfig, SpecificWeekdayOfMonthScheduleConfig, VariableIntervalScheduleConfig } from "@/types";
import { addDays, addWeeks, addMonths, addYears, startOfDay, getDay, getDaysInMonth, setDate, getDate, startOfMonth, format, isAfter, isBefore, isSameDay } from "date-fns"; // Using date-fns for date manipulation

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

    case "fixed_interval": {
      // For fixed intervals, calculate next occurrence based on interval and unit
      const config_ = config as FixedIntervalScheduleConfig;
      const { interval, intervalUnit } = config_;
      
      // Use lastCompletedDate if available, otherwise start from today
      const baseDate = lastCompletedDate ? startOfDay(lastCompletedDate) : today;
      
      switch (intervalUnit) {
        case "day":
          return addDays(baseDate, interval);
        case "week":
          return addWeeks(baseDate, interval);
        case "month":
          return addMonths(baseDate, interval);
        case "year":
          return addYears(baseDate, interval);
        default:
          console.error(`Unknown interval unit: ${intervalUnit}`);
          return null;
      }
    }

    case "specific_days_of_week": {
      // Find the next occurrence on one of the specified days of the week
      const config_ = config as SpecificDaysScheduleConfig;
      const { daysOfWeek } = config_;
      
      // Convert DaysOfWeek object to array of day indices (0=Sunday, 1=Monday, etc.)
      const targetDays: number[] = [];
      if (daysOfWeek.sunday) targetDays.push(0);
      if (daysOfWeek.monday) targetDays.push(1);
      if (daysOfWeek.tuesday) targetDays.push(2);
      if (daysOfWeek.wednesday) targetDays.push(3);
      if (daysOfWeek.thursday) targetDays.push(4);
      if (daysOfWeek.friday) targetDays.push(5);
      if (daysOfWeek.saturday) targetDays.push(6);
      
      if (targetDays.length === 0) {
        console.error("No days of week specified for specific_days_of_week schedule");
        return null;
      }
      
      // Start checking from tomorrow (or day after last completion)
      const startDate = lastCompletedDate ? addDays(startOfDay(lastCompletedDate), 1) : addDays(today, 1);
      
      // Find the next date that matches one of the target days
      for (let i = 0; i < 7; i++) {
        const candidateDate = addDays(startDate, i);
        const dayOfWeek = getDay(candidateDate);
        if (targetDays.includes(dayOfWeek)) {
          return candidateDate;
        }
      }
      
      // This should never happen given the loop above
      return null;
    }

    case "specific_day_of_month": {
      // Schedule for a specific day of each month
      const config_ = config as SpecificDayOfMonthScheduleConfig;
      const { dayOfMonth } = config_;
      
      if (dayOfMonth < 1 || dayOfMonth > 31) {
        console.error(`Invalid day of month: ${dayOfMonth}`);
        return null;
      }
      
      // Start from next month (or month after last completion)
      const baseDate = lastCompletedDate ? startOfDay(lastCompletedDate) : today;
      let nextMonth = addMonths(baseDate, 1);
      
      // Handle months that don't have the target day (e.g., Feb 30th)
      while (true) {
        const daysInMonth = getDaysInMonth(nextMonth);
        if (dayOfMonth <= daysInMonth) {
          return setDate(startOfMonth(nextMonth), dayOfMonth);
        }
        // Skip this month and try the next one
        nextMonth = addMonths(nextMonth, 1);
        
        // Safety check to prevent infinite loop
        if (nextMonth.getFullYear() > new Date().getFullYear() + 10) {
          console.error("Could not find valid day of month within reasonable timeframe");
          return null;
        }
      }
    }

    case "specific_weekday_of_month": {
      // Schedule for a specific weekday occurrence in each month (e.g., 2nd Friday)
      const config_ = config as SpecificWeekdayOfMonthScheduleConfig;
      const { weekdayOfMonth } = config_;
      
      // Convert weekday name to day index
      const weekdayMap = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
      };
      const targetWeekday = weekdayMap[weekdayOfMonth.weekday];
      
      // Start from next month (or month after last completion)
      const baseDate = lastCompletedDate ? startOfDay(lastCompletedDate) : today;
      let nextMonth = addMonths(baseDate, 1);
      
      while (true) {
        const firstOfMonth = startOfMonth(nextMonth);
        const firstWeekday = getDay(firstOfMonth);
        
        // Calculate dates for all occurrences of the target weekday in this month
        const occurrences: Date[] = [];
        for (let day = 1; day <= getDaysInMonth(nextMonth); day++) {
          const date = setDate(firstOfMonth, day);
          if (getDay(date) === targetWeekday) {
            occurrences.push(date);
          }
        }
        
        // Select the appropriate occurrence
        let targetDate: Date | null = null;
        switch (weekdayOfMonth.occurrence) {
          case "first":
            targetDate = occurrences[0] || null;
            break;
          case "second":
            targetDate = occurrences[1] || null;
            break;
          case "third":
            targetDate = occurrences[2] || null;
            break;
          case "fourth":
            targetDate = occurrences[3] || null;
            break;
          case "last":
            targetDate = occurrences[occurrences.length - 1] || null;
            break;
        }
        
        if (targetDate) {
          return targetDate;
        }
        
        // If this month doesn't have the required occurrence, try next month
        nextMonth = addMonths(nextMonth, 1);
        
        // Safety check
        if (nextMonth.getFullYear() > new Date().getFullYear() + 10) {
          console.error("Could not find valid weekday occurrence within reasonable timeframe");
          return null;
        }
      }
    }

    case "variable_interval": {
      // Schedule X days/weeks/months after the last completion/skip date
      const config_ = config as VariableIntervalScheduleConfig;
      const { variableInterval } = config_;
      
      // Variable intervals require a completion date to calculate from
      if (!lastCompletedDate) {
        console.warn("Variable interval requires lastCompletedDate but none provided");
        return null;
      }
      
      const baseDate = startOfDay(lastCompletedDate);
      
      switch (variableInterval.unit) {
        case "day":
          return addDays(baseDate, variableInterval.interval);
        case "week":
          return addWeeks(baseDate, variableInterval.interval);
        case "month":
          return addMonths(baseDate, variableInterval.interval);
        case "year":
          return addYears(baseDate, variableInterval.interval);
        default:
          console.error(`Unknown variable interval unit: ${variableInterval.unit}`);
          return null;
      }
    }

    default:
      console.error(`Unknown schedule type: ${(config as any).type}`);
      return null;
  }

  // End conditions are checked in the occurrence generation logic
  // This function only calculates the next potential date
}

/**
 * Checks if a task's end conditions have been met
 * @param config The schedule configuration
 * @param occurrenceCount Total number of occurrences generated so far
 * @param nextDueDate The calculated next due date to check against end date
 * @returns true if the task should end, false if it should continue
 */
export function checkEndCondition(
  config: ScheduleConfig,
  occurrenceCount: number,
  nextDueDate?: Date | null
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
    
    // If we have a calculated next due date, check if it's after the end date
    if (nextDueDate) {
      return isAfter(nextDueDate, endDate) || isSameDay(nextDueDate, endDate);
    }
    
    // Fallback: check if current date is past end date
    return isAfter(new Date(), endDate);
  }
  
  return false;
}

/**
 * Generates multiple future occurrences up to a specified horizon date
 * @param config The schedule configuration
 * @param horizonDate Generate occurrences up to this date
 * @param existingOccurrenceCount Number of occurrences already generated
 * @param lastCompletedDate Date of last completion (for variable intervals)
 * @returns Array of due dates for future occurrences
 */
export function generateFutureOccurrences(
  config: ScheduleConfig,
  horizonDate: Date,
  existingOccurrenceCount: number = 0,
  lastCompletedDate?: Date | null
): Date[] {
  const occurrences: Date[] = [];
  let currentOccurrenceCount = existingOccurrenceCount;
  let lastDate = lastCompletedDate;
  
  // For "once" type, only generate if we haven't generated any yet
  if (config.type === "once") {
    if (currentOccurrenceCount === 0) {
      const dueDate = calculateNextDueDate(config, lastDate);
      if (dueDate && !isAfter(dueDate, horizonDate)) {
        occurrences.push(dueDate);
      }
    }
    return occurrences;
  }
  
  // For recurring types, generate until horizon or end condition
  while (true) {
    const nextDate = calculateNextDueDate(config, lastDate);
    
    if (!nextDate) {
      break; // No more dates can be calculated
    }
    
    // Check if we've passed the horizon
    if (isAfter(nextDate, horizonDate)) {
      break;
    }
    
    // Check end conditions
    currentOccurrenceCount++;
    if (checkEndCondition(config, currentOccurrenceCount, nextDate)) {
      break;
    }
    
    occurrences.push(nextDate);
    lastDate = nextDate; // Update for next iteration
    
    // Safety check to prevent infinite loops
    if (occurrences.length > 1000) {
      console.warn("Generated over 1000 occurrences, stopping to prevent infinite loop");
      break;
    }
  }
  
  return occurrences;
}
