import { readBody } from "h3";
import { ProviderStatusService } from "@/server/services/ProviderStatusService";
import { reorderSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const parsed = reorderSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError('orderedIds is required', 400);
    await new ProviderStatusService().reorder(householdId, parsed.data.orderedIds);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'reordering provider statuses');
  }
});
