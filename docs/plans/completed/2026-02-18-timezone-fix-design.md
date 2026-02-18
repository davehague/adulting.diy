# Timezone Fix Design

## Problem

When a user edits a task occurrence and sets the due date to "today", the stored date ends up as "yesterday". This happens because `new Date("2026-02-18")` parses as `2026-02-18T00:00:00Z` (midnight UTC), which displays as Feb 17 in any timezone west of UTC.

## Root Cause

JavaScript's `new Date("YYYY-MM-DD")` treats date-only strings as UTC midnight per the ECMAScript spec. Due dates are calendar dates, not moments in time, but the backend treats them as moments.

**Primary bug location**: `server/api/occurrences/[id]/index.put.ts:29`
**Secondary locations**: `CatchUpModal.vue`, `TaskEditForm.vue`, `schedule.ts`

## Design

### Part 1: Fix Date Storage (Noon UTC Pattern)

Due dates are calendar dates, not moments. Store them at noon UTC so they display as the correct calendar date in every timezone from UTC-12 to UTC+12.

**New utility** in `server/utils/dates.ts`:

```typescript
export const parseDateOnly = (dateStr: string): Date => {
  return new Date(`${dateStr}T12:00:00.000Z`);
};
```

Applied at every backend location that converts a YYYY-MM-DD string to a Date object:
- `server/api/occurrences/[id]/index.put.ts`
- `server/utils/schedule.ts`
- Any other `new Date(dateString)` on date-only values

### Part 2: Household Timezone (Scheduler + Emails)

**Database**: Add `timezone` field to `Household` model.

```prisma
model Household {
  // ... existing fields
  timezone    String    @default("UTC")
}
```

**Frontend auto-detection**: On household creation, send `Intl.DateTimeFormat().resolvedOptions().timeZone` with the request.

**Household settings**: Add timezone dropdown for admins to change it.

**Scheduler**: Use household timezone to define "today" boundaries when checking overdue tasks and generating occurrences.

**Reminders**: Use household timezone to send emails at the right local time.

### Existing Data

No migration of existing dates. The scheduler regenerates future occurrences, and completed occurrences showing a slightly wrong date is an acceptable cosmetic issue.

## Tests

1. **Unit: `parseDateOnly`** — Verify noon UTC output, correct display across timezones, invalid input handling.
2. **Unit: Scheduler timezone logic** — Verify "today" boundary calculations with different household timezones.
3. **Integration: Occurrence update endpoint** — Verify stored date is noon UTC, not midnight UTC.
