import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectIngestService } from "@/server/services/ProjectIngestService";
import { MAX_PROJECT_INGEST_BATCH, projectIngestBatchSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const parsed = projectIngestBatchSchema.safeParse(await readBody(event));
    if (!parsed.success) {
      throw new HttpError(`Body must be { projects: [...] } with 1-${MAX_PROJECT_INGEST_BATCH} items`, 400);
    }
    return await new ProjectIngestService().ingestBatch(householdId, userId, parsed.data.projects);
  } catch (error) {
    return toHttpError(error, 'ingesting projects');
  }
});
