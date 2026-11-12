import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectDocumentService } from "@/server/services/ProjectDocumentService";
import { documentUpdateSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    const documentId = event.context.params?.documentId;
    if (!projectId || !documentId) throw new HttpError('Project ID and document ID are required', 400);
    const parsed = documentUpdateSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectDocumentService().update(householdId, projectId, documentId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'updating project document');
  }
});
