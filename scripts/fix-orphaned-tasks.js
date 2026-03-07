import { PrismaClient } from '@prisma/client';
import { addMonths, addDays, addWeeks, addYears, startOfDay } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Calculate next due date from a base date based on interval config.
 */
function calculateNextDueDate(scheduleConfig, baseDate) {
  const base = startOfDay(baseDate);
  switch (scheduleConfig.type) {
    case 'fixed_interval': {
      const { interval, intervalUnit } = scheduleConfig;
      switch (intervalUnit) {
        case 'day': return addDays(base, interval);
        case 'week': return addWeeks(base, interval);
        case 'month': return addMonths(base, interval);
        case 'year': return addYears(base, interval);
      }
      break;
    }
    case 'variable_interval': {
      const { variableInterval } = scheduleConfig;
      const { interval, unit } = variableInterval;
      switch (unit) {
        case 'day': return addDays(base, interval);
        case 'week': return addWeeks(base, interval);
        case 'month': return addMonths(base, interval);
        case 'year': return addYears(base, interval);
      }
      break;
    }
    default:
      return null;
  }
}

async function main() {
  console.log('Finding orphaned active tasks with no pending occurrences...\n');

  // Find all active recurring tasks with no pending occurrences
  const orphaned = await prisma.$queryRaw`
    SELECT td.id, td.name, td."scheduleConfig", td."defaultAssigneeIds"
    FROM task_definitions td
    WHERE td."metaStatus" = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM task_occurrences toc
      WHERE toc."taskId" = td.id
      AND toc.status IN ('created', 'assigned')
    )
  `;

  if (!Array.isArray(orphaned) || orphaned.length === 0) {
    console.log('No orphaned tasks found. All active tasks have pending occurrences.');
    return;
  }

  console.log(`Found ${orphaned.length} orphaned task(s):\n`);

  for (const task of orphaned) {
    console.log(`  - ${task.name} (${task.id})`);
    console.log(`    Schedule: ${JSON.stringify(task.scheduleConfig)}`);

    // Get the last occurrence by due date
    const lastOcc = await prisma.taskOccurrence.findFirst({
      where: { taskId: task.id },
      orderBy: { dueDate: 'desc' },
    });

    if (!lastOcc) {
      console.log('    No occurrences exist — skipping (needs manual review)');
      continue;
    }

    const config = task.scheduleConfig;
    if (config.type === 'once') {
      console.log('    One-time task — skipping');
      continue;
    }

    // For fixed schedules, base date is last due date; for variable, use completedAt
    const baseDate = config.type === 'variable_interval'
      ? (lastOcc.completedAt || lastOcc.skippedAt || lastOcc.dueDate)
      : lastOcc.dueDate;

    const nextDueDate = calculateNextDueDate(config, baseDate);
    if (!nextDueDate) {
      console.log(`    Could not calculate next due date — skipping (schedule type: ${config.type})`);
      continue;
    }

    const assignees = task.defaultAssigneeIds || [];
    const status = assignees.length > 0 ? 'assigned' : 'created';

    console.log(`    Last due: ${lastOcc.dueDate.toISOString()} (${lastOcc.status})`);
    console.log(`    Creating occurrence for ${nextDueDate.toISOString()}...`);

    await prisma.taskOccurrence.create({
      data: {
        taskId: task.id,
        dueDate: nextDueDate,
        status,
        assigneeIds: assignees,
      },
    });
    console.log('    Done.\n');
  }

  // Verify
  const stillOrphaned = await prisma.$queryRaw`
    SELECT td.id, td.name
    FROM task_definitions td
    WHERE td."metaStatus" = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM task_occurrences toc
      WHERE toc."taskId" = td.id
      AND toc.status IN ('created', 'assigned')
    )
  `;

  if (Array.isArray(stillOrphaned) && stillOrphaned.length === 0) {
    console.log('Verification: All active tasks now have pending occurrences.');
  } else {
    console.log('WARNING: Some active tasks still have no pending occurrences:');
    console.log(stillOrphaned);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
