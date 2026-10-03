import { readMultipartFormData } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPhotoService } from "@/server/services/ProjectPhotoService";
import { photoDimensionsSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);

    const parts = (await readMultipartFormData(event)) ?? [];
    const part = (name: string) => parts.find((p) => p.name === name);
    const full = part('full')?.data;
    const thumb = part('thumb')?.data;
    if (!full || !thumb) throw new HttpError('Both the photo and its thumbnail are required', 400);

    const dimensions = photoDimensionsSchema.safeParse({
      width: part('width')?.data.toString('utf8'),
      height: part('height')?.data.toString('utf8'),
    });
    if (!dimensions.success) throw new HttpError('Photo width and height are required', 400);

    return await new ProjectPhotoService().add(householdId, projectId, authUser.userId, {
      full,
      thumb,
      width: dimensions.data.width,
      height: dimensions.data.height,
    });
  } catch (error) {
    return toHttpError(error, 'uploading project photo');
  }
});
