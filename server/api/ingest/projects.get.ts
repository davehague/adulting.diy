import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProjectFileIngestService } from "@/server/services/ProjectFileIngestService";
import { toHttpError } from "@/server/utils/api-errors";

// So a script can find the project to attach a file to. Read-only, like GET /api/ingest/categories.
export default defineApiKeyProtectedEventHandler(async (_event, { householdId }) => {
  try {
    return { projects: await new ProjectFileIngestService().listProjects(householdId) };
  } catch (error) {
    return toHttpError(error, 'listing projects for ingest');
  }
});
