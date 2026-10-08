import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectChatService } from "@/server/services/ProjectChatService";
import { parseChatSendInput } from "@/server/utils/chat-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const input = parseChatSendInput(await readBody(event));
    return await new ProjectChatService().send(householdId, authUser.userId, projectId, input);
  } catch (error) {
    return toHttpError(error, 'sending a chat message');
  }
});
