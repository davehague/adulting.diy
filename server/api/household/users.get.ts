import { defineProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { UserService } from '@/server/services/UserService';
import { createError } from 'h3';

export default defineProtectedEventHandler(async (event, authUser) => {
  try {
    // Get user's current household
    const userService = new UserService();
    const user = await userService.findByEmail(authUser.email);
    
    if (!user || !user.household_id) {
      throw createError({
        statusCode: 404,
        message: 'You are not part of a household',
      });
    }
    
    // Get users in the household
    const householdService = new HouseholdService();
    const users = await householdService.getUsers(user.household_id);
    
    return users;
  } catch (error) {
    console.error('[API] Error getting household users:', error);
    
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
