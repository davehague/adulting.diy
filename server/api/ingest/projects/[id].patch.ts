import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectIngestService } from "@/server/services/ProjectIngestService";
import { ingestProjectUpdateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Safe to repeat: fields are set, and a notesAppend paragraph that is already the last one is not added again.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = ingestProjectUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectIngestService().update(householdId, userId, projectId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating an ingest project');
  }
});
