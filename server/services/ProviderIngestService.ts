import prisma from '@/server/utils/prisma/client';
import { ProviderCategoryService } from '@/server/services/ProviderCategoryService';
import { ProviderStatusService } from '@/server/services/ProviderStatusService';
import { normalizeProviderName } from '@/server/utils/provider-matching';
import { ingestItemSchema } from '@/server/utils/provider-schemas';
import { type IngestResult } from '@/types/provider';

const DEFAULT_INGEST_STATUS = 'Lead';
// Contact-style fields the watcher may fill in when they are still empty.
const FILLABLE_FIELDS = [
  'company', 'primaryContactName', 'phone', 'email', 'website', 'address', 'licenseNumber', 'googlePlaceId',
] as const;

// Unparseable dates become null so one bad date cannot make Prisma reject the whole item.
const parseSourceDate = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export class ProviderIngestService {
  private categories = new ProviderCategoryService();
  private statuses = new ProviderStatusService();

  async ingestBatch(householdId: string, rawItems: unknown[]): Promise<IngestResult> {
    const result: IngestResult = {
      created: 0, updated: 0, skippedDeleted: 0, evidenceAdded: 0, errors: [],
    };

    for (let index = 0; index < rawItems.length; index++) {
      const raw = rawItems[index];
      const parsed = ingestItemSchema.safeParse(raw);
      if (!parsed.success) {
        const name = typeof (raw as { name?: unknown })?.name === 'string' ? (raw as { name: string }).name : '';
        result.errors.push({ index, name, message: parsed.error.issues[0]?.message ?? 'Invalid item' });
        continue;
      }
      const item = parsed.data;
      try {
        const category = await this.categories.findOrCreateByName(householdId, item.category);
        const nameKey = normalizeProviderName(item.name);
        const existing = await prisma.provider.findFirst({
          where: item.googlePlaceId
            ? { householdId, googlePlaceId: item.googlePlaceId }
            : { householdId, categoryId: category.id, nameKey },
        });

        if (existing?.metaStatus === 'deleted') {
          result.skippedDeleted++;
          continue;
        }

        let providerId: string;
        if (existing) {
          const fill: Record<string, string> = {};
          for (const field of FILLABLE_FIELDS) {
            const incoming = item[field];
            if (incoming && !(existing as Record<string, unknown>)[field]) fill[field] = incoming;
          }
          if (Object.keys(fill).length > 0) {
            await prisma.provider.update({ where: { id: existing.id }, data: fill });
          }
          providerId = existing.id;
          result.updated++;
        } else {
          const status = await this.statuses.findOrCreateByName(
            householdId, item.status ?? DEFAULT_INGEST_STATUS
          );
          const created = await prisma.provider.create({
            data: {
              householdId,
              categoryId: category.id,
              statusId: status.id,
              name: item.name,
              nameKey,
              company: item.company ?? null,
              primaryContactName: item.primaryContactName ?? null,
              phone: item.phone ?? null,
              email: item.email ?? null,
              website: item.website ?? null,
              address: item.address ?? null,
              licenseNumber: item.licenseNumber ?? null,
              googlePlaceId: item.googlePlaceId ?? null,
            },
          });
          providerId = created.id;
          result.created++;
        }

        if (item.evidence.length > 0) {
          const added = await prisma.providerEvidence.createMany({
            data: item.evidence.map((e) => ({
              providerId,
              sourceUrl: e.sourceUrl,
              sourceGroup: e.sourceGroup ?? null,
              sourceDate: parseSourceDate(e.sourceDate),
              snippet: e.snippet ?? null,
              kind: e.kind,
            })),
            skipDuplicates: true,
          });
          result.evidenceAdded += added.count;
        }
      } catch (error) {
        console.error(`[ProviderIngestService] item ${index} failed:`, error);
        result.errors.push({
          index,
          name: item.name,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return result;
  }
}
