import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProjectProviderService().listForProject(householdId, projectId);
  } catch (error) {
    return toHttpError(error, 'listing project providers');
  }
});
