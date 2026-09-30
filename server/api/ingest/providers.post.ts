import { readBody } from "h3";
import { defineApiKeyProtectedEventHandler } from "@/server/utils/api-key-auth";
import { ProviderIngestService } from "@/server/services/ProviderIngestService";
import { ingestBatchSchema } from "@/server/utils/provider-schemas";
import { HttpError, toHttpError } from "@/server/utils/api-errors";

export default defineApiKeyProtectedEventHandler(async (event, { householdId }) => {
  try {
    const parsed = ingestBatchSchema.safeParse(await readBody(event));
    if (!parsed.success) {
      throw new HttpError(`Body must be { providers: [...] } with 1-500 items`, 400);
    }
    return await new ProviderIngestService().ingestBatch(householdId, parsed.data.providers);
  } catch (error) {
    return toHttpError(error, 'ingesting providers');
  }
});
