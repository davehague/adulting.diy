import { H3Event, createError, getHeader } from "h3";
import { OAuth2Client } from "google-auth-library";
import { UserService } from "@/server/services/UserService";

const client = new OAuth2Client(process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID);

interface AuthenticatedUser {
  email: string;
  userId: string;
  householdId: string | null;
}

const userService = new UserService();

export async function verifyAuth(event: H3Event): Promise<AuthenticatedUser> {
  const authHeader = getHeader(event, "Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized: Missing token",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.email_verified) {
      throw new Error("Invalid token payload");
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error("Token has expired");
    }

    if (
      payload.iss !== "accounts.google.com" &&
      payload.iss !== "https://accounts.google.com"
    ) {
      throw new Error("Invalid token issuer");
    }

    // Get user from database
    const user = await userService.findByEmail(payload.email);
    if (!user) {
      throw createError({
        statusCode: 404,
        message: "User not found",
      });
    }

    return {
      email: payload.email,
      userId: user.id,
      householdId: user.householdId || null,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    throw createError({
      statusCode: 401,
      message: "Unauthorized: Invalid token",
    });
  }
}

// Helper to verify user can access requested resource
export function verifyUserAccess(
  authenticatedEmail: string,
  requestedEmail: string
) {
  if (authenticatedEmail !== requestedEmail) {
    throw createError({
      statusCode: 403,
      message: "Forbidden: Unauthorized access",
    });
  }
}

// Helper to verify user belongs to a household
export function verifyHouseholdAccess(householdId: string | null) {
  if (!householdId) {
    throw createError({
      statusCode: 403,
      message: "You need to be part of a household to access this resource",
    });
  }
  return householdId;
}

// Optional: Create a wrapper for protected routes
export function defineProtectedEventHandler(
  handler: (
    event: H3Event,
    authenticatedUser: AuthenticatedUser
  ) => Promise<any>
) {
  return defineEventHandler(async (event: H3Event) => {
    const authenticatedUser = await verifyAuth(event);
    return handler(event, authenticatedUser);
  });
}

// Optional: Create a wrapper for household-protected routes
export function defineHouseholdProtectedEventHandler(
  handler: (
    event: H3Event,
    authenticatedUser: AuthenticatedUser,
    householdId: string
  ) => Promise<any>
) {
  return defineEventHandler(async (event: H3Event) => {
    const authenticatedUser = await verifyAuth(event);
    const householdId = verifyHouseholdAccess(authenticatedUser.householdId);
    return handler(event, authenticatedUser, householdId);
  });
}
