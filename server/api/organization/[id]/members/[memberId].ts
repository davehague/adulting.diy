import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import type { OrganizationMember } from "~/types";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  try {
    if (!event.context.params?.id || !event.context.params?.memberId) {
      throw createError({
        statusCode: 400,
        message: "Missing required parameters",
      });
    }

    const orgId = event.context.params.id;
    const memberId = event.context.params.memberId;

    // Verify user has admin access
    const hasAdminAccess = await organizationService.verifyAdminAccess(
      orgId,
      authenticatedUser.email
    );

    if (!hasAdminAccess) {
      throw createError({
        statusCode: 403,
        message: "Forbidden: Admin access required",
      });
    }

    // PATCH - Update member role
    if (event.method === "PATCH") {
      const body = await readBody<{ role: OrganizationMember["role"] }>(event);
      const updated = await organizationService.updateMemberRole(
        orgId,
        memberId,
        body.role
      );
      return updated;
    }

    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  } catch (error: any) {
    console.error(
      `[API] Error in /organization/[id]/members/[memberId]:`,
      error
    );
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to update member role",
    });
  }
});
