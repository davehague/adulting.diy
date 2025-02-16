import { UserService } from "@/server/services/UserService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import type { User } from "~/types";

const userService = new UserService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (!event.context.params?.id) {
    throw createError({
      statusCode: 400,
      message: "Missing user ID parameter",
    });
  }
  const userId = event.context.params.id;

  try {
    // Verify user exists and check authorization
    const userToUpdate = await userService.findByEmail(authenticatedUser.email);

    if (!userToUpdate) {
      throw createError({
        statusCode: 404,
        message: "User not found",
      });
    }

    // Verify user is updating their own profile
    if (userToUpdate.id !== userId) {
      throw createError({
        statusCode: 403,
        message: "Forbidden: Can only update your own profile",
      });
    }

    // PATCH - Update user
    if (event.method === "PATCH") {
      const body = await readBody<Partial<User>>(event);

      // Don't allow updating sensitive fields
      delete body.email;
      delete body.id;

      const updated = await userService.update(userId, body);
      return updated;
    }

    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error; // Re-throw if it's already a createError

    throw createError({
      statusCode: 500,
      message: "Failed to update user",
    });
  }
});
