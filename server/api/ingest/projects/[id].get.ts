import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectIngestService } from "@/server/services/ProjectIngestService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Read-only, so a retry is always safe.
export default defineApiKeyProtectedEventHandler(async (event, { householdId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProjectIngestService().getDetail(householdId, projectId);
  } catch (error) {
    return toHttpError(error, 'loading an ingest project');
  }
});
