import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { readIngestPhotoUpload } from "@/server/utils/photo-upload";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// One photo: the same form the browser sends (the script makes the thumbnail). With a photoId form field a retry
// returns the stored photo instead of adding a copy; without one it is not safe to repeat.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const { upload, photoId } = await readIngestPhotoUpload(event);
    return await new ProjectFileIngestService().addPhoto(householdId, userId, projectId, upload, photoId);
  } catch (error) {
    return toHttpError(error, 'ingesting a project photo');
  }
});
