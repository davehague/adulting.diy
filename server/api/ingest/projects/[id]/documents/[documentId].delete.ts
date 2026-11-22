import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Deletes a document and its file. A repeat answers 404, which a retrying caller treats as done.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    const documentId = event.context.params?.documentId;
    if (!projectId || !documentId) throw new HttpError('Project ID and document ID are required', 400);
    await new ProjectFileIngestService().removeDocument(householdId, userId, projectId, documentId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting an ingest document');
  }
});
