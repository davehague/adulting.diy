import { readBody } from "h3";
import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { categoryInputSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Category ID is required', 400);
    const parsed = categoryInputSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError('Category name is required', 400);
    return await new ProviderCategoryService().rename(householdId, id, parsed.data.name);
  } catch (error) {
    return toHttpError(error, 'updating provider category');
  }
});
