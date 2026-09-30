import { readBody } from "h3";
import { ProviderContactService } from "@/server/services/ProviderContactService";
import { contactSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const contactId = event.context.params?.contactId;
    if (!contactId) throw new HttpError('Contact ID is required', 400);
    const parsed = contactSchema.partial().safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProviderContactService().update(householdId, contactId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating provider contact');
  }
});
