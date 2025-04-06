import { defineProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError, readBody } from 'h3';

export default defineProtectedEventHandler(async (event, authUser) => {
  try {
    const body = await readBody(event);
    
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      throw createError({
        statusCode: 400,
        message: 'Household name is required',
      });
    }
    
    // Create new household
    const householdService = new HouseholdService();
    const household = await householdService.create(body.name.trim());
    
    // Add current user to household as admin
    await householdService.addUser(household.id, authUser.userId, true);
    
    return {
      success: true,
      household
    };
  } catch (error) {
    console.error('[API] Error creating household:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: 'Server error',
      cause: error
    });
  }
});
