import { H3Event, createError, getHeader, getCookie } from "h3";
import { OAuth2Client } from "google-auth-library";
import { UserService } from "@/server/services/UserService";
import { devAuthService } from "@/server/utils/dev-auth";
import { verifyToken } from "@/server/utils/jwt";

const client = new OAuth2Client(process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID);

interface AuthenticatedUser {
  email: string;
  userId: string;
  householdId: string | null;
}

const userService = new UserService();

export async function verifyAuth(event: H3Event): Promise<AuthenticatedUser> {
  // Check for development bypass first
  if (devAuthService.isDevBypassEnabled()) {
    const devUserId = getCookie(event, 'dev-user-id') || getHeader(event, 'x-dev-user-id');
    
    if (devUserId) {
      console.log(`[DEV BYPASS] 🧪 Using development user: ${devUserId}`);
      const devUser = await devAuthService.getUserById(devUserId);
      
      if (devUser) {
        return {
          email: devUser.email,
          userId: devUser.id,
          householdId: devUser.householdId || null,
        };
      } else {
        console.log(`[DEV BYPASS] ⚠️ Development user not found: ${devUserId}`);
      }
    }
  }

  const authHeader = getHeader(event, "Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized: Missing token",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    // Try to verify as JWT token first (for email authentication)
    const jwtPayload = verifyToken(token);

    if (jwtPayload && jwtPayload.authProvider === 'email') {
      // Email authentication flow
      const user = await userService.findByEmail(jwtPayload.email);
      if (!user) {
        throw createError({
          statusCode: 404,
          message: "User not found",
        });
      }

      return {
        email: jwtPayload.email,
        userId: user.id,
        householdId: user.householdId || null,
      };
    }

    // If not a valid JWT, try to verify as Google token
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
