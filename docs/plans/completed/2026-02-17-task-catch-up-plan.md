# Task Catch-Up Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "catch up" feature that skips all overdue occurrences for a task and resets it to its next future due date, with full audit trail.

**Architecture:** New `TaskHistoryLog` Prisma model for task-level events. New `calculateCatchUpDueDate()` utility for schedule-aware date calculation. New `catchUp()` method on `TaskService`. Two new API endpoints (catch-up action + history retrieval). Frontend modal triggered from task detail page and task list context menu, plus a `TaskTimeline` component on the task detail page.

**Tech Stack:** Prisma (CockroachDB), Nuxt 3, Vue 3 Composition API, Vitest, date-fns, Tailwind CSS, Heroicons.

---

## Task 1: Database Schema & TypeScript Types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `types/task.ts`

### Step 1: Add TaskHistoryLog model to Prisma schema

In `prisma/schema.prisma`, add the new model after the `OccurrenceHistoryLog` model (after line 115), and add relation fields to `User` (after line 27) and `TaskDefinition` (after line 77).

New model:
```prisma
// Task History Log model
model TaskHistoryLog {
  id        String         @id @default(uuid())
  task      TaskDefinition @relation(fields: [taskId], references: [id])
  taskId    String
  user      User           @relation(fields: [userId], references: [id])
  userId    String
  logType   String         // catch_up, created, edited, paused, unpaused, soft_deleted
  details   Json?
  comment   String?
  createdAt DateTime       @default(now())

  @@map("task_history_logs")
}
```

Add to `User` model (after `historyLogs` on line 27):
```prisma
  taskHistoryLogs        TaskHistoryLog[]
```

Add to `TaskDefinition` model (after `occurrences` on line 77):
```prisma
  historyLogs       TaskHistoryLog[]
```

### Step 2: Add TypeScript types

In `types/task.ts`, add after the `OccurrenceHistoryLog` interface (after line 160):

```typescript
export type TaskHistoryLogType =
  | "catch_up"
  | "created"
  | "edited"
  | "paused"
  | "unpaused"
  | "soft_deleted";

export interface TaskHistoryLog {
  id: string;
  taskId: string;
  userId: string;
  logType: TaskHistoryLogType;
  details?: Record<string, any>;
  comment?: string;
  createdAt: Date;
  user?: User;
}
```

### Step 3: Create migration

Run: `npx prisma migrate dev --name add_task_history_log`

If no local DB available, create the migration with: `npx prisma migrate dev --name add_task_history_log --create-only`

### Step 4: Commit

```bash
git add prisma/ types/task.ts
git commit -m "feat: add TaskHistoryLog model and types for task-level audit trail"
```

---

## Task 2: Catch-Up Date Calculation (TDD)

**Files:**
- Create: `tests/unit/utils/catch-up-date.test.ts`
- Modify: `server/utils/schedule.ts`

### Step 1: Write the failing tests

Create `tests/unit/utils/catch-up-date.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startOfDay } from 'date-fns'
import { calculateCatchUpDueDate } from '@/server/utils/schedule'
import type {
  OnceScheduleConfig,
  FixedIntervalScheduleConfig,
  SpecificDaysScheduleConfig,
  SpecificDayOfMonthScheduleConfig,
  SpecificWeekdayOfMonthScheduleConfig,
  VariableIntervalScheduleConfig,
} from '@/types'

const never = { type: 'never' as const }

const daysOfWeek = (overrides: Partial<Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', boolean>> = {}) => ({
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
  ...overrides,
})

describe('calculateCatchUpDueDate', () => {
  // Fix "today" to Feb 17 2026 (Tuesday) for deterministic tests
  const fakeToday = new Date(2026, 1, 17)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fakeToday)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('once', () => {
    it('returns null — no new occurrence for one-time tasks', () => {
      const config: OnceScheduleConfig = {
        type: 'once',
        dueDate: new Date(2025, 0, 1),
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toBeNull()
    })
  })

  describe('fixed_interval', () => {
    it('walks forward preserving schedule anchor (2-week cadence)', () => {
      // Every 2 weeks, last overdue was Jan 6 2026
      // Jan 6 → Jan 20 → Feb 3 → Feb 17 (today, >= today) ✓
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 2,
        intervalUnit: 'week',
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2026, 0, 6))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 17)))
    })

    it('walks forward from far in the past (monthly)', () => {
      // Every 1 month, last overdue was Jun 15 2024
      // Walks: Jul 15, Aug 15, ... Feb 15 2026 (< today), Mar 15 2026 ✓
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2024, 5, 15))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 15)))
    })

    it('returns next interval from recent overdue (daily)', () => {
      // Every 7 days, last overdue was Feb 16 2026 (yesterday)
      // Feb 16 + 7d = Feb 23 (>= today) ✓
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 7,
        intervalUnit: 'day',
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2026, 1, 16))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 23)))
    })
  })

  describe('variable_interval', () => {
    it('returns today + interval (days)', () => {
      // 10 days after catch-up → Feb 17 + 10 = Feb 27
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 10, unit: 'day' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 27)))
    })

    it('returns today + interval (weeks)', () => {
      // 2 weeks → Feb 17 + 14 = Mar 3
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 2, unit: 'week' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2024, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 3)))
    })

    it('returns today + interval (months)', () => {
      // 1 month → Feb 17 + 1mo = Mar 17
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 1, unit: 'month' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2024, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 17)))
    })
  })

  describe('specific_days_of_week', () => {
    it('returns next matching weekday from today (Monday)', () => {
      // Today is Tuesday Feb 17. Looking for Monday.
      // Uses yesterday (Feb 16) as base → scans from Feb 17: Tue, Wed, ... Mon Feb 23 ✓
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true }),
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 23)))
    })

    it('returns today if today matches the weekday', () => {
      // Today is Tuesday. Looking for Tuesday.
      // Uses yesterday as base → scans from today → Feb 17 (Tue) ✓
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ tuesday: true }),
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 1, 17)))
    })
  })

  describe('specific_day_of_month', () => {
    it('returns next month occurrence when day has passed this month', () => {
      // Day 15, today Feb 17 → next is Mar 15
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 15)))
    })
  })

  describe('specific_weekday_of_month', () => {
    it('returns next month occurrence (first Monday)', () => {
      // Today Feb 17. First Monday of Feb was Feb 2 (past).
      // Uses yesterday as base → next month = Mar → First Monday = Mar 2 ✓
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
        endCondition: never,
      }
      const result = calculateCatchUpDueDate(config, new Date(2025, 0, 1))
      expect(result).toEqual(startOfDay(new Date(2026, 2, 2)))
    })
  })
})
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run tests/unit/utils/catch-up-date.test.ts`

Expected: FAIL — `calculateCatchUpDueDate` is not exported from `@/server/utils/schedule`.

### Step 3: Implement `calculateCatchUpDueDate`

In `server/utils/schedule.ts`, add after the closing brace of `calculateNextDueDate` (after line 227), before `checkEndCondition`:

```typescript
/**
 * Calculates the next future due date for a task catch-up.
 *
 * For fixed_interval: walks forward from lastOverdueDueDate preserving
 * the schedule anchor until finding a date >= today.
 *
 * For specific_days_of_week, specific_day_of_month, specific_weekday_of_month:
 * jumps directly to the next future occurrence using yesterday as base.
 *
 * For variable_interval: returns today + interval (catch-up acts as
 * a virtual completion).
 *
 * For once: returns null (no new occurrence).
 */
export function calculateCatchUpDueDate(
  config: ScheduleConfig,
  lastOverdueDueDate: Date
): Date | null {
  if (config.type === "once") {
    return null;
  }

  const today = startOfDay(new Date());

  if (config.type === "variable_interval") {
    // Variable interval: next due date is today + interval
    return calculateNextDueDate(config, today);
  }

  // For day-of-week and day/weekday-of-month schedules, jump directly
  // to the next future occurrence. These schedules don't have a fixed
  // cadence that needs preserving — they find the "next matching slot."
  // Pass yesterday so scanning starts from today.
  if (
    config.type === "specific_days_of_week" ||
    config.type === "specific_day_of_month" ||
    config.type === "specific_weekday_of_month"
  ) {
    const yesterday = addDays(today, -1);
    return calculateNextDueDate(config, yesterday);
  }

  // For fixed_interval: walk forward from the last overdue due date
  // to preserve the schedule anchor (e.g., "every 2 weeks" stays
  // on the same cadence as the original schedule).
  let current = startOfDay(lastOverdueDueDate);
  for (let i = 0; i < 1000; i++) {
    const next = calculateNextDueDate(config, current);
    if (!next) return null;
    if (next >= today) return next;
    current = next;
  }

  return null;
}
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run tests/unit/utils/catch-up-date.test.ts`

Expected: All tests PASS.

### Step 5: Commit

```bash
git add server/utils/schedule.ts tests/unit/utils/catch-up-date.test.ts
git commit -m "feat: add calculateCatchUpDueDate utility with tests"
```

---

## Task 3: TaskService.catchUp Method (TDD)

**Files:**
- Create: `tests/unit/services/task-catch-up.test.ts`
- Modify: `server/services/TaskService.ts`

### Step 1: Write the failing tests

Create `tests/unit/services/task-catch-up.test.ts`.

This test uses the Prisma mock from `tests/setup.ts`. Key things to mock:
- `prisma.taskOccurrence.findMany` — returns overdue occurrences
- `prisma.taskOccurrence.findFirst` — checks for existing future occurrence
- `prisma.$transaction` — runs the catch-up transaction (the mock in setup.ts passes the mock itself)
- `prisma.taskOccurrence.update` — marks occurrences as skipped
- `prisma.occurrenceHistoryLog.create` — logs occurrence history
- `prisma.taskHistoryLog.create` — logs task history (NEW — add to setup.ts mock)
- `prisma.taskOccurrence.create` — creates new occurrence
- `prisma.taskOccurrence.count` — for end condition checks
- `prisma.taskDefinition.findUnique` — for finding the task

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskService } from '@/server/services/TaskService'
import prisma from '@/server/utils/prisma/client'
import type { FixedIntervalScheduleConfig, VariableIntervalScheduleConfig, OnceScheduleConfig } from '@/types'

const never = { type: 'never' as const }

const mockTask = (scheduleConfig: any) => ({
  id: 'task-1',
  householdId: 'household-1',
  name: 'Test Task',
  categoryId: 'cat-1',
  metaStatus: 'active',
  scheduleConfig,
  createdByUserId: 'user-1',
  defaultAssigneeIds: ['user-1'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  category: { id: 'cat-1', name: 'Test', isDefault: false, householdId: 'household-1', createdAt: new Date(), updatedAt: new Date() },
})

const mockOverdueOccurrence = (id: string, dueDate: Date) => ({
  id,
  taskId: 'task-1',
  dueDate,
  status: 'assigned',
  assigneeIds: ['user-1'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

describe('TaskService.catchUp', () => {
  let taskService: TaskService

  beforeEach(() => {
    vi.clearAllMocks()
    taskService = new TaskService()

    // Fix time for deterministic date calculations
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 17)) // Feb 17 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('skips all overdue occurrences and creates new future occurrence', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 2,
      intervalUnit: 'week',
      endCondition: never,
    }
    const task = mockTask(config)

    // Mock: find the task
    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(task as any)

    // Mock: find overdue occurrences
    const overdueOccs = [
      mockOverdueOccurrence('occ-1', new Date(2026, 0, 6)),
      mockOverdueOccurrence('occ-2', new Date(2026, 0, 20)),
      mockOverdueOccurrence('occ-3', new Date(2026, 1, 3)),
    ]
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue(overdueOccs as any)

    // Mock: no existing future occurrence
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)

    // Mock: update returns the occurrence (for each skip)
    vi.mocked(prisma.taskOccurrence.update).mockImplementation(async (args: any) => {
      return { ...overdueOccs[0], ...args.data } as any
    })

    // Mock: history log creation
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)

    // Mock: task history log creation (NEW mock needed)
    vi.mocked((prisma as any).taskHistoryLog?.create || vi.fn()).mockResolvedValue({} as any)

    // Mock: create new occurrence
    vi.mocked(prisma.taskOccurrence.create).mockResolvedValue({
      id: 'occ-new',
      taskId: 'task-1',
      dueDate: new Date(2026, 1, 17),
      status: 'assigned',
      assigneeIds: ['user-1'],
    } as any)

    // Mock: occurrence count for end condition
    vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(3)

    const result = await taskService.catchUp('task-1', 'user-1')

    expect(result.occurrencesSkipped).toBe(3)
    expect(result.newDueDate).toBeTruthy()

    // Verify all overdue occurrences were updated to skipped
    expect(prisma.taskOccurrence.update).toHaveBeenCalledTimes(3)

    // Verify history logs were created for each skipped occurrence
    expect(prisma.occurrenceHistoryLog.create).toHaveBeenCalledTimes(3)
  })

  it('returns 0 skipped when no overdue occurrences exist', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: never,
    }

    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([])

    await expect(taskService.catchUp('task-1', 'user-1'))
      .rejects.toThrow()
  })

  it('does not create new occurrence if future one already exists', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: never,
    }

    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)

    const overdueOccs = [mockOverdueOccurrence('occ-1', new Date(2026, 0, 1))]
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue(overdueOccs as any)

    // Mock: future occurrence already exists
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue({
      id: 'occ-future',
      dueDate: new Date(2026, 2, 1),
      status: 'assigned',
    } as any)

    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)

    const result = await taskService.catchUp('task-1', 'user-1')

    expect(result.occurrencesSkipped).toBe(1)
    // Should NOT create a new occurrence
    expect(prisma.taskOccurrence.create).not.toHaveBeenCalled()
  })

  it('returns null newDueDate for once-type tasks', async () => {
    const config: OnceScheduleConfig = {
      type: 'once',
      dueDate: new Date(2025, 0, 1),
      endCondition: never,
    }

    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)

    const overdueOccs = [mockOverdueOccurrence('occ-1', new Date(2025, 0, 1))]
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue(overdueOccs as any)
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)

    const result = await taskService.catchUp('task-1', 'user-1')

    expect(result.occurrencesSkipped).toBe(1)
    expect(result.newDueDate).toBeNull()
  })

  it('stores optional user comment in task history log', async () => {
    const config: FixedIntervalScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: never,
    }

    vi.mocked(prisma.taskDefinition.findUnique).mockResolvedValue(mockTask(config) as any)
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValue([
      mockOverdueOccurrence('occ-1', new Date(2026, 0, 1)),
    ] as any)
    vi.mocked(prisma.taskOccurrence.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.taskOccurrence.update).mockResolvedValue({} as any)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.taskOccurrence.create).mockResolvedValue({} as any)
    vi.mocked(prisma.taskOccurrence.count).mockResolvedValue(1)

    await taskService.catchUp('task-1', 'user-1', 'Was on vacation')

    // Verify task history log was created with the comment
    // The $transaction mock passes prisma itself as tx, so taskHistoryLog.create
    // should have been called with the comment
    const historyLogCalls = vi.mocked((prisma as any).taskHistoryLog.create).mock.calls
    expect(historyLogCalls.length).toBeGreaterThan(0)
    expect(historyLogCalls[0][0].data.comment).toBe('Was on vacation')
    expect(historyLogCalls[0][0].data.logType).toBe('catch_up')
  })
})
```

**Important**: Before running, add `taskHistoryLog` to the Prisma mock in `tests/setup.ts`:

In `tests/setup.ts`, add to the `prismaMock` object (after `occurrenceHistoryLog`):

```typescript
  taskHistoryLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run tests/unit/services/task-catch-up.test.ts`

Expected: FAIL — `taskService.catchUp is not a function`.

### Step 3: Implement `TaskService.catchUp`

In `server/services/TaskService.ts`, add the import for `calculateCatchUpDueDate` at the top (line 1 area):

```typescript
import { calculateCatchUpDueDate } from "@/server/utils/schedule";
```

Add after the `afterEach` import, alongside existing imports from `@/types` (around line 6-8), add `OccurrenceStatus` to the type imports:

```typescript
import type {
  TaskDefinition,
  Category,
  ScheduleConfig,
  ReminderConfig,
  TaskMetaStatus,
  OccurrenceStatus,
} from "@/types";
```

Add the `catchUp` method to the `TaskService` class (before the closing brace, after `softDelete` around line 513):

```typescript
  /**
   * Catch up a task by skipping all overdue occurrences and creating the next future occurrence.
   */
  async catchUp(
    id: string,
    userId: string,
    comment?: string
  ): Promise<{ occurrencesSkipped: number; newDueDate: Date | null }> {
    try {
      // Find the task
      const task = await prisma.taskDefinition.findUnique({
        where: { id },
        include: { category: true },
      });

      if (!task) {
        throw new Error("Task not found");
      }

      const scheduleConfig = task.scheduleConfig as unknown as ScheduleConfig;
      const now = new Date();

      // Find all overdue occurrences (created/assigned, due before now)
      const overdueOccurrences = await prisma.taskOccurrence.findMany({
        where: {
          taskId: id,
          status: { in: ["created", "assigned"] },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: "asc" },
      });

      if (overdueOccurrences.length === 0) {
        throw new Error("No overdue occurrences to catch up");
      }

      // Skip all overdue occurrences within a transaction
      await prisma.$transaction(async (tx) => {
        for (const occ of overdueOccurrences) {
          await tx.taskOccurrence.update({
            where: { id: occ.id },
            data: {
              status: "skipped",
              skippedAt: now,
              updatedAt: now,
            },
          });

          await tx.occurrenceHistoryLog.create({
            data: {
              occurrenceId: occ.id,
              userId,
              logType: "status_change",
              oldValue: occ.status,
              newValue: "skipped",
              comment: "Skipped during catch-up",
            },
          });
        }

        // Calculate the next future due date
        const lastOverdueDueDate = overdueOccurrences[overdueOccurrences.length - 1].dueDate;
        const newDueDate = calculateCatchUpDueDate(scheduleConfig, lastOverdueDueDate);

        // Check if a future occurrence already exists
        const existingFuture = await tx.taskOccurrence.findFirst({
          where: {
            taskId: id,
            status: { in: ["created", "assigned"] },
            dueDate: { gte: now },
          },
        });

        let actualNewDueDate = newDueDate;

        // Create new occurrence if needed
        if (newDueDate && !existingFuture) {
          const initialAssignees = task.defaultAssigneeIds || [];
          const initialStatus: string = initialAssignees.length > 0 ? "assigned" : "created";

          await tx.taskOccurrence.create({
            data: {
              taskId: id,
              dueDate: newDueDate,
              status: initialStatus,
              assigneeIds: initialAssignees,
            },
          });
        } else if (existingFuture) {
          actualNewDueDate = existingFuture.dueDate;
        }

        // Log the catch-up event in task history
        await tx.taskHistoryLog.create({
          data: {
            taskId: id,
            userId,
            logType: "catch_up",
            details: {
              occurrencesSkipped: overdueOccurrences.length,
              newDueDate: actualNewDueDate?.toISOString() ?? null,
              previousDueDate: lastOverdueDueDate.toISOString(),
            },
            comment: comment || null,
          },
        });

        return { newDueDate: actualNewDueDate };
      });

      // Re-calculate for the return value (transaction doesn't return cleanly with our mock)
      const lastOverdueDueDate = overdueOccurrences[overdueOccurrences.length - 1].dueDate;
      const newDueDate = calculateCatchUpDueDate(scheduleConfig, lastOverdueDueDate);

      // Check if future occurrence exists
      const existingFuture = await prisma.taskOccurrence.findFirst({
        where: {
          taskId: id,
          status: { in: ["created", "assigned"] },
          dueDate: { gte: now },
        },
      });

      return {
        occurrencesSkipped: overdueOccurrences.length,
        newDueDate: existingFuture ? existingFuture.dueDate : newDueDate,
      };
    } catch (error) {
      console.error(`[TaskService] Unexpected error in catchUp:`, error);
      throw error;
    }
  }
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run tests/unit/services/task-catch-up.test.ts`

Expected: All tests PASS. Some tests may need mock adjustments — fix as needed.

### Step 5: Run full test suite

Run: `npx vitest run`

Expected: All existing tests still pass. No regressions.

### Step 6: Commit

```bash
git add server/services/TaskService.ts tests/unit/services/task-catch-up.test.ts tests/setup.ts
git commit -m "feat: add TaskService.catchUp method with tests"
```

---

## Task 4: API Endpoints

**Files:**
- Create: `server/api/tasks/[id]/catch-up.post.ts`
- Create: `server/api/tasks/[id]/history.get.ts`

### Step 1: Create catch-up endpoint

Create `server/api/tasks/[id]/catch-up.post.ts`:

```typescript
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import { createError, readBody } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const taskId = event.context.params?.id;

      if (!taskId) {
        throw createError({
          statusCode: 400,
          message: "Task ID is required",
        });
      }

      const taskService = new TaskService();

      // Verify task exists and belongs to user's household
      const existingTask = await taskService.findById(taskId);

      if (!existingTask) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }

      if (existingTask.householdId !== householdId) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to catch up this task",
        });
      }

      // Read optional comment from body
      const body = await readBody(event).catch(() => ({}));
      const comment = body?.comment as string | undefined;

      // Perform catch-up
      const result = await taskService.catchUp(taskId, authUser.userId, comment);

      return result;
    } catch (error) {
      console.error("[API] Error catching up task:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      // Map known service errors to HTTP errors
      if ((error as Error).message === "No overdue occurrences to catch up") {
        throw createError({
          statusCode: 400,
          message: "No overdue occurrences to catch up",
        });
      }

      throw createError({
        statusCode: 500,
        message: "Server error catching up task",
        cause: error,
      });
    }
  }
);
```

### Step 2: Create history endpoint

Create `server/api/tasks/[id]/history.get.ts`:

```typescript
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import prisma from "@/server/utils/prisma/client";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const taskId = event.context.params?.id;

      if (!taskId) {
        throw createError({
          statusCode: 400,
          message: "Task ID is required",
        });
      }

      const taskService = new TaskService();

      // Verify task exists and belongs to user's household
      const existingTask = await taskService.findById(taskId);

      if (!existingTask) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }

      if (existingTask.householdId !== householdId) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to view this task's history",
        });
      }

      const historyLogs = await prisma.taskHistoryLog.findMany({
        where: { taskId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return historyLogs;
    } catch (error) {
      console.error("[API] Error fetching task history:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching task history",
        cause: error,
      });
    }
  }
);
```

### Step 3: Commit

```bash
git add server/api/tasks/\[id\]/catch-up.post.ts server/api/tasks/\[id\]/history.get.ts
git commit -m "feat: add catch-up and history API endpoints"
```

---

## Task 5: TaskTimeline Component

**Files:**
- Create: `components/tasks/TaskTimeline.vue`
- Modify: `pages/tasks/[id]/index.vue`

### Step 1: Create TaskTimeline component

Create `components/tasks/TaskTimeline.vue`, modeled after `components/occurrences/OccurrenceTimeline.vue`:

```vue
<template>
  <div class="mt-6 flow-root">
    <h3 class="font-heading text-lg font-medium text-stone-900 mb-4">Task Activity</h3>
    <div v-if="loading" class="text-center text-stone-500 py-4">Loading history...</div>
    <div v-else-if="error" class="text-center text-red-600 py-4">
      Error loading history: {{ error }}
    </div>
    <ul v-else-if="historyLogs.length > 0" role="list" class="-mb-8">
      <li v-for="(log, logIdx) in historyLogs" :key="log.id">
        <div class="relative pb-8">
          <span v-if="logIdx !== historyLogs.length - 1"
            class="absolute left-4 top-4 -ml-px h-full w-0.5 bg-stone-200" aria-hidden="true"></span>
          <div class="relative flex space-x-3">
            <div>
              <span
                :class="[getIconBackground(log.logType), 'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white']">
                <component :is="getIcon(log.logType)" class="h-5 w-5 text-white" aria-hidden="true" />
              </span>
            </div>
            <div class="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
              <div>
                <p class="text-sm text-stone-500">
                  {{ formatLogMessage(log) }}
                  <span class="font-medium text-stone-900">{{ log.user?.name || 'System' }}</span>
                </p>
                <p v-if="log.comment" class="mt-1 text-sm text-stone-700 italic">
                  "{{ log.comment }}"
                </p>
              </div>
              <div class="whitespace-nowrap text-right text-sm text-stone-500">
                <time :datetime="log.createdAt.toISOString()">{{ formatRelativeTime(log.createdAt) }}</time>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ul>
    <div v-else class="text-center text-stone-500 py-4">No task activity yet.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useApi } from '@/utils/api';
import type { TaskHistoryLog } from '@/types';
import { formatDistanceToNow } from 'date-fns';

// @ts-ignore
import {
  ArrowPathIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  PencilIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@heroicons/vue/24/solid';

const props = defineProps<{
  taskId: string;
}>();

const historyLogs = ref<TaskHistoryLog[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const api = useApi();

const fetchHistory = async () => {
  if (!props.taskId) {
    historyLogs.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const data = await api.get<TaskHistoryLog[]>(`/api/tasks/${props.taskId}/history`);
    historyLogs.value = data.map(log => ({
      ...log,
      createdAt: new Date(log.createdAt),
    }));
  } catch (err: any) {
    console.error("Error fetching task history:", err);
    error.value = err.data?.message || err.message || 'Failed to load history';
    historyLogs.value = [];
  } finally {
    loading.value = false;
  }
};

watch(() => props.taskId, fetchHistory, { immediate: true });

defineExpose({ fetchHistory });

const formatRelativeTime = (date: Date): string => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Invalid date';
  return formatDistanceToNow(date, { addSuffix: true });
};

const getIcon = (logType: string) => {
  switch (logType) {
    case 'catch_up': return ArrowPathIcon;
    case 'paused': return PauseCircleIcon;
    case 'unpaused': return PlayCircleIcon;
    case 'edited': return PencilIcon;
    case 'created': return PlusCircleIcon;
    case 'soft_deleted': return TrashIcon;
    default: return PencilIcon;
  }
};

const getIconBackground = (logType: string) => {
  switch (logType) {
    case 'catch_up': return 'bg-amber-600';
    case 'paused': return 'bg-yellow-500';
    case 'unpaused': return 'bg-green-500';
    case 'created': return 'bg-blue-500';
    case 'soft_deleted': return 'bg-red-500';
    default: return 'bg-stone-400';
  }
};

const formatLogMessage = (log: TaskHistoryLog): string => {
  switch (log.logType) {
    case 'catch_up': {
      const details = log.details as any;
      const skipped = details?.occurrencesSkipped ?? 0;
      const newDate = details?.newDueDate
        ? new Date(details.newDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'none';
      return `Caught up \u2014 ${skipped} occurrence${skipped !== 1 ? 's' : ''} skipped. Next due: ${newDate}. By `;
    }
    case 'paused': return 'Paused task. By ';
    case 'unpaused': return 'Unpaused task. By ';
    case 'created': return 'Created task. By ';
    case 'edited': return 'Edited task. By ';
    case 'soft_deleted': return 'Deleted task. By ';
    default: return 'Updated task. By ';
  }
};
</script>
```

### Step 2: Add TaskTimeline to task detail page

In `pages/tasks/[id]/index.vue`, add the TaskTimeline component.

After the closing `</div>` of the occurrences section (after line 132), before the "Back to Tasks List" link (line 134), add:

```vue
      <!-- Task Activity Timeline -->
      <TaskTimeline ref="taskTimelineRef" :task-id="taskId" />
```

In the `<script setup>` section, add the ref (around line 170):

```typescript
const taskTimelineRef = ref<InstanceType<typeof TaskTimeline> | null>(null);
```

And import `TaskTimeline` isn't needed since Nuxt auto-imports components.

### Step 3: Commit

```bash
git add components/tasks/TaskTimeline.vue pages/tasks/\[id\]/index.vue
git commit -m "feat: add TaskTimeline component to task detail page"
```

---

## Task 6: Catch-Up Modal & UI Entry Points

**Files:**
- Create: `components/tasks/CatchUpModal.vue`
- Modify: `pages/tasks/[id]/index.vue` (add Catch Up button)
- Modify: `pages/tasks/index.vue` (add Catch Up to context menu)

### Step 1: Create the CatchUpModal component

Create `components/tasks/CatchUpModal.vue`:

```vue
<template>
  <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity" @click="cancel"></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 sm:mx-0 sm:h-10 sm:w-10">
              <ArrowPathIcon class="h-6 w-6 text-amber-600" />
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 class="text-lg leading-6 font-medium text-stone-900" id="modal-title">
                Catch Up — {{ taskName }}
              </h3>
              <div class="mt-2">
                <p class="text-sm text-stone-500">
                  This task has <span class="font-semibold text-stone-700">{{ overdueCount }} overdue occurrence{{ overdueCount !== 1 ? 's' : '' }}</span>.
                  They will be marked as skipped and the next due date will be set to
                  <span class="font-semibold text-stone-700">{{ formattedPreviewDate }}</span>.
                </p>
              </div>
              <div class="mt-4">
                <label for="catch-up-comment" class="block text-sm font-medium text-stone-700">
                  Add a reason (optional)
                </label>
                <textarea
                  id="catch-up-comment"
                  v-model="comment"
                  rows="2"
                  class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
                  placeholder="e.g., Was on vacation"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-stone-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            :disabled="submitting"
            @click="confirm"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-amber-600 text-base font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
          >
            {{ submitting ? 'Catching up...' : 'Catch Up' }}
          </button>
          <button
            type="button"
            :disabled="submitting"
            @click="cancel"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-stone-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
// @ts-ignore
import { ArrowPathIcon } from '@heroicons/vue/24/solid';

const props = defineProps<{
  visible: boolean;
  taskName: string;
  overdueCount: number;
  previewDate: Date | string | null;
}>();

const emit = defineEmits<{
  (e: 'confirm', comment: string): void;
  (e: 'cancel'): void;
}>();

const comment = ref('');
const submitting = ref(false);

const formattedPreviewDate = computed(() => {
  if (!props.previewDate) return 'none (one-time task)';
  const d = new Date(props.previewDate);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
});

const confirm = async () => {
  submitting.value = true;
  emit('confirm', comment.value);
};

const cancel = () => {
  comment.value = '';
  emit('cancel');
};

defineExpose({
  reset: () => {
    comment.value = '';
    submitting.value = false;
  },
});
</script>
```

### Step 2: Add Catch Up button to task detail page

In `pages/tasks/[id]/index.vue`, add a "Catch Up" button next to the existing action buttons.

In the template, in the button group (around line 23-39), add before the Edit link:

```vue
          <button v-if="hasOverdueOccurrences" @click="showCatchUpModal = true"
            class="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700">
            Catch Up
          </button>
```

Add the modal at the end of the template (before the closing `</div>` for v-else, around line 140):

```vue
      <!-- Catch Up Modal -->
      <CatchUpModal
        ref="catchUpModalRef"
        :visible="showCatchUpModal"
        :task-name="task.name"
        :overdue-count="overdueOccurrenceCount"
        :preview-date="catchUpPreviewDate"
        @confirm="handleCatchUp"
        @cancel="showCatchUpModal = false"
      />
```

In the `<script setup>`, add the state and methods:

```typescript
// Catch-up state
const showCatchUpModal = ref(false);
const catchUpModalRef = ref<any>(null);

const hasOverdueOccurrences = computed(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return occurrences.value.some(occ => {
    const dueDate = new Date(occ.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return (occ.status === 'created' || occ.status === 'assigned') && dueDate < now;
  });
});

const overdueOccurrenceCount = computed(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return occurrences.value.filter(occ => {
    const dueDate = new Date(occ.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return (occ.status === 'created' || occ.status === 'assigned') && dueDate < now;
  }).length;
});

const catchUpPreviewDate = computed(() => {
  // This is a rough preview. The server calculates the actual date.
  // For display purposes, show "calculating..." or use a simple heuristic.
  return null; // The modal will show "calculating..." — the server determines the exact date
});

const handleCatchUp = async (comment: string) => {
  try {
    const result = await api.post<{ occurrencesSkipped: number; newDueDate: string | null }>(
      `/api/tasks/${taskId}/catch-up`,
      { comment: comment || undefined }
    );

    showCatchUpModal.value = false;
    catchUpModalRef.value?.reset();

    // Refresh data
    await Promise.all([
      taskStore.fetchTaskById(taskId),
      fetchOccurrences(),
    ]);

    // Refresh task timeline
    taskTimelineRef.value?.fetchHistory();

    alert(`Caught up — ${result.occurrencesSkipped} occurrence${result.occurrencesSkipped !== 1 ? 's' : ''} skipped.${result.newDueDate ? ' Next due: ' + new Date(result.newDueDate).toLocaleDateString() : ''}`);
  } catch (err: any) {
    console.error('Error catching up task:', err);
    alert(err.data?.message || 'Failed to catch up task');
    catchUpModalRef.value?.reset();
  }
};
```

### Step 3: Add Catch Up to task list context menu

In `pages/tasks/index.vue`, add a "Catch Up" item to the dropdown menu.

In the template, inside the dropdown `<div class="py-1">` (around line 154-210), add after the "View Occurrences" link (after line 173) and before the "Pause Task" button (line 175):

```vue
                    <button
                      v-if="task.metaStatus === 'active' && isTaskOverdue(task)"
                      @click="openCatchUp(task)"
                      class="group flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <svg class="mr-3 h-4 w-4 text-stone-400 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Catch Up
                    </button>
```

Add the CatchUpModal at the end of the template (before closing `</div>` of the root element, around line 218):

```vue
    <!-- Catch Up Modal -->
    <CatchUpModal
      ref="catchUpModalRef"
      :visible="showCatchUpModal"
      :task-name="catchUpTask?.name || ''"
      :overdue-count="catchUpOverdueCount"
      :preview-date="null"
      @confirm="handleCatchUp"
      @cancel="closeCatchUpModal"
    />
```

In the `<script setup>`, add:

```typescript
// Catch-up state
const showCatchUpModal = ref(false);
const catchUpTask = ref<TaskDefinition | null>(null);
const catchUpModalRef = ref<any>(null);
const catchUpOverdueCount = ref(0);

const isTaskOverdue = (task: TaskDefinition): boolean => {
  if (!task.nextOccurrence) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.nextOccurrence.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

const openCatchUp = async (task: TaskDefinition) => {
  closeDropdown();
  catchUpTask.value = task;
  // We don't know exact overdue count from the list view — the nextOccurrence
  // tells us the task IS overdue, but not how many. Set count to 0 and let
  // the modal show a generic message, or fetch the count.
  try {
    const occurrences = await api.get<any[]>(`/api/tasks/${task.id}/occurrences`);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    catchUpOverdueCount.value = occurrences.filter((occ: any) => {
      const dueDate = new Date(occ.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return (occ.status === 'created' || occ.status === 'assigned') && dueDate < now;
    }).length;
  } catch {
    catchUpOverdueCount.value = 0;
  }
  showCatchUpModal.value = true;
};

const closeCatchUpModal = () => {
  showCatchUpModal.value = false;
  catchUpTask.value = null;
  catchUpModalRef.value?.reset();
};

const handleCatchUp = async (comment: string) => {
  if (!catchUpTask.value) return;
  try {
    const result = await api.post<{ occurrencesSkipped: number; newDueDate: string | null }>(
      `/api/tasks/${catchUpTask.value.id}/catch-up`,
      { comment: comment || undefined }
    );

    closeCatchUpModal();
    await taskStore.fetchTasks(filters);

    alert(`Caught up — ${result.occurrencesSkipped} occurrence${result.occurrencesSkipped !== 1 ? 's' : ''} skipped.${result.newDueDate ? ' Next due: ' + new Date(result.newDueDate).toLocaleDateString() : ''}`);
  } catch (err: any) {
    console.error('Error catching up task:', err);
    alert(err.data?.message || 'Failed to catch up task');
    catchUpModalRef.value?.reset();
  }
};
```

### Step 4: Commit

```bash
git add components/tasks/CatchUpModal.vue pages/tasks/\[id\]/index.vue pages/tasks/index.vue
git commit -m "feat: add catch-up modal and UI entry points on task detail and list pages"
```

---

## Task 7: Run Full Test Suite & Final Verification

### Step 1: Run all tests

```bash
npx vitest run
```

Expected: All tests pass, including new catch-up tests.

### Step 2: Manual smoke test (if dev server available)

1. Start dev server: `npm run dev`
2. Navigate to a task with overdue occurrences
3. Verify "Catch Up" button appears
4. Click it, verify modal shows correct count
5. Add optional comment, click "Catch Up"
6. Verify occurrences are skipped, new occurrence created
7. Verify TaskTimeline shows the catch-up event
8. Test from task list context menu as well

### Step 3: Final commit if any fixes needed

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
