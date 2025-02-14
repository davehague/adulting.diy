import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import type { Organization, CreateOrganizationDTO } from "@/types/interfaces";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  try {
    // GET requests handling
    if (event.method === "GET") {
      // GET /api/database/organizations/current
      if (event.path.endsWith("/current")) {
        const result = await organizationService.findByUserEmail(
          authenticatedUser.email
        );
        if (!result) {
          throw createError({
            statusCode: 404,
            message: "No organization found",
          });
        }
        return result;
      }

      // GET /api/database/organizations/:id
      const orgId = event.path.split("/").pop();
      if (orgId && orgId !== "current") {
        // First verify user has access to this organization
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

        const org = await organizationService.findById(orgId);
        if (!org) {
          throw createError({
            statusCode: 404,
            message: "Organization not found",
          });
        }
        return org;
      }
    }

    // POST - Create organization
    if (event.method === "POST") {
      const body = await readBody<CreateOrganizationDTO>(event);
      return await organizationService.create(body, authenticatedUser.email);
    }

    // PATCH - Update organization
    if (event.method === "PATCH") {
      const body = await readBody<Partial<Organization>>(event);
      if (!body.id) {
        throw createError({
          statusCode: 400,
          message: "Organization ID is required",
        });
      }

      // Verify user has admin access to this organization
      const hasAdminAccess = await organizationService.verifyAdminAccess(
        body.id,
        authenticatedUser.email
      );
      if (!hasAdminAccess) {
        throw createError({
          statusCode: 403,
          message: "Forbidden: Admin access required",
        });
      }

      return await organizationService.update(body.id, body);
    }

    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  } catch (error: any) {
    console.error(`[API] Error in /organizations:`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message,
    });
  }
});
