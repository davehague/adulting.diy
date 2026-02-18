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
    console.log('Finding tasks with missing endCondition in scheduleConfig...');

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
      console.log('Nothing to fix - all tasks already have endCondition.');
      return;
    }

    // Show what will be updated
    for (const task of tasksToFix) {
      console.log(`  ${task.name} (${task.id}) [${task.metaStatus}] - type: ${task.scheduleConfig.type}`);
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

    console.log(`Updated ${updated} task(s) with endCondition: { type: "never" }.`);

    // Verify
    const remaining = await prisma.taskDefinition.findMany({
      select: { id: true, scheduleConfig: true },
    });
    const stillMissing = remaining.filter((t) => !t.scheduleConfig?.endCondition);
    if (stillMissing.length === 0) {
      console.log('Verification passed: all tasks now have endCondition.');
    } else {
      console.error(`Verification failed: ${stillMissing.length} task(s) still missing endCondition.`);
    }
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillEndConditions();
