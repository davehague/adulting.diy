import { defineProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError, readBody } from 'h3';

export default defineProtectedEventHandler(async (event, authUser) => {
  try {
    const body = await readBody(event);
    
    if (!body.inviteCode || typeof body.inviteCode !== 'string' || body.inviteCode.trim() === '') {
      throw createError({
        statusCode: 400,
        message: 'Invite code is required',
      });
    }
    
    // Find household by invite code
    const householdService = new HouseholdService();
    const household = await householdService.findByInviteCode(body.inviteCode.trim());
    
    if (!household) {
      throw createError({
        statusCode: 404,
        message: 'Invalid invite code. Household not found.',
      });
    }
    
    // Add current user to household (not as admin)
    await householdService.addUser(household.id, authUser.userId, false);
    
    return {
      success: true,
      household
    };
  } catch (error) {
    console.error('[API] Error joining household:', error);
    
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
