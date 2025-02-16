import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import type { Organization } from "~/types";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  try {
    if (!event.context.params?.id) {
      throw createError({
        statusCode: 400,
        message: "Organization ID is required",
      });
    }
    const orgId = event.context.params.id;

    // Verify access for all operations
    const hasAccess = await organizationService.verifyMemberAccess(
      orgId,
      authenticatedUser.email
    );

    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: "Forbidden: Unauthorized access to organization",
      });
    }

    // GET request
    if (event.method === "GET") {
      const org = await organizationService.findById(orgId);
      if (!org) {
        throw createError({
          statusCode: 404,
          message: "Organization not found",
        });
      }
      return org;
    }

    // PATCH request
    if (event.method === "PATCH") {
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

      const body = await readBody<Partial<Organization>>(event);
      return await organizationService.update(orgId, body);
    }

    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  } catch (error: any) {
    console.error(`[API] Error in /organization/[id]:`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to process organization request",
    });
  }
});
