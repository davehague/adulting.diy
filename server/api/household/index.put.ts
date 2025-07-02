import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError, readBody } from 'h3';
import { z } from 'zod';

const updateHouseholdSchema = z.object({
  name: z.string().min(1, 'Household name is required').max(100, 'Household name too long')
});

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const householdService = new HouseholdService();
    
    // Check if user is admin
    const isAdmin = await householdService.isUserAdmin(authUser.id, householdId);
    
    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only household admins can update household settings'
      });
    }

    // Validate request body
    const body = await readBody(event);
    const validatedData = updateHouseholdSchema.parse(body);

    // Update household
    const updatedHousehold = await householdService.update(householdId, {
      name: validatedData.name
    });

    return {
      id: updatedHousehold.id,
      name: updatedHousehold.name,
      inviteCode: updatedHousehold.inviteCode,
      updatedAt: updatedHousehold.updatedAt
    };
  } catch (error) {
    console.error('[API] Error updating household:', error);
    
    if ((error as any).statusCode) {
      throw error;
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request data',
        data: error.errors
      });
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error updating household',
      cause: error
    });
  }
});