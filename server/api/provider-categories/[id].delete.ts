import { readBody } from "h3";
import { ProviderCategoryService } from "@/server/services/ProviderCategoryService";
import { deleteWithMoveSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Category ID is required', 400);
    const body = (await readBody(event).catch(() => ({}))) ?? {};
    const parsed = deleteWithMoveSchema.safeParse(body);
    if (!parsed.success) throw new HttpError('Invalid request body', 400);
    await new ProviderCategoryService().remove(householdId, id, parsed.data.moveToId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting provider category');
  }
});
