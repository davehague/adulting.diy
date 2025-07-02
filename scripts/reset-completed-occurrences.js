#!/usr/bin/env node

/**
 * Script to reset completed occurrences from active tasks back to pending status
 * This will clear the completedAt field and set status to 'assigned' or 'created'
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetCompletedOccurrences() {
  try {
    console.log('🔍 Finding completed occurrences from active tasks...');
    
    // First, let's see what we're working with
    const completedOccurrences = await prisma.taskOccurrence.findMany({
      where: {
        status: 'completed',
        task: {
          metaStatus: 'active'
        }
      },
      include: {
        task: {
          select: {
            name: true,
            metaStatus: true
          }
        }
      }
    });

    console.log(`📊 Found ${completedOccurrences.length} completed occurrences from active tasks`);
    
    if (completedOccurrences.length === 0) {
      console.log('✅ No completed occurrences found. Nothing to reset.');
      return;
    }

    // Show a few examples
    console.log('📋 Examples of occurrences to be reset:');
    completedOccurrences.slice(0, 5).forEach((occ, index) => {
      console.log(`  ${index + 1}. ${occ.task.name} (${occ.assigneeIds.length > 0 ? 'assigned' : 'unassigned'})`);
    });

    console.log('🔄 Resetting occurrences...');

    // Update all completed occurrences from active tasks
    let updatedCount = 0;
    
    for (const occurrence of completedOccurrences) {
      const newStatus = occurrence.assigneeIds.length > 0 ? 'assigned' : 'created';
      
      await prisma.taskOccurrence.update({
        where: { id: occurrence.id },
        data: {
          status: newStatus,
          completedAt: null,
          updatedAt: new Date()
        }
      });
      
      updatedCount++;
      
      if (updatedCount % 10 === 0) {
        console.log(`  ✓ Reset ${updatedCount}/${completedOccurrences.length} occurrences...`);
      }
    }

    console.log(`✅ Successfully reset ${updatedCount} occurrences!`);
    
    // Verify the changes
    const remainingCompleted = await prisma.taskOccurrence.count({
      where: {
        status: 'completed',
        task: {
          metaStatus: 'active'
        }
      }
    });

    console.log(`🔍 Verification: ${remainingCompleted} completed occurrences remaining from active tasks`);

    // Show the new status distribution
    const statusCounts = await prisma.taskOccurrence.groupBy({
      by: ['status'],
      where: {
        task: {
          metaStatus: 'active'
        }
      },
      _count: {
        status: true
      }
    });

    console.log('📊 Current status distribution for active tasks:');
    statusCounts.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count.status}`);
    });

  } catch (error) {
    console.error('❌ Error resetting occurrences:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetCompletedOccurrences()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });