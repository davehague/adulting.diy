import { getRouterParam } from "h3";
import { ApiKeyService } from "@/server/services/ApiKeyService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

export default defineHouseholdAdminEventHandler(async (event, _authUser, householdId) => {
  try {
    const id = getRouterParam(event, 'id');
    if (!id) throw new HttpError('Missing API key id', 400);
    await new ApiKeyService().revoke(householdId, id);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'revoking API key');
  }
});
