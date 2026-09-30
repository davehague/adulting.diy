import { readBody } from "h3";
import { ProviderCommentService } from "@/server/services/ProviderCommentService";
import { commentSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Provider ID is required', 400);
    const parsed = commentSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError('A non-empty comment body is required', 400);
    return await new ProviderCommentService().add(householdId, id, authUser.userId, parsed.data.body);
  } catch (error) {
    return toHttpError(error, 'adding provider comment');
  }
});
