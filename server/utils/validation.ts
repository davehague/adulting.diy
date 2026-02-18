import type { ReminderConfig } from "@/types";

/**
 * Validate and sanitize a reminderConfig from user input.
 * Strips unknown keys (e.g. legacy "daysBeforeDue", "enabled") and ensures
 * only the expected numeric fields are present.
 * Returns null if no valid reminder fields are provided.
 */
export function validateReminderConfig(
  input: unknown
): ReminderConfig | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const result: ReminderConfig = {};

  if (typeof raw.initialReminder === "number" && raw.initialReminder >= 0) {
    result.initialReminder = raw.initialReminder;
  }
  if (typeof raw.followUpReminder === "number" && raw.followUpReminder >= 0) {
    result.followUpReminder = raw.followUpReminder;
  }
  if (typeof raw.overdueReminder === "number" && raw.overdueReminder >= 0) {
    result.overdueReminder = raw.overdueReminder;
  }

  // Return null if no valid fields were extracted
  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}
