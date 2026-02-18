import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing orphaned active tasks with no active occurrences...\n');

  // Fix 1: Appraisal cleanup - reactivate the deleted occurrence on 2026-03-07
  console.log('1. Appraisal cleanup (5acd65ba)');
  console.log('   Reactivating deleted occurrence on 2026-03-07...');
  await prisma.taskOccurrence.update({
    where: { id: 'b8cdc90f-8fdc-45d6-a144-cf3fb2952177' },
    data: { status: 'assigned', updatedAt: new Date() },
  });
  console.log('   Done.\n');

  // Fix 2: Clean out the dryer vent - create occurrence on 2026-04-01
  // (fixed_interval 3 months, walking forward from last due date 2025-07-01)
  console.log('2. Clean out the dryer vent (c8323787)');
  console.log('   Creating occurrence for 2026-04-01...');
  await prisma.taskOccurrence.create({
    data: {
      taskId: 'c8323787-af33-403b-a159-215b1c65ba67',
      dueDate: new Date('2026-04-01T04:00:00.000Z'),
      status: 'assigned',
      assigneeIds: ['aefef225-db56-4a94-b4c8-c69003453418'],
    },
  });
  console.log('   Done.\n');

  // Fix 3: Harvest garlic - create occurrence on 2026-07-01
  // (annual_fixed, July 1 each year)
  console.log('3. Harvest garlic (359fe6ed)');
  console.log('   Creating occurrence for 2026-07-01...');
  await prisma.taskOccurrence.create({
    data: {
      taskId: '359fe6ed-8dae-4554-9e40-9e5c8015a882',
      dueDate: new Date('2026-07-01T04:00:00.000Z'),
      status: 'assigned',
      assigneeIds: ['aefef225-db56-4a94-b4c8-c69003453418'],
    },
  });
  console.log('   Done.\n');

  // Verify: check all active tasks now have active occurrences
  const orphaned = await prisma.$queryRaw`
    SELECT td.id, td.name
    FROM task_definitions td
    WHERE td."metaStatus" = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM task_occurrences toc
      WHERE toc."taskId" = td.id
      AND toc.status IN ('created', 'assigned')
    )
  `;

  if (Array.isArray(orphaned) && orphaned.length === 0) {
    console.log('Verification: All active tasks now have active occurrences.');
  } else {
    console.log('WARNING: Some active tasks still have no active occurrences:');
    console.log(orphaned);
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
