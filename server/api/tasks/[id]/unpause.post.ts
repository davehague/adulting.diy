import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { TaskService } from '@/server/services/TaskService';
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
        message: 'You do not have permission to unpause this task'
      });
    }
    
    // Check if task is not paused
    if (existingTask.metaStatus !== 'paused') {
      throw createError({
        statusCode: 400,
        message: 'Task is not paused'
      });
    }
    
    // Unpause task using the service
    const task = await taskService.unpause(taskId);
    
    return {
      success: true,
      task
    };
  } catch (error) {
    console.error('[API] Error unpausing task:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: 'Server error unpausing task',
      cause: error
    });
  }
});
