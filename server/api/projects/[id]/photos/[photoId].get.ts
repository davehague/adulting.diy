import { getHeader, getQuery, sendNoContent, setResponseHeader } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectPhotoService } from "@/server/services/ProjectPhotoService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";
import { type PhotoVariant } from "@/types/project";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const photoId = event.context.params?.photoId;
    if (!projectId || !photoId) throw new HttpError('Project ID and photo ID are required', 400);

    const variant: PhotoVariant = getQuery(event).variant === 'thumb' ? 'thumb' : 'full';
    const result = await new ProjectPhotoService().read(
      householdId, projectId, photoId, variant, getHeader(event, 'if-none-match') ?? undefined,
    );

    // The auth check above runs on every request; 'private, no-cache' lets the browser keep the bytes but always revalidate.
    setResponseHeader(event, 'Cache-Control', 'private, no-cache');
    setResponseHeader(event, 'ETag', result.etag);
    if (result.statusCode === 304 || !result.stream) return sendNoContent(event, 304);

    setResponseHeader(event, 'Content-Type', 'image/jpeg');
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
    return result.stream;
  } catch (error) {
    return toHttpError(error, 'loading project photo');
  }
});
