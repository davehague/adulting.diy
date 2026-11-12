import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectDocumentService } from "@/server/services/ProjectDocumentService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const documentId = event.context.params?.documentId;
    if (!projectId || !documentId) throw new HttpError('Project ID and document ID are required', 400);
    await new ProjectDocumentService().remove(householdId, projectId, documentId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting project document');
  }
});
