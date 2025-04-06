import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { TaskService } from '@/server/services/TaskService';
import { createError, getQuery } from 'h3';

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    // Get query parameters for filtering
    const query = getQuery(event);
    
    // Build filters object
    const filters = {
      status: query.status as string,
      categoryId: query.categoryId as string,
      search: query.search as string
    };
    
    // Get tasks using the service
    const taskService = new TaskService();
    const tasks = await taskService.findForHousehold(householdId, filters);
    
    return tasks;
  } catch (error) {
    console.error('[API] Error fetching tasks:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: 'Server error fetching tasks',
      cause: error
    });
  }
});
