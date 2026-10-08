import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectChatService } from "@/server/services/ProjectChatService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProjectChatService().getState(householdId, authUser.userId, projectId);
  } catch (error) {
    return toHttpError(error, 'reading the chat');
  }
});
