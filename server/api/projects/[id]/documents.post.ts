import { readBody } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectDocumentService } from "@/server/services/ProjectDocumentService";
import { documentRegisterSchema } from "@/server/utils/project-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Called after the browser's direct upload to Blob finished: saves the document once the stored file checks out.
export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  try {
    const projectId = event.context.params?.id;
    if (!projectId) throw new HttpError('Project ID is required', 400);
    const parsed = documentRegisterSchema.safeParse(await readBody(event));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
    return await new ProjectDocumentService().register(householdId, projectId, authUser.userId, parsed.data);
  } catch (error) {
    return toHttpError(error, 'registering project document');
  }
});
