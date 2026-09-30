import { ProviderService } from "@/server/services/ProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Provider ID is required', 400);
    return await new ProviderService().findById(householdId, id);
  } catch (error) {
    return toHttpError(error, 'fetching provider');
  }
});
