import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { TaskService } from '@/server/services/TaskService';
import { createError, readBody } from 'h3';

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
    
    // Read request body
    const body = await readBody(event);
    
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
        message: 'You do not have permission to update this task'
      });
    }
    
    // Update task using the service
    const task = await taskService.update(taskId, {
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      categoryId: body.categoryId,
      scheduleConfig: body.scheduleConfig,
      reminderConfig: body.reminderConfig,
      defaultAssigneeIds: body.defaultAssigneeIds
    });
    
    return task;
  } catch (error) {
    console.error('[API] Error updating task:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: 'Server error updating task',
      cause: error
    });
  }
});
