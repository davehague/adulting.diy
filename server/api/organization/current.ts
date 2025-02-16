import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  try {
    const result = await organizationService.findByUserEmail(
      authenticatedUser.email
    );

    if (!result) {
      return null;
    }

    return result.organization;
  } catch (error: any) {
    console.error(`[API] Error in /organization/current:`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch current organization",
    });
  }
});
