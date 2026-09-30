import { ApiKeyService } from "@/server/services/ApiKeyService";
import { toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

export default defineHouseholdAdminEventHandler(async (_event, _authUser, householdId) => {
  try {
    return await new ApiKeyService().list(householdId);
  } catch (error) {
    return toHttpError(error, 'listing API keys');
  }
});
