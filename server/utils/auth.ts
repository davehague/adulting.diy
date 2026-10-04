import { H3Event, createError, getHeader, getCookie } from "h3";
import { OAuth2Client } from "google-auth-library";
import { UserService } from "@/server/services/UserService";
import { devAuthService } from "@/server/utils/dev-auth";
import { assertHouseholdAdmin } from "@/server/utils/admin";
import { toHttpError } from "@/server/utils/api-errors";

const client = new OAuth2Client(process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID);

interface AuthenticatedUser {
  email: string;
  userId: string;
  householdId: string | null;
}

const userService = new UserService();

/**
 * What a verified sign-in proves about the caller. Unlike AuthenticatedUser it does not
 * need a User row, so it also serves the routes that run before registration.
 */
export interface VerifiedIdentity {
  email: string;
  name?: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
  locale?: string;
}

// Development bypass: the dev-user-id cookie/header, honoured only when the bypass is enabled.
async function getDevBypassUser(event: H3Event) {
  if (!devAuthService.isDevBypassEnabled()) return null;

  const devUserId = getCookie(event, 'dev-user-id') || getHeader(event, 'x-dev-user-id');
  if (!devUserId) return null;

  console.log(`[DEV BYPASS] 🧪 Using development user: ${devUserId}`);
  const devUser = await devAuthService.getUserById(devUserId);
  if (!devUser) {
    console.log(`[DEV BYPASS] ⚠️ Development user not found: ${devUserId}`);
  }
  return devUser;
}

/**
 * Verify the Google ID token on the request (signature, audience, verified email, expiry,
 * issuer). Throws 401 on any failure. Does not look up or require a User row.
 */
export async function verifyGoogleIdentity(event: H3Event): Promise<VerifiedIdentity> {
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

    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      givenName: payload.given_name,
      familyName: payload.family_name,
      locale: payload.locale,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    throw createError({
      statusCode: 401,
      message: "Unauthorized: Invalid token",
    });
  }
}

/**
 * Identity of the caller without requiring a User row: the dev bypass user when the bypass
 * is enabled, otherwise the verified Google token. For routes that run before registration.
 */
export async function verifyIdentity(event: H3Event): Promise<VerifiedIdentity> {
  const devUser = await getDevBypassUser(event);
  if (devUser) {
    return {
      email: devUser.email,
      name: devUser.name,
      picture: devUser.picture ?? undefined,
    };
  }

  return verifyGoogleIdentity(event);
}

export async function verifyAuth(event: H3Event): Promise<AuthenticatedUser> {
  const devUser = await getDevBypassUser(event);
  if (devUser) {
    return {
      email: devUser.email,
      userId: devUser.id,
      householdId: devUser.householdId || null,
    };
  }

  const identity = await verifyGoogleIdentity(event);

  // Any failure to resolve the user row is reported as 401, as it always has been.
  try {
    const user = await userService.findByEmail(identity.email);
    if (!user) {
      throw new Error("User not found");
    }

    return {
      email: identity.email,
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

/**
 * Protect scheduler/internal endpoints with CRON_SECRET authentication.
 * Checks Authorization Bearer token against CRON_SECRET env var.
 * Used by Vercel Cron Jobs and internal server-to-server calls.
 */
export function defineSchedulerProtectedEventHandler(
  handler: (event: H3Event) => Promise<any>
) {
  return defineEventHandler(async (event: H3Event) => {
    const bearerToken = getHeader(event, 'authorization')?.replace('Bearer ', '');
    const expectedCronSecret = process.env.CRON_SECRET;

    if (!expectedCronSecret) {
      console.error('[Auth] CRON_SECRET not configured');
      throw createError({
        statusCode: 500,
        message: 'Server configuration error',
      });
    }

    if (!bearerToken || bearerToken !== expectedCronSecret) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized: Invalid or missing API key',
      });
    }

    return handler(event);
  });
}

// Wrapper for household routes that only admins may call
export function defineHouseholdAdminEventHandler(
  handler: (
    event: H3Event,
    authenticatedUser: AuthenticatedUser,
    householdId: string
  ) => Promise<any>
) {
  return defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
    try {
      await assertHouseholdAdmin(authUser.userId, householdId);
    } catch (error) {
      toHttpError(error, 'admin check');
    }
    return handler(event, authUser, householdId);
  });
}
