import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPhotoService } from "@/server/services/ProjectPhotoService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const photoId = event.context.params?.photoId;
    if (!projectId || !photoId) throw new HttpError('Project ID and photo ID are required', 400);
    await new ProjectPhotoService().remove(householdId, projectId, photoId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting project photo');
  }
});
