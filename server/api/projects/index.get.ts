import { getQuery } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProjectService } from "@/server/services/ProjectService";
import { parsePathFilter, parseStatusFilter } from "@/server/utils/project-schemas";
import { toHttpError } from "@/server/utils/api-errors";

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const q = getQuery(event);
    return await new ProjectService().list(householdId, {
      statuses: parseStatusFilter(q.status),
      path: parsePathFilter(q.path),
    });
  } catch (error) {
    return toHttpError(error, 'listing projects');
  }
});
