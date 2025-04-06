import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateRandomInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function main() {
  console.log('Starting database seeding...');

  // Create default categories
  console.log('Creating default categories...');
  const defaultCategories = [
    { name: 'House', isDefault: true },
    { name: 'Pets', isDefault: true },
    { name: 'Auto', isDefault: true },
    { name: 'Shopping', isDefault: true },
    { name: 'Bills and Finance', isDefault: true },
    { name: 'Appointments and Errands', isDefault: true },
  ];

  for (const category of defaultCategories) {
    // Fix: Use a direct create instead of upsert for default categories
    // since we're having issues with the composite unique constraint
    try {
      // First check if it exists
      const existingCategory = await prisma.category.findFirst({
        where: {
          name: category.name,
          isDefault: true,
          householdId: null
        }
      });
      
      if (!existingCategory) {
        await prisma.category.create({
          data: {
            name: category.name,
            isDefault: true,
            // Explicitly setting householdId to null
            householdId: null
          }
        });
        console.log(`Created default category: ${category.name}`);
      } else {
        console.log(`Default category already exists: ${category.name}`);
      }
    } catch (err) {
      console.error(`Error creating category ${category.name}:`, err);
    }
  }

  console.log('Default categories created.');

  // Create test household and user if none exists
  console.log('Creating test household and user...');
  
  // Create a test household
  let testHousehold;
  try {
    const existingHousehold = await prisma.household.findFirst({
      where: { name: 'Test Household' }
    });
    
    if (!existingHousehold) {
      testHousehold = await prisma.household.create({
        data: {
          name: 'Test Household',
          inviteCode: await generateRandomInviteCode()
        }
      });
      console.log('Created test household:', testHousehold.id);
    } else {
      testHousehold = existingHousehold;
      console.log('Using existing test household:', testHousehold.id);
    }
  } catch (err) {
    console.error('Error creating test household:', err);
    return; // Exit if we can't create a household
  }

  // Create a test user
  let testUser;
  try {
    const existingUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });
    
    if (!existingUser) {
      testUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          isAdmin: true,
          householdId: testHousehold.id
        }
      });
      console.log('Created test user:', testUser.id);
    } else {
      testUser = existingUser;
      console.log('Using existing test user:', testUser.id);
    }
  } catch (err) {
    console.error('Error creating test user:', err);
    return; // Exit if we can't create a user
  }

  console.log('Test household and user set up.');

  // Create some sample tasks if none exist
  console.log('Setting up sample tasks...');
  
  // Get category IDs
  let houseCategory, petsCategory;
  try {
    houseCategory = await prisma.category.findFirst({
      where: {
        name: 'House',
        OR: [
          { isDefault: true },
          { householdId: testHousehold.id }
        ]
      }
    });

    petsCategory = await prisma.category.findFirst({
      where: {
        name: 'Pets',
        OR: [
          { isDefault: true },
          { householdId: testHousehold.id }
        ]
      }
    });
    
    if (!houseCategory || !petsCategory) {
      console.error('Required categories not found. Task creation skipped.');
      return;
    }
  } catch (err) {
    console.error('Error fetching categories:', err);
    return;
  }

  // Check if any tasks exist
  let tasksCount = 0;
  try {
    tasksCount = await prisma.taskDefinition.count();
    console.log(`Found ${tasksCount} existing tasks`);
  } catch (err) {
    console.error('Error counting tasks:', err);
  }
  
  if (tasksCount === 0) {
    try {
      // Create Weekly house cleaning task
      const cleanHouseTask = await prisma.taskDefinition.create({
        data: {
          householdId: testHousehold.id,
          name: 'Clean the House',
          description: 'Weekly house cleaning routine',
          instructions: 'Vacuum all rooms, clean bathrooms, dust surfaces, and take out trash',
          categoryId: houseCategory.id,
          metaStatus: 'active',
          scheduleConfig: {
            type: 'specific_days_of_week',
            daysOfWeek: {
              monday: false,
              tuesday: false,
              wednesday: false,
              thursday: false,
              friday: false,
              saturday: true,
              sunday: false
            },
            endCondition: {
              type: 'never'
            }
          },
          reminderConfig: {
            initialReminder: 1,
            overdueReminder: 1
          },
          createdByUserId: testUser.id,
          defaultAssigneeIds: [testUser.id]
        }
      });
      console.log('Created "Clean the House" task');

      // Create Daily dog walking task
      const dogWalkingTask = await prisma.taskDefinition.create({
        data: {
          householdId: testHousehold.id,
          name: 'Walk the Dog',
          description: 'Daily dog walking routine',
          instructions: 'Take the dog for a 30-minute walk around the neighborhood',
          categoryId: petsCategory.id,
          metaStatus: 'active',
          scheduleConfig: {
            type: 'fixed_interval',
            interval: 1,
            intervalUnit: 'day',
            endCondition: {
              type: 'never'
            }
          },
          reminderConfig: {
            initialReminder: 0
          },
          createdByUserId: testUser.id,
          defaultAssigneeIds: [testUser.id]
        }
      });
      console.log('Created "Walk the Dog" task');

      // Create Monthly air filter change task
      const airFilterTask = await prisma.taskDefinition.create({
        data: {
          householdId: testHousehold.id,
          name: 'Change Air Filters',
          description: 'Monthly air filter replacement',
          instructions: 'Replace the HVAC air filters throughout the house',
          categoryId: houseCategory.id,
          metaStatus: 'active',
          scheduleConfig: {
            type: 'fixed_interval',
            interval: 1,
            intervalUnit: 'month',
            endCondition: {
              type: 'never'
            }
          },
          reminderConfig: {
            initialReminder: 3
          },
          createdByUserId: testUser.id,
          defaultAssigneeIds: [testUser.id]
        }
      });
      console.log('Created "Change Air Filters" task');
    } catch (err) {
      console.error('Error creating tasks:', err);
    }
  }

  console.log('Sample tasks set up.');

  // Create sample occurrences for each task if none exist
  console.log('Setting up sample occurrences...');
  
  let occurrencesCount = 0;
  try {
    occurrencesCount = await prisma.taskOccurrence.count();
    console.log(`Found ${occurrencesCount} existing occurrences`);
  } catch (err) {
    console.error('Error counting occurrences:', err);
  }
  
  if (occurrencesCount === 0) {
    // Get all tasks
    try {
      const tasks = await prisma.taskDefinition.findMany({
        where: {
          householdId: testHousehold.id
        }
      });
      
      for (const task of tasks) {
        // Create an occurrence due today
        const todayOccurrence = await prisma.taskOccurrence.create({
          data: {
            taskId: task.id,
            dueDate: new Date(),
            status: 'assigned',
            assigneeIds: [testUser.id]
          }
        });
        console.log(`Created occurrence for task ${task.name}, due today`);
        
        // Add a comment to the occurrence
        await prisma.occurrenceHistoryLog.create({
          data: {
            occurrenceId: todayOccurrence.id,
            userId: testUser.id,
            logType: 'comment',
            comment: 'Added this task to the schedule'
          }
        });
        console.log(`Added comment to occurrence for task ${task.name}`);
        
        // Create an occurrence due next week
        const nextWeekDate = new Date();
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        
        await prisma.taskOccurrence.create({
          data: {
            taskId: task.id,
            dueDate: nextWeekDate,
            status: 'created',
            assigneeIds: []
          }
        });
        console.log(`Created occurrence for task ${task.name}, due next week`);
      }
    } catch (err) {
      console.error('Error creating occurrences:', err);
    }
  }

  console.log('Sample occurrences set up.');
  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
