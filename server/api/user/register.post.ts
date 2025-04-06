import { defineEventHandler, readBody, createError } from 'h3';
import { UserService } from '@/server/services/UserService';
import type { GoogleUser } from '@/types';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    // Validate required fields
    if (!body.email || !body.name) {
      throw createError({
        statusCode: 400,
        message: 'Email and name are required',
      });
    }
    
    // Construct GoogleUser object from request body
    const googleUser: GoogleUser = {
      email: body.email,
      email_verified: body.email_verified || false,
      name: body.name,
      picture: body.picture,
      given_name: body.given_name || '',
      family_name: body.family_name || '',
      locale: body.locale || 'en',
    };
    
    const userService = new UserService();
    const user = await userService.createFromGoogle(googleUser);
    
    return user;
  } catch (error) {
    console.error('[API] Error registering user:', error);
    
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
