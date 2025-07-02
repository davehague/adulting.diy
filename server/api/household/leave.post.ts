import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError } from 'h3';

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const householdService = new HouseholdService();

    // Check if user is the only admin
    const isOnlyAdmin = await householdService.isOnlyAdmin(authUser.id, householdId);
    
    if (isOnlyAdmin) {
      // Get member count to see if there are other members
      const memberCount = await householdService.getMemberCount(householdId);
      
      if (memberCount > 1) {
        throw createError({
          statusCode: 400,
          statusMessage: 'You are the only admin in this household. Please transfer admin privileges to another member before leaving, or remove all other members first.'
        });
      }
      // If they're the only member, allow them to leave
    }

    // Remove user from household
    await householdService.removeUser(authUser.id);

    return {
      success: true,
      message: 'You have successfully left the household',
      redirectTo: '/setup-household'
    };
  } catch (error) {
    console.error('[API] Error leaving household:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error leaving household',
      cause: error
    });
  }
});