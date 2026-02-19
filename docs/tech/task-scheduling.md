# Task Scheduling - Technical Reference

## Overview

The scheduling system ensures every active recurring task always has exactly one pending occurrence. Occurrences are generated on-demand (after complete/skip) and backstopped by a daily cron job that fills in gaps.

### Key Files

| File | Purpose |
|------|---------|
| `server/utils/schedule.ts` | Core scheduling algorithms: `calculateNextDueDate()`, `generateFutureOccurrences()`, `calculateCatchUpDueDate()` |
| `server/services/TaskService.ts` | Task CRUD, lifecycle management, catch-up |
| `server/services/OccurrenceService.ts` | Occurrence CRUD, generation, execute/skip logic |
| `server/api/scheduler/run.ts` | Cron endpoint for occurrence generation |
| `types/task.ts` | Schedule config types (discriminated union) |
| `prisma/schema.prisma` | TaskDefinition and TaskOccurrence models |

## Cron Configuration

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/scheduler/run` | Daily at 06:00 UTC | Generate future occurrences |
| `/api/scheduler/reminders` | Daily at 13:00 UTC | Send reminder notifications |

Both endpoints are protected by `CRON_SECRET` bearer token and configured in `vercel.json`.

## Recurrence Patterns

All patterns are implemented in `calculateNextDueDate()` in `server/utils/schedule.ts`.

| Pattern | Type Key | Config Fields | Next Date Logic |
|---------|----------|--------------|-----------------|
| Once | `once` | `dueDate` | Single occurrence only |
| Fixed Interval | `fixed_interval` | `interval`, `intervalUnit` | Last due date + interval |
| Specific Days of Week | `specific_days_of_week` | `daysOfWeek` (boolean map) | Next matching weekday |
| Specific Day of Month | `specific_day_of_month` | `dayOfMonth` (1-31) | Target day of next month |
| Specific Weekday of Month | `specific_weekday_of_month` | `weekday`, `occurrence` | Target weekday occurrence of next month |
| Variable Interval | `variable_interval` | `variableInterval.interval`, `.unit` | Completion date + interval |
| Annual Fixed | `annual_fixed` | `month` (1-12), `dayOfMonth` (1-31) | Same calendar date each year regardless of completion |
| Annual Variable | `annual_variable` | `month` (1-12), `dayOfMonth` (1-31) | Shifts based on actual completion date (like variable interval, yearly) |

### Type System

Schedule configs use a discriminated union for type safety:

```typescript
type ScheduleConfig =
  | OnceScheduleConfig
  | FixedIntervalScheduleConfig
  | SpecificDaysScheduleConfig
  | SpecificDayOfMonthScheduleConfig
  | SpecificWeekdayOfMonthScheduleConfig
  | VariableIntervalScheduleConfig
  | AnnualFixedScheduleConfig
  | AnnualVariableScheduleConfig
```

Each config has a `type` discriminator field and pattern-specific required fields.

## Date Storage Convention

- All dates stored as `DateTime` in UTC
- Due dates represent the intended day (no time component significance)
- `startOfDay()` used for consistent day-boundary comparisons
- Household timezone applied at presentation and scheduling layers, not storage

## Task-Occurrence Relationship

```
TaskDefinition (1) ──→ (many) TaskOccurrence
  │                              │
  ├─ scheduleConfig (JSON)       ├─ dueDate
  ├─ reminderConfig (JSON)       ├─ status (created|assigned|completed|skipped|deleted)
  ├─ defaultAssigneeIds[]        ├─ assigneeIds[] (inherited, can be overridden)
  ├─ metaStatus (active|...)     ├─ completedAt / skippedAt
  └─ endCondition                └─ OccurrenceHistoryLog entries
```

- **Generation**: One pending occurrence per task; created on-demand after complete/skip, with daily scheduler as gap-filler
- **Inheritance**: New occurrences inherit `defaultAssigneeIds` from the parent task
- **Variable recurrence**: Next occurrence uses actual completion/skip date, not due date
- **End conditions**: Checked before each occurrence creation

## Occurrence Generation Flow

### Design Principle: One Pending Occurrence Per Task

A task should have exactly **one** pending occurrence (`created` or `assigned` status) at any time. The two generation paths work together to maintain this invariant:

1. **On-demand (primary)**: When an occurrence is completed or skipped, the next one is generated immediately
2. **Scheduler (gap-filler)**: Daily cron catches any task that somehow ended up with zero pending occurrences

### On-Demand Generation (Primary Path)

When an occurrence is completed or skipped, the system generates the next occurrence immediately:

```
OccurrenceService.execute() / skip()
  ├→ Update occurrence status
  ├→ Determine base date:
  │   Fixed patterns → use dueDate (preserves cadence anchor)
  │   Variable interval → use completedAt/skippedAt (schedule floats)
  ├→ Check end conditions
  ├→ calculateNextDueDate(config, baseDate)
  ├→ Check no occurrence already exists for that date
  └→ Create next TaskOccurrence
```

### Scheduler (Gap-Filler)

The daily cron job ensures no task is left without a pending occurrence:

```
Vercel Cron (daily at 06:00 UTC)
  └→ POST /api/scheduler/run
      ├→ horizonDate = now + 3 months
      ├→ Fetch all tasks where metaStatus = 'active'
      └→ For each task:
          ├→ Count pending occurrences (status: created/assigned)
          ├→ If pendingCount > 0 → SKIP (task already has next occurrence)
          └→ If pendingCount = 0 → Generate via OccurrenceService.generateAndCreateOccurrences()
              ├→ Count existing occurrences
              ├→ Find last completed/skipped occurrence
              ├→ generateFutureOccurrences(config, horizon, count, lastCompletedDate)
              │   └→ Loop: calculateNextDueDate() until > horizon or end condition met
              └→ For each new date:
                  ├→ Check no duplicate exists for that date
                  ├→ Create TaskOccurrence
                  └→ Log in OccurrenceHistoryLog
```

The scheduler only processes tasks with **zero** pending occurrences. This prevents the scheduler from pre-generating multiple future occurrences and ensures it serves purely as a safety net.

## Task Lifecycle and Occurrence Cascading

When a task's lifecycle state changes, occurrences are affected:

### Pause
- Sets `metaStatus` to `"paused"`
- All future `created`/`assigned` occurrences are set to `"deleted"` status
- Current/overdue occurrences remain actionable (can be completed or skipped)
- Completing/skipping an occurrence on a paused task does NOT generate the next occurrence

### Unpause
- Sets `metaStatus` back to `"active"`
- Immediately generates the next occurrence:
  - For `variable_interval` / `annual_variable`: finds last completed/skipped occurrence as base date, calls `generateNextOccurrence()`
  - For all other recurring types: calls `createInitialOccurrence()` to calculate and create the next due date
  - For `once` type: no occurrence generated (one-time tasks don't recur)

### Soft Delete
- Same occurrence cleanup as pause
- Task is hidden from all queries

### Schedule Config Edit
- When `scheduleConfig` changes in `TaskService.update()`:
  1. Original task fetched for comparison
  2. Future active occurrences (`created`/`assigned`, `dueDate > now`) set to `"deleted"`
  3. New occurrence generated based on updated schedule via `createInitialOccurrence()`
  4. Completed/skipped occurrences are never touched
- Non-schedule field changes (name, description, category) do not trigger reconciliation

## Catch-Up Feature

When overdue occurrences accumulate, `TaskService.catchUp()` handles bulk resolution:

1. **Find overdue**: Query occurrences with status `created`/`assigned` and `dueDate < now`
2. **Calculate next date**: `calculateCatchUpDueDate()` in schedule.ts
   - Fixed intervals: Walk forward preserving cadence anchor
   - Variable intervals: Today + interval (virtual completion)
   - Pattern-based (days of week, day of month): Jump to next matching future date
3. **Transaction**: Bulk-skip overdue occurrences, create/update future occurrence, log everything
4. **Override**: User can optionally specify a custom next date

## End Conditions

Checked in `checkEndCondition()` before creating each occurrence:

| Type | Config | Stops When |
|------|--------|-----------|
| `never` | (default) | Never stops |
| `times` | `{ times: number }` | Total occurrence count >= times |
| `date` | `{ date: Date }` | Next due date > cutoff date |

Safety limit: Generation loop caps at 1000 occurrences to prevent infinite loops.
