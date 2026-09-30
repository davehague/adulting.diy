import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (_event, _authUser, householdId) => {
  try {
    return await new ProviderCategoryService().listForHousehold(householdId);
  } catch (error) {
    return toHttpError(error, 'listing provider categories');
  }
});
