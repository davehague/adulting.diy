# End Condition Test Coverage & Data Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fill test coverage gaps for date end conditions across all schedule types and lifecycle operations, plus backfill 17 legacy tasks missing `endCondition` in their `scheduleConfig` JSON.

**Architecture:** Two workstreams: (1) New unit tests in existing test files following established patterns, (2) A one-shot database migration script to patch legacy JSON data in-place.

**Tech Stack:** Vitest, Prisma (CockroachDB), existing test helpers (`localDate`, `makeTask`, `makeOccurrence`, mock patterns)

---

### Task 1: Add date end condition tests for `generateFutureOccurrences` across all schedule types

**Files:**
- Modify: `tests/unit/utils/schedule.test.ts` (insert after line 696, inside the existing `end conditions in generation loop` describe block)

**Step 1: Write the failing tests**

Add these tests inside the `describe('end conditions in generation loop', ...)` block, after the existing "stops at date end condition" test:

```typescript
    it('stops at date end condition for specific_days_of_week', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true, wednesday: true, friday: true }),
        endCondition: { type: 'date', date: localDate(2024, 1, 10) },
      }
      // Sun Dec 31 2023 → Mon Jan 1, Wed Jan 3, Fri Jan 5, Mon Jan 8
      // Wed Jan 10 is ON the end date → stops
      const lastCompleted = localDate(2023, 12, 31)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 1, Jan 3, Jan 5, Jan 8 — Jan 10 is on end date so excluded
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 1)))
      expect(result[3]).toEqual(startOfDay(localDate(2024, 1, 8)))
    })

    it('stops at date end condition for specific_day_of_month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: { type: 'date', date: localDate(2024, 4, 15) },
      }
      const lastCompleted = localDate(2024, 1, 10)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15, Mar 15 — Apr 15 is ON the end date so excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 15)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 15)))
    })

    it('stops at date end condition for specific_weekday_of_month', () => {
      const config: SpecificWeekdayOfMonthScheduleConfig = {
        type: 'specific_weekday_of_month',
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' },
        endCondition: { type: 'date', date: localDate(2024, 4, 1) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // First Monday of: Feb = Feb 5, Mar = Mar 4
      // First Monday of Apr = Apr 1 which is ON the end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 5)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 4)))
    })

    it('stops at date end condition for variable_interval', () => {
      const config: VariableIntervalScheduleConfig = {
        type: 'variable_interval',
        variableInterval: { interval: 10, unit: 'day' },
        endCondition: { type: 'date', date: localDate(2024, 1, 25) },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jan 11, Jan 21 — Jan 31 is after end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 1, 11)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 1, 21)))
    })

    it('stops at date end condition for annual_fixed', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 4,
        dayOfMonth: 29,
        endCondition: { type: 'date', date: localDate(2026, 4, 29) },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2027, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Apr 29 2024, Apr 29 2025 — Apr 29 2026 is ON end date → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 4, 29)))
      expect(result[1]).toEqual(startOfDay(localDate(2025, 4, 29)))
    })

    it('stops at date end condition for annual_variable', () => {
      const config: AnnualVariableScheduleConfig = {
        type: 'annual_variable',
        month: 4,
        dayOfMonth: 29,
        endCondition: { type: 'date', date: localDate(2026, 8, 10) },
      }
      const lastCompleted = localDate(2024, 8, 10)
      const horizon = localDate(2027, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Aug 10 2025 — Aug 10 2026 is ON end date → excluded
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(startOfDay(localDate(2025, 8, 10)))
    })
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- tests/unit/utils/schedule.test.ts`
Expected: All new tests PASS (the generation logic already handles date end conditions correctly via `checkEndCondition`)

**Step 3: Commit**

```bash
git add tests/unit/utils/schedule.test.ts
git commit -m "test: add date end condition tests for all schedule types in generation loop"
```

---

### Task 2: Add date end condition tests for `checkEndCondition` edge cases

**Files:**
- Modify: `tests/unit/utils/schedule.test.ts` (insert after line 500, at the end of the `date end condition` describe block inside `checkEndCondition`)

**Step 1: Write the tests**

Add these tests inside the `describe('date end condition', ...)` block:

```typescript
    it('returns false when no nextDueDate provided and current date is before end date', () => {
      const futureConfig: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'date', date: localDate(2099, 12, 31) },
      }
      // No nextDueDate → falls back to checking current date vs end date
      expect(checkEndCondition(futureConfig, 1)).toBe(false)
    })

    it('returns false when endCondition date is invalid', () => {
      const invalidConfig: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'date', date: new Date('invalid') },
      }
      expect(checkEndCondition(invalidConfig, 1, localDate(2024, 3, 1))).toBe(false)
    })

    it('returns false when endCondition date is missing', () => {
      const missingDateConfig: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'week',
        endCondition: { type: 'date' } as any,
      }
      expect(checkEndCondition(missingDateConfig, 1, localDate(2024, 3, 1))).toBe(false)
    })
```

**Step 2: Run tests**

Run: `npm test -- tests/unit/utils/schedule.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/unit/utils/schedule.test.ts
git commit -m "test: add checkEndCondition edge case tests for date type"
```

---

### Task 3: Add date end condition tests for lifecycle operations (execute and skip)

**Files:**
- Modify: `tests/unit/logic/task-occurrence-lifecycle.test.ts` (insert after line 817, in the `End conditions prevent next occurrence` describe block)

**Step 1: Write the tests**

Add these tests inside the `describe('End conditions prevent next occurrence', ...)` block:

```typescript
  it('does not generate next when date end condition is reached on execute', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'date', date: localDate(2024, 1, 20) },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate: localDate(2024, 1, 15) })
    const occWithTask = { ...occ, task, completedAt: new Date(), dueDate: occ.dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // Next due date would be Jan 22 which is after end date Jan 20 → no new occurrence
    const createCalls = db.taskOccurrence.create.mock.calls
    expect(createCalls.length).toBe(0)
  })

  it('does not generate next when date end condition is reached on skip', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'date', date: localDate(2024, 1, 20) },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate: localDate(2024, 1, 15) })
    const skippedOcc = { ...occ, task, skippedAt: new Date(), dueDate: occ.dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(skippedOcc)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)

    await occurrenceService.skip(OCCURRENCE_ID, USER_ID, 'End date reached')

    // Next due date would be Jan 22 which is after end date Jan 20 → no new occurrence
    const createCalls = db.taskOccurrence.create.mock.calls
    expect(createCalls.length).toBe(0)
  })

  it('generates next when date end condition is NOT yet reached on execute', async () => {
    const config: ScheduleConfig = {
      type: 'fixed_interval',
      interval: 1,
      intervalUnit: 'week',
      endCondition: { type: 'date', date: localDate(2024, 6, 1) },
    }
    const task = makeTask({ scheduleConfig: config })
    const occ = makeOccurrence({ dueDate: localDate(2024, 1, 15) })
    const occWithTask = { ...occ, task, completedAt: new Date(), dueDate: occ.dueDate }

    db.taskOccurrence.findUnique.mockResolvedValue(occ)
    db.taskOccurrence.update.mockResolvedValue(occWithTask)
    db.occurrenceHistoryLog.create.mockResolvedValue({})
    db.taskOccurrence.count.mockResolvedValue(1)
    db.taskOccurrence.findFirst.mockResolvedValue(null)
    db.taskOccurrence.create.mockResolvedValue(makeOccurrence({ id: 'occ-2' }))

    await occurrenceService.execute(OCCURRENCE_ID, USER_ID)

    // Next due date Jan 22 is well before end date Jun 1 → occurrence created
    expect(db.taskOccurrence.create).toHaveBeenCalled()
  })
```

**Step 2: Run tests**

Run: `npm test -- tests/unit/logic/task-occurrence-lifecycle.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/unit/logic/task-occurrence-lifecycle.test.ts
git commit -m "test: add date end condition tests for execute and skip lifecycle operations"
```

---

### Task 4: Add times end condition tests for `generateFutureOccurrences` with non-fixed-interval schedule types

**Files:**
- Modify: `tests/unit/utils/schedule.test.ts` (insert at the end of the `end conditions in generation loop` describe block)

**Step 1: Write the tests**

```typescript
    it('stops at times limit for specific_days_of_week', () => {
      const config: SpecificDaysScheduleConfig = {
        type: 'specific_days_of_week',
        daysOfWeek: daysOfWeek({ monday: true, friday: true }),
        endCondition: { type: 'times', times: 3 },
      }
      const lastCompleted = localDate(2023, 12, 31)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Mon Jan 1, Fri Jan 5 — count=3 on next iteration triggers stop
      expect(result).toHaveLength(2)
    })

    it('stops at times limit for specific_day_of_month', () => {
      const config: SpecificDayOfMonthScheduleConfig = {
        type: 'specific_day_of_month',
        dayOfMonth: 15,
        endCondition: { type: 'times', times: 4 },
      }
      const lastCompleted = localDate(2024, 1, 10)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15, Mar 15, Apr 15 — count=4 on next triggers stop
      expect(result).toHaveLength(3)
    })

    it('stops at times limit for annual_fixed', () => {
      const config: AnnualFixedScheduleConfig = {
        type: 'annual_fixed',
        month: 7,
        dayOfMonth: 4,
        endCondition: { type: 'times', times: 3 },
      }
      const lastCompleted = localDate(2024, 1, 1)
      const horizon = localDate(2030, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Jul 4 2024, Jul 4 2025 — count=3 on next triggers stop
      expect(result).toHaveLength(2)
    })
```

**Step 2: Run tests**

Run: `npm test -- tests/unit/utils/schedule.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/unit/utils/schedule.test.ts
git commit -m "test: add times end condition tests for non-fixed-interval schedule types"
```

---

### Task 5: Add generation loop test for date end condition where end date falls between occurrences

**Files:**
- Modify: `tests/unit/utils/schedule.test.ts` (add to `end conditions in generation loop` describe block)

**Step 1: Write the test**

```typescript
    it('stops at date end condition when end date falls between occurrences', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'date', date: localDate(2024, 4, 10) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15, Mar 15 — Apr 15 is after end date Apr 10 → excluded
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(startOfDay(localDate(2024, 2, 15)))
      expect(result[1]).toEqual(startOfDay(localDate(2024, 3, 15)))
    })

    it('generates nothing when end date is before first possible occurrence', () => {
      const config: FixedIntervalScheduleConfig = {
        type: 'fixed_interval',
        interval: 1,
        intervalUnit: 'month',
        endCondition: { type: 'date', date: localDate(2024, 1, 20) },
      }
      const lastCompleted = localDate(2024, 1, 15)
      const horizon = localDate(2024, 12, 31)
      const result = generateFutureOccurrences(config, horizon, 0, lastCompleted)

      // Feb 15 is after end date Jan 20 → no occurrences
      expect(result).toHaveLength(0)
    })
```

**Step 2: Run tests**

Run: `npm test -- tests/unit/utils/schedule.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/unit/utils/schedule.test.ts
git commit -m "test: add date end condition boundary tests for generation loop"
```

---

### Task 6: Write and run database backfill script for legacy tasks missing endCondition

**Files:**
- Create: `scripts/backfill-end-conditions.js`

**Step 1: Write the migration script**

```javascript
#!/usr/bin/env node

/**
 * Backfill script: adds endCondition: { type: "never" } to all TaskDefinition
 * scheduleConfig JSON objects that are missing the endCondition field.
 *
 * Safe to run multiple times (idempotent) — only updates rows where
 * endCondition is missing from the JSON.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillEndConditions() {
  try {
    console.log('🔍 Finding tasks with missing endCondition in scheduleConfig...');

    const allTasks = await prisma.taskDefinition.findMany({
      select: {
        id: true,
        name: true,
        metaStatus: true,
        scheduleConfig: true,
      },
    });

    const tasksToFix = allTasks.filter((task) => {
      const config = task.scheduleConfig;
      return config && typeof config === 'object' && !config.endCondition;
    });

    console.log(`Found ${tasksToFix.length} task(s) missing endCondition out of ${allTasks.length} total.\n`);

    if (tasksToFix.length === 0) {
      console.log('✅ Nothing to fix — all tasks already have endCondition.');
      return;
    }

    // Show what will be updated
    for (const task of tasksToFix) {
      console.log(`  📝 ${task.name} (${task.id}) [${task.metaStatus}] — type: ${task.scheduleConfig.type}`);
    }
    console.log('');

    // Perform updates
    let updated = 0;
    for (const task of tasksToFix) {
      const newConfig = {
        ...task.scheduleConfig,
        endCondition: { type: 'never' },
      };

      await prisma.taskDefinition.update({
        where: { id: task.id },
        data: { scheduleConfig: newConfig },
      });

      updated++;
    }

    console.log(`✅ Updated ${updated} task(s) with endCondition: { type: "never" }.`);

    // Verify
    const remaining = await prisma.taskDefinition.findMany({
      select: { id: true, scheduleConfig: true },
    });
    const stillMissing = remaining.filter((t) => !t.scheduleConfig?.endCondition);
    if (stillMissing.length === 0) {
      console.log('✅ Verification passed: all tasks now have endCondition.');
    } else {
      console.error(`❌ Verification failed: ${stillMissing.length} task(s) still missing endCondition.`);
    }
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillEndConditions();
```

**Step 2: Run the script (dry check first)**

Run: `npx tsx scripts/backfill-end-conditions.js`
Expected: Output showing 17 tasks identified and updated, verification passing.

**Step 3: Verify with a database query**

Run the CockroachDB MCP query tool (or `npx prisma studio`) to confirm:
```sql
SELECT id, name, "scheduleConfig"->>'type' as sched_type, "scheduleConfig"->'endCondition'->>'type' as end_type
FROM "TaskDefinition"
WHERE "scheduleConfig"->'endCondition' IS NULL;
```
Expected: 0 rows returned.

**Step 4: Commit**

```bash
git add scripts/backfill-end-conditions.js
git commit -m "chore: add backfill script for legacy tasks missing endCondition"
```

---

### Task 7: Run full test suite to confirm no regressions

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass, no regressions.
