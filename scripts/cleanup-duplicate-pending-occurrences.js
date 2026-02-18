/**
 * One-time cleanup script to remove duplicate pending occurrences.
 *
 * The scheduler was creating extra future occurrences for tasks that already
 * had a pending occurrence. This script finds tasks with multiple pending
 * occurrences, keeps the one with the earliest due date, and deletes the rest.
 *
 * Usage: node scripts/cleanup-duplicate-pending-occurrences.js [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('=== DRY RUN MODE — no changes will be made ===\n');
  }

  // Find tasks that have more than 1 pending occurrence
  const tasksWithDuplicates = await prisma.$queryRaw`
    SELECT "taskId", COUNT(*) as pending_count
    FROM task_occurrences
    WHERE status IN ('created', 'assigned')
    GROUP BY "taskId"
    HAVING COUNT(*) > 1
  `;

  if (tasksWithDuplicates.length === 0) {
    console.log('No tasks with duplicate pending occurrences found.');
    return;
  }

  console.log(`Found ${tasksWithDuplicates.length} task(s) with duplicate pending occurrences:\n`);

  let totalDeleted = 0;

  for (const { taskId, pending_count } of tasksWithDuplicates) {
    const task = await prisma.taskDefinition.findUnique({
      where: { id: taskId },
      select: { name: true },
    });

    // Get all pending occurrences, ordered by due date
    const pendingOccurrences = await prisma.taskOccurrence.findMany({
      where: {
        taskId,
        status: { in: ['created', 'assigned'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    const keep = pendingOccurrences[0];
    const toDelete = pendingOccurrences.slice(1);

    console.log(`Task: "${task?.name}" (${taskId})`);
    console.log(`  Pending occurrences: ${Number(pending_count)}`);
    console.log(`  Keeping:  ${keep.id} (due ${keep.dueDate.toISOString()})`);
    for (const occ of toDelete) {
      console.log(`  Deleting: ${occ.id} (due ${occ.dueDate.toISOString()})`);
    }

    if (!dryRun) {
      const idsToDelete = toDelete.map((o) => o.id);

      // Delete history logs first (foreign key constraint)
      const deletedLogs = await prisma.occurrenceHistoryLog.deleteMany({
        where: { occurrenceId: { in: idsToDelete } },
      });

      // Delete the extra occurrences
      const deletedOccs = await prisma.taskOccurrence.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      console.log(`  Removed ${deletedOccs.count} occurrence(s) and ${deletedLogs.count} history log(s)`);
      totalDeleted += deletedOccs.count;
    }

    console.log();
  }

  if (dryRun) {
    console.log('=== DRY RUN complete — re-run without --dry-run to apply changes ===');
  } else {
    console.log(`Done. Deleted ${totalDeleted} duplicate occurrence(s).`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
