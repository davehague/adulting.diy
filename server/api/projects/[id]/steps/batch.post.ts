import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { stepBatchSchema } from "@/server/utils/plan-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = stepBatchSchema.safeParse((await readBody(event)) ?? {});
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectStepService().addMany(householdId, authUser.userId, projectId, parsed.data.steps);
  } catch (error) {
    return toHttpError(error, 'adding project steps');
  }
});
