import { UserService } from "@/server/services/UserService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import type { GoogleUser } from "~/types";

const userService = new UserService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (event.method !== "POST") {
    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  }

  const body = await readBody<GoogleUser>(event);

  // Ensure users can only register themselves
  if (body.email !== authenticatedUser.email) {
    throw createError({
      statusCode: 403,
      message: "Forbidden: Can only register your own account",
    });
  }

  return await userService.createFromGoogle(body);
});
