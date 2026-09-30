import { readBody } from "h3";
import { ProviderStatusService } from "@/server/services/ProviderStatusService";
import { statusInputSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const parsed = statusInputSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProviderStatusService().create(householdId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'creating provider status');
  }
});
