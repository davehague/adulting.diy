import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProviderSuggestionService } from "@/server/services/ProviderSuggestionService";
import { suggestionRequestSchema } from "@/server/utils/suggestion-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    // The box is optional, so the request may have no body.
    const parsed = suggestionRequestSchema.safeParse((await readBody(event)) ?? {});
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProviderSuggestionService().run(householdId, authUser.userId, projectId, parsed.data.extraText);
  } catch (error) {
    return toHttpError(error, 'suggesting providers');
  }
});
