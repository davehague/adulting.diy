import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { CategoryService } from "@/server/services/CategoryService";
import { toHttpError } from "@/server/utils/api-errors";

// Lets machine callers (the Worthington watcher) file new finds under the household's own
// admin-managed categories instead of inventing new ones. taskCategories is the vocabulary
// for POST /api/ingest/tasks; a name shared by a default and a household category appears once.
export default defineApiKeyProtectedEventHandler(async (_event, { householdId }) => {
  try {
    const [providerCategories, taskCategories] = await Promise.all([
      new ProviderCategoryService().listForHousehold(householdId),
      new CategoryService().findForHousehold(householdId),
    ]);
    return {
      categories: providerCategories.map((c) => c.name),
      taskCategories: [...new Set(taskCategories.map((c) => c.name))],
    };
  } catch (error) {
    return toHttpError(error, 'listing categories for ingest');
  }
});
