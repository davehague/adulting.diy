#!/usr/bin/env node

/**
 * Script to add an "on due date" reminder to all active tasks.
 * - Tasks with no reminderConfig get { reminders: [{ days: 0, timing: 'on' }] }
 * - Tasks with existing reminderConfig get { days: 0, timing: 'on' } appended (if not already present)
 * - Legacy format (initialReminder/followUpReminder/overdueReminder) is converted to new format first
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ON_DUE_DATE_REMINDER = { days: 0, timing: 'on' };

function convertLegacyConfig(config) {
  const reminders = [];
  if (typeof config.initialReminder === 'number' && config.initialReminder >= 0) {
    reminders.push({ days: config.initialReminder, timing: 'before' });
  }
  if (typeof config.followUpReminder === 'number' && config.followUpReminder >= 0) {
    reminders.push({ days: config.followUpReminder, timing: 'before' });
  }
  if (typeof config.overdueReminder === 'number' && config.overdueReminder >= 0) {
    reminders.push({ days: config.overdueReminder, timing: 'after' });
  }
  // Deduplicate
  const seen = new Set();
  return reminders.filter(r => {
    const key = `${r.timing}:${r.days}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLegacyFormat(config) {
  return !Array.isArray(config.reminders) && (
    config.initialReminder !== undefined ||
    config.followUpReminder !== undefined ||
    config.overdueReminder !== undefined
  );
}

function hasOnDueDateReminder(reminders) {
  return reminders.some(r => r.timing === 'on' && r.days === 0);
}

async function addDueDateReminders() {
  try {
    const tasks = await prisma.taskDefinition.findMany({
      where: { metaStatus: 'active' },
      select: { id: true, name: true, reminderConfig: true }
    });

    console.log(`Found ${tasks.length} active tasks`);

    let noConfigCount = 0;
    let legacyConvertedCount = 0;
    let alreadyHasCount = 0;
    let appendedCount = 0;

    for (const task of tasks) {
      const config = task.reminderConfig;

      if (!config) {
        // No reminder config at all — set to just on-due-date
        await prisma.taskDefinition.update({
          where: { id: task.id },
          data: { reminderConfig: { reminders: [ON_DUE_DATE_REMINDER] } }
        });
        noConfigCount++;
        console.log(`  + ${task.name}: added on-due-date reminder (was empty)`);
        continue;
      }

      let reminders;

      if (isLegacyFormat(config)) {
        // Convert legacy format first
        reminders = convertLegacyConfig(config);
        legacyConvertedCount++;
        console.log(`  ~ ${task.name}: converted from legacy format`);
      } else if (Array.isArray(config.reminders)) {
        reminders = [...config.reminders];
      } else {
        // Unexpected format — treat as empty
        reminders = [];
      }

      if (hasOnDueDateReminder(reminders)) {
        alreadyHasCount++;
        // Still save if we converted from legacy
        if (isLegacyFormat(config)) {
          await prisma.taskDefinition.update({
            where: { id: task.id },
            data: { reminderConfig: { reminders } }
          });
        }
        continue;
      }

      // Append on-due-date reminder (respect max of 5)
      if (reminders.length < 5) {
        reminders.push(ON_DUE_DATE_REMINDER);
      }

      await prisma.taskDefinition.update({
        where: { id: task.id },
        data: { reminderConfig: { reminders } }
      });
      appendedCount++;
      console.log(`  + ${task.name}: appended on-due-date reminder`);
    }

    console.log('\nSummary:');
    console.log(`  ${noConfigCount} tasks: added on-due-date (had no reminders)`);
    console.log(`  ${appendedCount} tasks: appended on-due-date to existing reminders`);
    console.log(`  ${legacyConvertedCount} tasks: converted from legacy format`);
    console.log(`  ${alreadyHasCount} tasks: already had on-due-date reminder (skipped)`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addDueDateReminders()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
