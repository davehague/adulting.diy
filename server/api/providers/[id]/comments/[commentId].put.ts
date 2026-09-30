import { readBody } from "h3";
import { ProviderCommentService } from "@/server/services/ProviderCommentService";
import { commentSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const commentId = event.context.params?.commentId;
    if (!commentId) throw new HttpError('Comment ID is required', 400);
    const parsed = commentSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError('A non-empty comment body is required', 400);
    return await new ProviderCommentService().update(householdId, commentId, authUser.userId, parsed.data.body);
  } catch (error) {
    return toHttpError(error, 'updating provider comment');
  }
});
