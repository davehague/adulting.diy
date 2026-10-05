import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { projectProviderStatusSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const providerId = event.context.params?.providerId;
    if (!projectId || !providerId) throw new HttpError('Project ID and provider ID are required', 400);
    const parsed = projectProviderStatusSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectProviderService().setStatus(householdId, projectId, providerId, parsed.data.status);
  } catch (error) {
    return toHttpError(error, 'updating project provider status');
  }
});
