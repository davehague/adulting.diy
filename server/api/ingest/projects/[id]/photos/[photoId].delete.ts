import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Deletes a photo and its files. A repeat answers 404, which a retrying caller treats as done.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    const photoId = event.context.params?.photoId;
    if (!projectId || !photoId) throw new HttpError('Project ID and photo ID are required', 400);
    await new ProjectFileIngestService().removePhoto(householdId, userId, projectId, photoId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting an ingest photo');
  }
});
