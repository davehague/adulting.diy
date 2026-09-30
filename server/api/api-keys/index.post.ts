import { readBody } from "h3";
import { z } from "zod";
import { ApiKeyService } from "@/server/services/ApiKeyService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdAdminEventHandler } from "@/server/utils/auth";

const bodySchema = z.object({ name: z.string().trim().min(1).max(100) });

export default defineHouseholdAdminEventHandler(async (event, authUser, householdId) => {
  try {
    const parsed = bodySchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    // The response includes the plaintext key; it cannot be retrieved again.
    return await new ApiKeyService().create(householdId, authUser.userId, parsed.data.name);
  } catch (error) {
    return toHttpError(error, 'creating API key');
  }
});
