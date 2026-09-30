import { getQuery } from "h3";
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { ProviderService } from "@/server/services/ProviderService";
import { toHttpError } from "@/server/utils/api-errors";
import { type ProviderSort } from "@/types/provider";

const SORTS: ProviderSort[] = ['name', 'mentions', 'lastSighting', 'rating'];

export default defineHouseholdProtectedEventHandler(async (event, _authUser, householdId) => {
  try {
    const q = getQuery(event);
    const sort = SORTS.includes(q.sort as ProviderSort) ? (q.sort as ProviderSort) : undefined;
    return await new ProviderService().list(householdId, {
      search: typeof q.search === 'string' ? q.search : undefined,
      categoryId: typeof q.categoryId === 'string' ? q.categoryId : undefined,
      statusId: typeof q.statusId === 'string' ? q.statusId : undefined,
      includeHidden: q.includeHidden === 'true',
      sort,
    });
  } catch (error) {
    return toHttpError(error, 'listing providers');
  }
});
