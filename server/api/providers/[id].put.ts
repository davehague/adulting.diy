import { readBody } from "h3";
import { ProviderService } from "@/server/services/ProviderService";
import { providerUpdateSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = event.context.params?.id;
    if (!id) throw new HttpError('Provider ID is required', 400);
    const parsed = providerUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProviderService().update(householdId, id, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating provider');
  }
});
