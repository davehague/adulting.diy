import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  try {
    if (!event.context?.params?.id) {
      throw createError({
        statusCode: 400,
        message: "Missing invite ID parameter",
      });
    }
    const inviteId = event.context.params.id;

    // DELETE - Cancel invite
    if (event.method === "DELETE") {
      await organizationService.cancelInvite(inviteId, authenticatedUser.email);
      return { success: true };
    }

    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  } catch (error: any) {
    console.error(`[API] Error in /organization/invite/[id]:`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to process invite request",
    });
  }
});
