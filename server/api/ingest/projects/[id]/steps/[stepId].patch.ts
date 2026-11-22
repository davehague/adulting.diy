import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectStepIngestService } from "@/server/services/ProjectStepIngestService";
import { ingestStepUpdateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Edits or checks off one step. Safe to repeat: fields are set, and done: true keeps the first doneAt.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    const stepId = event.context.params?.stepId;
    if (!projectId || !stepId) throw new HttpError('Project ID and step ID are required', 400);
    const parsed = ingestStepUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
    return await new ProjectStepIngestService().update(householdId, userId, projectId, stepId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating an ingest project step');
  }
});
