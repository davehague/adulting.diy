import { devAuthService } from "@/server/utils/dev-auth";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  // Security check: only work in development with bypass enabled
  if (!config.devBypassEnabled) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    });
  }
  
  const body = await readBody(event);
  const { userId } = body;
  
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required'
    });
  }
  
  console.log(`[DEV API] 🧪 Switching to development user: ${userId}`);
  
  try {
    // Verify the user exists
    const user = await devAuthService.getUserById(userId);
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }
    
    // Set development user cookie
    setCookie(event, 'dev-user-id', userId, {
      maxAge: 60 * 60 * 24 * 7, // 1 week
      httpOnly: false, // Allow client access for switching
      secure: false, // Development only
      sameSite: 'lax'
    });
    
    console.log(`[DEV API] ✅ Successfully switched to user: ${user.email}`);
    
    return { 
      success: true, 
      userId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        householdId: user.householdId
      }
    };
  } catch (error) {
    console.error('[DEV API] ❌ Error switching development user:', error);
    throw error;
  }
});