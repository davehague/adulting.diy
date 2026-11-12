import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectDocumentService } from "@/server/services/ProjectDocumentService";
import { handlePresignedUpload } from "@/server/utils/blob-storage";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// The browser's uploadPresigned asks here for a URL that writes one exact Blob path. The file itself never comes through
// this function, so Vercel's 4.5 MB request cap does not apply to documents.
export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const service = new ProjectDocumentService();
    return await handlePresignedUpload(await readBody(event), event.node.req, (pathname) =>
      service.authorizeUpload(householdId, projectId, pathname),
    );
  } catch (error) {
    return toHttpError(error, 'signing a project document upload');
  }
});
