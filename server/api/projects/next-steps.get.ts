import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (_event, _authUser, householdId) => {
  try {
    return await new ProjectStepService().nextSteps(householdId);
  } catch (error) {
    return toHttpError(error, 'listing project next steps');
  }
});
