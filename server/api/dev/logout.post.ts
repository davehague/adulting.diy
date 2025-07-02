export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  // Security check: only work in development with bypass enabled
  if (!config.devBypassEnabled) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    });
  }
  
  console.log('[DEV API] 🧪 Logging out development user');
  
  // Clear development user cookie
  deleteCookie(event, 'dev-user-id');
  
  console.log('[DEV API] ✅ Successfully logged out development user');
  
  return { success: true };
});