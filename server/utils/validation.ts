import type { ReminderConfig, ReminderEntry, ReminderTiming } from "@/types";

const MAX_REMINDERS = 5;
const VALID_TIMINGS: ReminderTiming[] = ["before", "on", "after"];

/**
 * Validate and sanitize a reminderConfig from user input.
 * Accepts new format { reminders: [...] } or auto-converts legacy format
 * { initialReminder, followUpReminder, overdueReminder }.
 * Returns null if no valid reminders are provided.
 */
export function validateReminderConfig(
  input: unknown
): ReminderConfig | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const raw = input as Record<string, unknown>;

  // If new format with reminders array, validate it
  if (Array.isArray(raw.reminders)) {
    return validateRemindersArray(raw.reminders);
  }

  // Auto-convert legacy format { initialReminder, followUpReminder, overdueReminder }
  return convertLegacyFormat(raw);
}

function validateRemindersArray(arr: unknown[]): ReminderConfig | null {
  const valid: ReminderEntry[] = [];
  const seen = new Set<string>();

  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const entry = item as Record<string, unknown>;
    let timing = entry.timing;
    let days = entry.days;

    // Validate timing
    if (typeof timing !== "string" || !VALID_TIMINGS.includes(timing as ReminderTiming)) continue;

    // Force days to 0 for 'on' timing
    if (timing === "on") {
      days = 0;
    }

    // Validate days
    if (typeof days !== "number" || !Number.isInteger(days) || days < 0) continue;

    // Deduplicate
    const key = `${timing}:${days}`;
    if (seen.has(key)) continue;
    seen.add(key);

    valid.push({ days, timing: timing as ReminderTiming });

    // Cap at max
    if (valid.length >= MAX_REMINDERS) break;
  }

  if (valid.length === 0) return null;
  return { reminders: valid };
}

function convertLegacyFormat(raw: Record<string, unknown>): ReminderConfig | null {
  const reminders: ReminderEntry[] = [];

  if (typeof raw.initialReminder === "number" && raw.initialReminder >= 0) {
    reminders.push({ days: raw.initialReminder, timing: "before" });
  }
  if (typeof raw.followUpReminder === "number" && raw.followUpReminder >= 0) {
    reminders.push({ days: raw.followUpReminder, timing: "before" });
  }
  if (typeof raw.overdueReminder === "number" && raw.overdueReminder >= 0) {
    reminders.push({ days: raw.overdueReminder, timing: "after" });
  }

  if (reminders.length === 0) return null;

  // Deduplicate (e.g., if initialReminder and followUpReminder had same value)
  const seen = new Set<string>();
  const deduped: ReminderEntry[] = [];
  for (const r of reminders) {
    const key = `${r.timing}:${r.days}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  return { reminders: deduped };
}
