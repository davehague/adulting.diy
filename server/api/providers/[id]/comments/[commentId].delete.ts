import { ProviderCommentService } from "@/server/services/ProviderCommentService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const commentId = event.context.params?.commentId;
    if (!commentId) throw new HttpError('Comment ID is required', 400);
    await new ProviderCommentService().remove(householdId, commentId, authUser.userId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting provider comment');
  }
});
