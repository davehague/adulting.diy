/**
 * One-time cleanup script to permanently delete soft-deleted tasks.
 *
 * Deletes in FK order:
 *   1. OccurrenceHistoryLog (references TaskOccurrence)
 *   2. TaskOccurrence (references TaskDefinition)
 *   3. TaskHistoryLog (references TaskDefinition)
 *   4. TaskDefinition
 *
 * Usage: node scripts/purge-soft-deleted-tasks.js [--dry-run] [--exclude id1,id2,...]
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const excludeArg = process.argv.find((a) => a.startsWith('--exclude='));
  const excludeIds = excludeArg ? excludeArg.split('=')[1].split(',') : [];

  if (dryRun) {
    console.log('=== DRY RUN MODE — no changes will be made ===\n');
  }

  // Find all soft-deleted tasks (excluding any specified)
  const softDeletedTasks = await prisma.taskDefinition.findMany({
    where: {
      metaStatus: 'soft-deleted',
      ...(excludeIds.length > 0 && { id: { notIn: excludeIds } }),
    },
    include: {
      occurrences: {
        include: { historyLogs: true },
      },
      historyLogs: true,
    },
  });

  if (softDeletedTasks.length === 0) {
    console.log('No soft-deleted tasks found. Nothing to do.');
    return;
  }

  console.log(`Found ${softDeletedTasks.length} soft-deleted task(s):\n`);
  for (const task of softDeletedTasks) {
    const occCount = task.occurrences.length;
    const histCount = task.historyLogs.length;
    const occHistCount = task.occurrences.reduce((sum, o) => sum + o.historyLogs.length, 0);
    console.log(`  - "${task.name}" (${task.id})`);
    console.log(`    ${occCount} occurrence(s), ${occHistCount} occurrence history log(s), ${histCount} task history log(s)`);
  }

  const taskIds = softDeletedTasks.map((t) => t.id);
  const occurrenceIds = softDeletedTasks.flatMap((t) => t.occurrences.map((o) => o.id));

  if (dryRun) {
    console.log('\nDry run complete. Re-run without --dry-run to permanently delete.');
    return;
  }

  console.log('\nPermanently deleting...');

  await prisma.$transaction(async (tx) => {
    // 1. Delete occurrence history logs
    const deletedOccHistory = await tx.occurrenceHistoryLog.deleteMany({
      where: { occurrenceId: { in: occurrenceIds } },
    });
    console.log(`  Deleted ${deletedOccHistory.count} occurrence history log(s)`);

    // 2. Delete occurrences
    const deletedOccurrences = await tx.taskOccurrence.deleteMany({
      where: { taskId: { in: taskIds } },
    });
    console.log(`  Deleted ${deletedOccurrences.count} occurrence(s)`);

    // 3. Delete task history logs
    const deletedTaskHistory = await tx.taskHistoryLog.deleteMany({
      where: { taskId: { in: taskIds } },
    });
    console.log(`  Deleted ${deletedTaskHistory.count} task history log(s)`);

    // 4. Delete task definitions
    const deletedTasks = await tx.taskDefinition.deleteMany({
      where: { id: { in: taskIds } },
    });
    console.log(`  Deleted ${deletedTasks.count} task definition(s)`);
  });

  console.log('\nDone! All soft-deleted tasks have been permanently removed.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
