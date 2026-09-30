import { readBody } from "h3";
import { ProviderService } from "@/server/services/ProviderService";
import { providerInputSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const parsed = providerInputSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProviderService().create(householdId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'creating provider');
  }
});
