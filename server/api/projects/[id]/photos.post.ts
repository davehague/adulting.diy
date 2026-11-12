import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPhotoService } from "@/server/services/ProjectPhotoService";
import { readPhotoUpload } from "@/server/utils/photo-upload";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    return await new ProjectPhotoService().add(householdId, projectId, authUser.userId, await readPhotoUpload(event));
  } catch (error) {
    return toHttpError(error, 'uploading project photo');
  }
});
