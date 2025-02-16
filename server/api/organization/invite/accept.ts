import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  try {
    if (event.method !== "POST") {
      throw createError({
        statusCode: 405,
        message: "Method not allowed",
      });
    }

    const { token } = await readBody(event);

    const result = await organizationService.acceptInvite(
      token,
      authenticatedUser.email
    );
    return result;
  } catch (error: any) {
    console.error(`[API] Error in /organization/invite/accept:`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to accept organization invite",
    });
  }
});
