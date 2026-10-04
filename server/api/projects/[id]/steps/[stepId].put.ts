import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectStepService } from "@/server/services/ProjectStepService";
import { stepUpdateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const stepId = event.context.params?.stepId;
    if (!projectId || !stepId) throw new HttpError('Project ID and step ID are required', 400);
    const parsed = stepUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectStepService().update(householdId, projectId, stepId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating project step');
  }
});
