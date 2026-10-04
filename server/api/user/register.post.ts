import { defineEventHandler, readBody, createError } from "h3";
import { UserService } from "@/server/services/UserService";
import { verifyIdentity } from "@/server/utils/auth";
import type { UserRegistrationData } from "@/types"; // Import correct type

export default defineEventHandler(async (event) => {
  try {
    // The email always comes from the verified token, never from the body.
    const identity = await verifyIdentity(event);
    const body = await readBody(event);

    const name = identity.name || body.name;
    if (!name) {
      throw createError({
        statusCode: 400,
        message: "Name is required",
      });
    }

    const googleUser: UserRegistrationData = {
      email: identity.email,
      emailVerified: true, // verifyIdentity only accepts verified emails
      name,
      picture: identity.picture || body.picture,
      givenName: identity.givenName || body.givenName || "",
      familyName: identity.familyName || body.familyName || "",
      locale: identity.locale || body.locale || "en",
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
