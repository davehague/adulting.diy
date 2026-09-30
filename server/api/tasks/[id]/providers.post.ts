import { readBody } from "h3";
import { z } from "zod";
import { TaskProviderService } from "@/server/services/TaskProviderService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";

const linkSchema = z.object({ providerId: z.string().min(1) });

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const taskId = event.context.params?.id;
    if (!taskId) throw new HttpError('Task ID is required', 400);
    const parsed = linkSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    await new TaskProviderService().link(householdId, taskId, parsed.data.providerId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'linking provider to task');
  }
});
