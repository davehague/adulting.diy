import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { readPhotoUpload } from "@/server/utils/photo-upload";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// One photo: the same form the browser sends (the script makes the thumbnail). Not safe to repeat: a retry adds a copy.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProjectFileIngestService().addPhoto(householdId, userId, projectId, await readPhotoUpload(event));
  } catch (error) {
    return toHttpError(error, 'ingesting a project photo');
  }
});
