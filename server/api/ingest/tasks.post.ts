import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { TaskIngestService } from "@/server/services/TaskIngestService";
import { MAX_TASK_INGEST_BATCH, taskIngestBatchSchema } from "@/server/utils/task-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineApiKeyProtectedEventHandler(async (event, { householdId, userId }) => {
  try {
    const parsed = taskIngestBatchSchema.safeParse(await readBody(event));
    if (!parsed.success) {
      throw new HttpError(`Body must be { tasks: [...] } with 1-${MAX_TASK_INGEST_BATCH} items`, 400);
    }
    return await new TaskIngestService().ingestBatch(householdId, userId, parsed.data.tasks);
  } catch (error) {
    return toHttpError(error, 'ingesting tasks');
  }
});
