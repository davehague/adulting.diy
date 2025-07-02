import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { OccurrenceService } from '@/server/services/OccurrenceService';
import { createError, getQuery } from 'h3';

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    // Get query parameters for filtering
    const query = getQuery(event);
    
    // Parse date filters if provided
    let dueDateFrom: Date | undefined;
    let dueDateTo: Date | undefined;
    
    if (query.dueDateFrom) {
      dueDateFrom = new Date(query.dueDateFrom as string);
    }
    
    if (query.dueDateTo) {
      dueDateTo = new Date(query.dueDateTo as string);
    }
    
    // Build filters object
    const filters = {
      status: query.status as string,
      statusIn: query.statusIn as string, // For multiple status values like "created,assigned"
      categoryId: query.categoryId as string,
      assigneeId: query.assigneeId as string,
      dueDateFrom,
      dueDateTo,
      search: query.search as string
    };
    
    // Get occurrences using the service
    const occurrenceService = new OccurrenceService();
    const occurrences = await occurrenceService.findForHousehold(householdId, filters);
    
    return occurrences;
  } catch (error) {
    console.error('[API] Error fetching occurrences:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: 'Server error fetching occurrences',
      cause: error
    });
  }
});
