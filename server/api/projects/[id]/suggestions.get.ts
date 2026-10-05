import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProviderSuggestionService } from "@/server/services/ProviderSuggestionService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProviderSuggestionService().getState(householdId, projectId);
  } catch (error) {
    return toHttpError(error, 'reading provider suggestions');
  }
});
