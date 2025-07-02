import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError } from 'h3';

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const householdService = new HouseholdService();
    
    // Get household details
    const household = await householdService.findById(householdId);
    
    if (!household) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Household not found'
      });
    }

    // Get member count
    const memberCount = await householdService.getMemberCount(householdId);

    // Check if current user is admin
    const isAdmin = await householdService.isUserAdmin(authUser.userId, householdId);

    return {
      id: household.id,
      name: household.name,
      inviteCode: household.inviteCode,
      memberCount,
      isCurrentUserAdmin: isAdmin,
      createdAt: household.createdAt,
      updatedAt: household.updatedAt
    };
  } catch (error) {
    console.error('[API] Error fetching household details:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error fetching household details',
      cause: error
    });
  }
});