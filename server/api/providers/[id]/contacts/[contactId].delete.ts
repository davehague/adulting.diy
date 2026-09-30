import { ProviderContactService } from "@/server/services/ProviderContactService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const contactId = event.context.params?.contactId;
    if (!contactId) throw new HttpError('Contact ID is required', 400);
    await new ProviderContactService().remove(householdId, contactId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting provider contact');
  }
});
