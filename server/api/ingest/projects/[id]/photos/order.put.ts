import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { ingestPhotoOrderSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Sets the photo order: photoIds lists every photo of the project once, and the first becomes the cover. Safe to repeat.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = ingestPhotoOrderSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    const photos = await new ProjectFileIngestService().reorderPhotos(householdId, userId, projectId, parsed.data.photoIds);
    return { photos };
  } catch (error) {
    return toHttpError(error, 'ordering ingest photos');
  }
});
