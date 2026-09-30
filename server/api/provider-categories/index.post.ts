import { readBody } from "h3";
import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { categoryInputSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const parsed = categoryInputSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError('Category name is required', 400);
    return await new ProviderCategoryService().create(householdId, parsed.data.name);
  } catch (error) {
    return toHttpError(error, 'creating provider category');
  }
});
