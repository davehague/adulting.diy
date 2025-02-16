import { OrganizationService } from "@/server/services/OrganizationService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import type { CreateOrganizationDTO } from "~/types";

const organizationService = new OrganizationService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  try {
    const body = await readBody<CreateOrganizationDTO>(event);
    const organization = await organizationService.create(
      body,
      authenticatedUser.email
    );

    return organization;
  } catch (error: any) {
    console.error(`[API] Error in /organization/create:`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to create organization",
    });
  }
});
