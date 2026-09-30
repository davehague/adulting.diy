import { ProviderStatusService } from "@/server/services/ProviderStatusService";
import { toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (_event, _authUser, householdId) => {
  try {
    return await new ProviderStatusService().listForHousehold(householdId);
  } catch (error) {
    return toHttpError(error, 'listing provider statuses');
  }
});
