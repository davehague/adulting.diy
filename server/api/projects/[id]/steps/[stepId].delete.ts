import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const stepId = event.context.params?.stepId;
    if (!projectId || !stepId) throw new HttpError('Project ID and step ID are required', 400);
    await new ProjectStepService().remove(householdId, projectId, stepId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting project step');
  }
});
