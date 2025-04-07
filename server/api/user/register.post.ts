import { defineEventHandler, readBody, createError } from "h3";
import { UserService } from "@/server/services/UserService";
import type { UserRegistrationData } from "@/types"; // Import correct type

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Validate required fields
    if (!body.email || !body.name) {
      throw createError({
        statusCode: 400,
        message: "Email and name are required",
      });
    }

    // Construct GoogleUser object from request body
    const googleUser: UserRegistrationData = {
      // Use internal camelCase type
      email: body.email,
      emailVerified: body.emailVerified || false, // Use camelCase key
      name: body.name,
      picture: body.picture,
      givenName: body.givenName || "", // Use camelCase key
      familyName: body.familyName || "", // Use camelCase key
      locale: body.locale || "en",
    };

    const userService = new UserService();
    const user = await userService.createFromGoogle(googleUser);

    return user;
  } catch (error) {
    console.error("[API] Error registering user:", error);

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
