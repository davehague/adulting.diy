import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const providerId = event.context.params?.providerId;
    if (!projectId || !providerId) throw new HttpError('Project ID and provider ID are required', 400);
    return await new ProjectProviderService().unlink(householdId, projectId, providerId);
  } catch (error) {
    return toHttpError(error, 'unlinking provider from project');
  }
});
