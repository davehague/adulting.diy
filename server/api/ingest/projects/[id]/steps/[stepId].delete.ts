import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectStepIngestService } from "@/server/services/ProjectStepIngestService";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

// Removes one step. The first call answers { success: true } and a repeat answers 404, which a retrying client treats as done.
export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const projectId = event.context.params?.id;
    const stepId = event.context.params?.stepId;
    if (!projectId || !stepId) throw new HttpError('Project ID and step ID are required', 400);
    await new ProjectStepIngestService().remove(householdId, userId, projectId, stepId);
    return { success: true };
  } catch (error) {
    return toHttpError(error, 'deleting an ingest project step');
  }
});
