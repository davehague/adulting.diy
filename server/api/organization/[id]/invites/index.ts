import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import type { OrganizationInvite } from "~/types";

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

    // Verify user has access to this organization
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

    // GET - List invites
    if (event.method === "GET") {
      const status = getQuery(event).status as
        | OrganizationInvite["status"]
        | undefined;
      return await organizationService.getInvites(orgId, status);
    }

    // POST - Create invite
    if (event.method === "POST") {
      const body = await readBody<{
        email: string;
        role: OrganizationInvite["role"];
      }>(event);

      return await organizationService.createInvite(
        orgId,
        body.email,
        body.role,
        authenticatedUser.email
      );
    }

    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  } catch (error: any) {
    console.error(`[API] Error in /organization/[id]/invites:`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to process invite request",
    });
  }
});
