import prisma from '@/server/utils/prisma/client';
import { ApiKeyService } from '@/server/services/ApiKeyService';
import { projectIngestItemSchema } from '@/server/utils/project-schemas';
import { type ProjectIngestResult } from '@/types/project';

// Title plus location, case and surrounding space ignored: the identity a retried batch is checked against.
const matchKey = (title: string, location: string | null): string =>
  `${title.trim().toLowerCase()}\u0000${(location ?? '').trim().toLowerCase()}`;

export class ProjectIngestService {
  private apiKeys = new ApiKeyService();

  async ingestBatch(householdId: string, userId: string, rawItems: unknown[]): Promise<ProjectIngestResult> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);

    // Done projects do not count, so a finished "Flush the water heater" can be filed again next year.
    const open = await prisma.project.findMany({
      where: { householdId, metaStatus: 'active', status: { not: 'done' } },
      select: { id: true, title: true, location: true },
    });
    const existing = new Map(open.map((p) => [matchKey(p.title, p.location), p.id]));

    const result: ProjectIngestResult = { created: [], skipped: [], errors: [] };

    for (let index = 0; index < rawItems.length; index++) {
      const raw = rawItems[index];
      const parsed = projectIngestItemSchema.safeParse(raw);
      if (!parsed.success) {
        const title = typeof (raw as { title?: unknown })?.title === 'string' ? (raw as { title: string }).title : '';
        result.errors.push({ index, title, message: parsed.error.issues[0]?.message ?? 'Invalid item' });
        continue;
      }
      const item = parsed.data;
      const key = matchKey(item.title, item.location ?? null);
      const duplicateId = existing.get(key);
      if (duplicateId) {
        result.skipped.push({
          index, id: duplicateId, title: item.title, reason: 'A project with this title and location already exists',
        });
        continue;
      }

      try {
        const project = await prisma.$transaction(async (tx) => {
          const created = await tx.project.create({
            data: {
              householdId,
              createdById: userId,
              title: item.title,
              location: item.location ?? null,
              notes: item.notes ?? null,
              status: item.status,
              path: item.path,
              completedAt: item.status === 'done' ? new Date() : null,
            },
            select: { id: true },
          });
          if (item.steps.length > 0) {
            await tx.projectStep.createMany({
              data: item.steps.map((step, position) => ({
                projectId: created.id,
                createdById: userId,
                text: step.text,
                estimateMinutes: step.estimateMinutes ?? null,
                position,
              })),
            });
          }
          return created;
        });
        if (item.status !== 'done') existing.set(key, project.id);
        result.created.push({ index, id: project.id, title: item.title, steps: item.steps.length });
      } catch (error) {
        console.error(`[ProjectIngestService] item ${index} failed:`, error);
        result.errors.push({
          index,
          title: item.title,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return result;
  }
}
