import { defineEventHandler, getQuery, createError } from 'h3';
import { UserService } from '@/server/services/UserService';
import { verifyIdentity } from '@/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Who is asking comes from the verified token; the email param is not trusted.
    const { email } = await verifyIdentity(event);

    const { email: requestedEmail } = getQuery(event);
    if (typeof requestedEmail === 'string' && requestedEmail.toLowerCase() !== email.toLowerCase()) {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: Unauthorized access',
      });
    }

    const userService = new UserService();
    const user = await userService.findByEmail(email);

    // The login page relies on this 404 to start registration.
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
