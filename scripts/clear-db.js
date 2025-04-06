import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database clearing process...');

  // Important: Deleting users might fail if they are referenced by undeleted
  // TaskDefinitions (createdByUserId) or OccurrenceHistoryLogs (userId)
  // due to potential RESTRICT constraints.
  // Similarly, deleting households might fail if referenced by undeleted
  // TaskDefinitions or Categories.
  // If this script fails, a more comprehensive deletion order might be needed,
  // or foreign key constraints reviewed in schema.prisma.

  try {
    console.log('Attempting to delete OccurrenceHistoryLog records...');
    const deletedHistoryLogs = await prisma.occurrenceHistoryLog.deleteMany({});
    console.log(`Deleted ${deletedHistoryLogs.count} OccurrenceHistoryLog records.`);

    console.log('Attempting to delete TaskOccurrence records...');
    const deletedOccurrences = await prisma.taskOccurrence.deleteMany({});
    console.log(`Deleted ${deletedOccurrences.count} TaskOccurrence records.`);

    console.log('Attempting to delete TaskDefinition records...');
    const deletedTasks = await prisma.taskDefinition.deleteMany({});
    console.log(`Deleted ${deletedTasks.count} TaskDefinition records.`);

    console.log('Attempting to delete custom Category records...');
    // Keep default categories (where householdId is null)
    const deletedCategories = await prisma.category.deleteMany({
      where: { householdId: { not: null } }
    });
    console.log(`Deleted ${deletedCategories.count} custom Category records.`);

    console.log('Attempting to delete User records...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`Deleted ${deletedUsers.count} User records.`);

    console.log('Attempting to delete Household records...');
    const deletedHouseholds = await prisma.household.deleteMany({});
    console.log(`Deleted ${deletedHouseholds.count} Household records.`);

    console.log('Database clearing completed successfully!');

  } catch (error) {
    console.error('Error during database clearing:', error);
    console.error('\nClearing failed. This might be due to foreign key constraints.');
    console.error('Consider adjusting the deletion order or checking constraints in schema.prisma.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });