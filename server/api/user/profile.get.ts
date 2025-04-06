import { defineEventHandler, getQuery, createError } from 'h3';
import { UserService } from '@/server/services/UserService';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { email } = query;

    if (!email || typeof email !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Email parameter is required',
      });
    }

    const userService = new UserService();
    const user = await userService.findByEmail(email as string);

    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'User not found',
      });
    }

    return user;
  } catch (error) {
    console.error('[API] Error getting user profile:', error);
    
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
