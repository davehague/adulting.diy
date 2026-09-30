import { TaskProviderService } from "@/server/services/TaskProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const taskId = event.context.params?.id;
    const providerId = event.context.params?.providerId;
    if (!taskId || !providerId) throw new HttpError('Task ID and provider ID are required', 400);
    await new TaskProviderService().unlink(householdId, taskId, providerId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'unlinking provider from task');
  }
});
