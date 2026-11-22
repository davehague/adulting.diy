import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { ingestDocumentUpdateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Renames a document or changes its note; a blank note clears it. Safe to repeat.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    const documentId = event.context.params?.documentId;
    if (!projectId || !documentId) throw new HttpError('Project ID and document ID are required', 400);
    const parsed = ingestDocumentUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectFileIngestService().updateDocument(householdId, userId, projectId, documentId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating an ingest document');
  }
});
