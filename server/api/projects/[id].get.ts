import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Project ID is required', 400);
    return await new ProjectService().get(householdId, id);
  } catch (error) {
    return toHttpError(error, 'loading project');
  }
});
