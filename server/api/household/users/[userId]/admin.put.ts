import { defineHouseholdProtectedEventHandler } from '@/server/utils/auth';
import { HouseholdService } from '@/server/services/HouseholdService';
import { createError, getRouterParam, readBody } from 'h3';
import { z } from 'zod';

const updateAdminSchema = z.object({
  isAdmin: z.boolean()
});

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const householdService = new HouseholdService();
    const targetUserId = getRouterParam(event, 'userId');

    if (!targetUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      });
    }

    // Check if current user is admin
    const isAdmin = await householdService.isUserAdmin(authUser.id, householdId);
    
    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only household admins can change admin privileges'
      });
    }

    // Validate request body
    const body = await readBody(event);
    const validatedData = updateAdminSchema.parse(body);

    // Check if target user exists in household
    const householdUsers = await householdService.getUsers(householdId);
    const targetUser = householdUsers.find(user => user.id === targetUserId);

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found in household'
      });
    }

    // If removing admin privileges, check if this would leave no admins
    if (!validatedData.isAdmin && targetUser.isAdmin) {
      const isOnlyAdmin = await householdService.isOnlyAdmin(targetUserId, householdId);
      
      if (isOnlyAdmin) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot remove admin privileges from the only admin. Please assign another admin first.'
        });
      }
    }

    // Update user admin status
    await householdService.updateUserAdminStatus(targetUserId, validatedData.isAdmin);

    return {
      success: true,
      message: `${targetUser.name} ${validatedData.isAdmin ? 'granted' : 'removed'} admin privileges`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        isAdmin: validatedData.isAdmin
      }
    };
  } catch (error) {
    console.error('[API] Error updating user admin status:', error);
    
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
      statusMessage: 'Server error updating user admin status',
      cause: error
    });
  }
});