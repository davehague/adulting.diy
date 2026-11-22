import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectIngestService } from "@/server/services/ProjectIngestService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// A repeat answers 404 because the project is already deleted; a retrying client can treat that as done.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    await new ProjectIngestService().remove(householdId, userId, projectId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting an ingest project');
  }
});
