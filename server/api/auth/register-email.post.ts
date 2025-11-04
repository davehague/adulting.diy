import { defineEventHandler, readBody, createError } from "h3";
import { UserService } from "@/server/services/UserService";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Validate required fields
    if (!body.email || !body.password || !body.name) {
      throw createError({
        statusCode: 400,
        message: "Email, password, and name are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw createError({
        statusCode: 400,
        message: "Invalid email format",
      });
    }

    const userService = new UserService();

    try {
      const user = await userService.createWithEmail(
        body.email,
        body.password,
        body.name
      );

      // Don't return the password in the response
      const { password, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("already exists")) {
          throw createError({
            statusCode: 409,
            message: error.message,
          });
        }
        if (error.message.includes("Password must")) {
          throw createError({
            statusCode: 400,
            message: error.message,
          });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("[API] Error registering user with email:", error);

    if ((error as any).statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: "Server error",
      cause: error,
    });
  }
});
