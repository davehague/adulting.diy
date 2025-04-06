import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { TaskService } from '@/server/services/TaskService';
import { OccurrenceService } from '@/server/services/OccurrenceService';
import { createError } from 'h3';

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    // Get task ID from route params
    const taskId = event.context.params?.id;
    
    if (!taskId) {
      throw createError({
        statusCode: 400,
        message: 'Task ID is required'
      });
    }
    
    // Get task service
    const taskService = new TaskService();
    
    // Verify task exists and belongs to user's household
    const existingTask = await taskService.findById(taskId);
    
    if (!existingTask) {
      throw createError({
        statusCode: 404,
        message: 'Task not found'
      });
    }
    
    if (existingTask.householdId !== householdId) {
      throw createError({
        statusCode: 403,
        message: 'You do not have permission to view occurrences for this task'
      });
    }
    
    // Get occurrences for the task
    const occurrenceService = new OccurrenceService();
    const occurrences = await occurrenceService.findForTask(taskId);
    
    return occurrences;
  } catch (error) {
    console.error('[API] Error fetching task occurrences:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: 'Server error fetching task occurrences',
      cause: error
    });
  }
});
