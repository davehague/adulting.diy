import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectDocumentService } from "@/server/services/ProjectDocumentService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// A new tab cannot carry the Bearer token, so opening a document goes through a short-lived signed URL instead.
export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const documentId = event.context.params?.documentId;
    if (!projectId || !documentId) throw new HttpError('Project ID and document ID are required', 400);
    return await new ProjectDocumentService().link(householdId, projectId, documentId);
  } catch (error) {
    return toHttpError(error, 'linking project document');
  }
});
