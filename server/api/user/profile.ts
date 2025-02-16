import { UserService } from "@/server/services/UserService";
import { defineProtectedEventHandler } from "@/server/utils/auth";

const userService = new UserService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (event.method !== "GET") {
    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  }

  const { email } = getQuery(event);

  if (!email) {
    throw createError({
      statusCode: 400,
      message: "Email parameter is required",
    });
  }

  // Only allow users to fetch their own profile
  if (email !== authenticatedUser.email) {
    throw createError({
      statusCode: 403,
      message: "Forbidden: Unauthorized access",
    });
  }

  try {
    const user = await userService.findByEmail(email);
    if (!user) {
      throw createError({
        statusCode: 404,
        message: "User not found",
      });
    }
    return user;
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch user profile",
    });
  }
});
