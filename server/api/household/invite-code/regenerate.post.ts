import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError } from 'h3';

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const householdService = new HouseholdService();
    
    // Check if user is admin
    const isAdmin = await householdService.isUserAdmin(authUser.id, householdId);
    
    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only household admins can regenerate invite codes'
      });
    }

    // Regenerate invite code
    const newInviteCode = await householdService.regenerateInviteCode(householdId);

    return {
      success: true,
      inviteCode: newInviteCode,
      message: 'Invite code has been regenerated successfully'
    };
  } catch (error) {
    console.error('[API] Error regenerating invite code:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error regenerating invite code',
      cause: error
    });
  }
});