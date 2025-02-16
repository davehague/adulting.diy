import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (!event.context.params?.id) {
    throw createError({
      statusCode: 400,
      message: "Missing organization ID",
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

  // GET - List members
  if (event.method === "GET") {
    return await organizationService.getOrganizationMembers(orgId);
  }

  throw createError({
    statusCode: 405,
    message: "Method not allowed",
  });
});
