import { TaskProviderService } from "@/server/services/TaskProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const taskId = event.context.params?.id;
    if (!taskId) throw new HttpError('Task ID is required', 400);
    return await new TaskProviderService().listForTask(householdId, taskId);
  } catch (error) {
    return toHttpError(error, 'listing task providers');
  }
});
