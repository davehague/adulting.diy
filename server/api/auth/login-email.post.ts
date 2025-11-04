import { defineEventHandler, readBody, createError } from "h3";
import { UserService } from "@/server/services/UserService";
import { generateToken } from "@/server/utils/jwt";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Validate required fields
    if (!body.email || !body.password) {
      throw createError({
        statusCode: 400,
        message: "Email and password are required",
      });
    }

    const userService = new UserService();

    try {
      const user = await userService.authenticateWithEmail(
        body.email,
        body.password
      );

      if (!user) {
        throw createError({
          statusCode: 401,
          message: "Invalid email or password",
        });
      }

      // Generate JWT token
      const token = generateToken(user.id, user.email);

      // Don't return the password in the response
      const { password, ...userWithoutPassword } = user;

      return {
        success: true,
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("different authentication method")) {
          throw createError({
            statusCode: 400,
            message: error.message,
          });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("[API] Error logging in with email:", error);

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
