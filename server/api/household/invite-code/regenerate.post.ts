import { defineHouseholdAdminEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError } from 'h3';

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const householdService = new HouseholdService();
    
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