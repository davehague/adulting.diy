import { type Prisma } from '@prisma/client';
import { addDays, addMonths, addWeeks, addYears, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import prisma from '@/server/utils/prisma/client';
import { ApiKeyService } from '@/server/services/ApiKeyService';
import { TaskService } from '@/server/services/TaskService';
import { parseDateOnly } from '@/server/utils/dates';
import { taskIngestItemSchema, type TaskIngestItem } from '@/server/utils/task-schemas';
import { type IntervalUnit, type TaskIngestResult } from '@/types/task';

const ADD: Record<IntervalUnit, (date: Date, amount: number) => Date> = {
  day: addDays, week: addWeeks, month: addMonths, year: addYears,
};

const nameKey = (name: string): string => name.trim().toLowerCase();

interface VisibleCategory { id: string; name: string; householdId: string | null }

// The household's own category wins over a global default with the same name ("House", "Pets").
const resolveCategory = (categories: VisibleCategory[], item: TaskIngestItem): VisibleCategory | undefined => {
  if (item.categoryId) return categories.find((c) => c.id === item.categoryId);
  const wanted = nameKey(item.category ?? '');
  const matches = categories.filter((c) => nameKey(c.name) === wanted);
  return matches.find((c) => c.householdId !== null) ?? matches[0];
};

// Due dates are calendar dates stored at noon UTC (see parseDateOnly). Without a firstDueDate a
// recurring task is first due one interval from today in the household's timezone; a variable
// interval would otherwise get no occurrence at all until someone completes one.
const firstDueDateFor = (item: TaskIngestItem, timezone: string): Date => {
  const schedule = item.scheduleConfig;
  if (schedule.type === 'once') return parseDateOnly(schedule.dueDate);
  if (item.firstDueDate) return parseDateOnly(item.firstDueDate);
  // Calendar arithmetic on a local date, so a DST change inside the interval cannot move the hour.
  const [year, month, day] = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd').split('-').map(Number);
  const today = new Date(year, month - 1, day);
  const due = schedule.type === 'fixed_interval'
    ? ADD[schedule.intervalUnit](today, schedule.interval)
    : ADD[schedule.variableInterval.unit](today, schedule.variableInterval.interval);
  return parseDateOnly(format(due, 'yyyy-MM-dd'));
};

export class TaskIngestService {
  private apiKeys = new ApiKeyService();
  private tasks = new TaskService();

  async ingestBatch(householdId: string, userId: string, rawItems: unknown[]): Promise<TaskIngestResult> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);

    const [household, categories, current] = await Promise.all([
      prisma.household.findUnique({ where: { id: householdId }, select: { timezone: true } }),
      prisma.category.findMany({
        where: { OR: [{ householdId }, { householdId: null, isDefault: true }] },
        select: { id: true, name: true, householdId: true },
      }),
      // Paused tasks count as existing: a second copy would come back to life on its own.
      prisma.taskDefinition.findMany({
        where: { householdId, metaStatus: { not: 'soft-deleted' } },
        select: { id: true, name: true },
      }),
    ]);
    const timezone = household?.timezone || 'UTC';
    const existing = new Map(current.map((t) => [nameKey(t.name), t.id]));

    const result: TaskIngestResult = { created: [], skipped: [], errors: [] };

    for (let index = 0; index < rawItems.length; index++) {
      const raw = rawItems[index];
      const parsed = taskIngestItemSchema.safeParse(raw);
      if (!parsed.success) {
        const name = typeof (raw as { name?: unknown })?.name === 'string' ? (raw as { name: string }).name : '';
        result.errors.push({ index, name, message: parsed.error.issues[0]?.message ?? 'Invalid item' });
        continue;
      }
      const item = parsed.data;

      const duplicateId = existing.get(nameKey(item.name));
      if (duplicateId) {
        result.skipped.push({ index, id: duplicateId, name: item.name, reason: 'A task with this name already exists' });
        continue;
      }
      const category = resolveCategory(categories, item);
      if (!category) {
        result.errors.push({ index, name: item.name, message: `Unknown category: ${item.category ?? item.categoryId}` });
        continue;
      }

      try {
        const firstDueDate = firstDueDateFor(item, timezone);
        const task = await this.tasks.create(
          {
            householdId,
            name: item.name,
            description: item.description ?? null,
            categoryId: category.id,
            metaStatus: 'active',
            scheduleConfig: item.scheduleConfig as Prisma.InputJsonValue,
            createdByUserId: userId,
            defaultAssigneeIds: [],
          },
          { firstDueDate },
        );
        existing.set(nameKey(item.name), task.id);
        result.created.push({ index, id: task.id, name: item.name, firstDueDate: firstDueDate.toISOString().slice(0, 10) });
      } catch (error) {
        console.error(`[TaskIngestService] item ${index} failed:`, error);
        result.errors.push({ index, name: item.name, message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return result;
  }
}
