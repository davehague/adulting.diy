import { defineHouseholdAdminEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError, getRouterParam } from 'h3';

export default defineHouseholdAdminEventHandler(async (event, authUser, householdId) => {
  try {
    const householdService = new HouseholdService();
    const targetUserId = getRouterParam(event, 'userId');

    if (!targetUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      });
    }

    // Prevent admin from removing themselves
    if (targetUserId === authUser.userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot remove yourself. Use the leave household option instead.'
      });
    }

    // Check if target user exists in household
    const householdUsers = await householdService.getUsers(householdId);
    const targetUser = householdUsers.find(user => user.id === targetUserId);

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found in household'
      });
    }

    // Remove user from household
    await householdService.removeUser(targetUserId);

    return {
      success: true,
      message: `${targetUser.name} has been removed from the household`
    };
  } catch (error) {
    console.error('[API] Error removing user from household:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error removing user from household',
      cause: error
    });
  }
});