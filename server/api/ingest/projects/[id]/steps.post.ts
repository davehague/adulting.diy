import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectStepIngestService } from "@/server/services/ProjectStepIngestService";
import { ingestStepBatchSchema, MAX_INGEST_STEP_BATCH } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Adds a batch of steps to an existing project. Safe to repeat: a retried batch skips every step it already added while they are still undone.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = ingestStepBatchSchema.safeParse(await readBody(event));
    if (!parsed.success) {
      throw new HttpError(`Body must be { steps: [...] } with 1-${MAX_INGEST_STEP_BATCH} items`, 400);
    }
    return await new ProjectStepIngestService().addBatch(householdId, userId, projectId, parsed.data.steps);
  } catch (error) {
    return toHttpError(error, 'ingesting project steps');
  }
});
