import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPlanService } from "@/server/services/ProjectPlanService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProjectPlanService().getState(householdId, projectId);
  } catch (error) {
    return toHttpError(error, 'reading the DIY plan');
  }
});
