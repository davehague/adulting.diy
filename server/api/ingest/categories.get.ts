import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { toHttpError } from "@/server/utils/api-errors";

// Lets machine callers (the Worthington watcher) file new finds under the household's own
// admin-managed categories instead of inventing new ones.
export default defineApiKeyProtectedEventHandler(async (_event, { householdId }) => {
  try {
    const categories = await new ProviderCategoryService().listForHousehold(householdId);
    return { categories: categories.map((c) => c.name) };
  } catch (error) {
    return toHttpError(error, 'listing categories for ingest');
  }
});
