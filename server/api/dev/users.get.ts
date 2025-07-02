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
  
  console.log('[DEV API] 🧪 Fetching development users');
  
  try {
    const users = await devAuthService.getUsers();
    console.log(`[DEV API] ✅ Returning ${users.length} development users`);
    return users;
  } catch (error) {
    console.error('[DEV API] ❌ Error fetching development users:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch development users'
    });
  }
});