import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectProviderService } from "@/server/services/ProjectProviderService";
import { projectProviderLinkSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = projectProviderLinkSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectProviderService().link(householdId, authUser.userId, projectId, parsed.data.providerId);
  } catch (error) {
    return toHttpError(error, 'linking provider to project');
  }
});
