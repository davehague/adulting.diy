import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { ingestUploadUrlSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Step 1 of 3 for a document: a URL the script PUTs the file to (straight to Blob, so files over 4.5 MB work).
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = ingestUploadUrlSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectFileIngestService().documentUploadUrl(householdId, userId, projectId, parsed.data.fileName);
  } catch (error) {
    return toHttpError(error, 'signing an ingest document upload');
  }
});
