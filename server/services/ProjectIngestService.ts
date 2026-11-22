import prisma from '@/server/utils/prisma/client';
import { ApiKeyService } from '@/server/services/ApiKeyService';
import { ProjectService } from '@/server/services/ProjectService';
import { HttpError } from '@/server/utils/api-errors';
import { projectIngestItemSchema } from '@/server/utils/project-schemas';
import { toIngestDocument, toIngestPhoto, toIngestProvider, toIngestStep } from '@/server/utils/ingest-project-dto';
import {
  MAX_PROJECT_NOTES_LENGTH,
  type IngestProjectDetail,
  type IngestProjectUpdateInput,
  type ProjectDetail,
  type ProjectIngestResult,
} from '@/types/project';

// Title plus location, case and surrounding space ignored: the identity a retried batch is checked against.
const matchKey = (title: string, location: string | null): string =>
  `${title.trim().toLowerCase()}\u0000${(location ?? '').trim().toLowerCase()}`;

const NOTES_APPEND_ATTEMPTS = 3;

export class ProjectIngestService {
  private apiKeys = new ApiKeyService();
  private projects = new ProjectService();

  async getDetail(householdId: string, projectId: string): Promise<IngestProjectDetail> {
    return this.toIngestDetail(await this.projects.get(householdId, projectId));
  }

  async update(
    householdId: string,
    userId: string,
    projectId: string,
    input: IngestProjectUpdateInput,
  ): Promise<IngestProjectDetail> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    const { notesAppend, ...fields } = input;
    if (notesAppend !== undefined) await this.appendNotes(householdId, projectId, notesAppend);

    const changed = Object.values(fields).some((value) => value !== undefined);
    if (!changed) return this.getDetail(householdId, projectId);
    return this.toIngestDetail(await this.projects.update(householdId, projectId, fields));
  }

  async remove(householdId: string, userId: string, projectId: string): Promise<void> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    await this.projects.softDelete(householdId, projectId);
  }

  // Compare-and-swap on the notes read, so a concurrent write is never overwritten. A paragraph that is already the last one is not added again.
  private async appendNotes(householdId: string, projectId: string, append: string): Promise<void> {
    const where = { id: projectId, householdId, metaStatus: 'active' };
    for (let attempt = 0; attempt < NOTES_APPEND_ATTEMPTS; attempt++) {
      const row = await prisma.project.findFirst({ where, select: { notes: true } });
      if (!row) throw new HttpError('Project not found', 404);
      const current = row.notes;
      if (current && (current === append || current.endsWith(`\n\n${append}`))) return;
      const next = current ? `${current}\n\n${append}` : append;
      if (next.length > MAX_PROJECT_NOTES_LENGTH) {
        throw new HttpError(`Notes would be ${next.length} characters; the limit is ${MAX_PROJECT_NOTES_LENGTH}`, 400);
      }
      const { count } = await prisma.project.updateMany({ where: { ...where, notes: current }, data: { notes: next } });
      if (count === 1) return;
    }
    throw new HttpError('The notes changed while appending. Try again.', 409);
  }

  // ProjectDetail has no updatedAt and its photos no createdAt, so one small read supplies them.
  private async toIngestDetail(detail: ProjectDetail): Promise<IngestProjectDetail> {
    const extra = await prisma.project.findUnique({
      where: { id: detail.id },
      select: { updatedAt: true, photos: { select: { id: true, createdAt: true } } },
    });
    if (!extra) throw new HttpError('Project not found', 404);
    const photoCreatedAt = new Map(extra.photos.map((photo) => [photo.id, photo.createdAt]));
    return {
      id: detail.id,
      title: detail.title,
      location: detail.location,
      status: detail.status,
      path: detail.path,
      notes: detail.notes,
      completedAt: detail.completedAt,
      providerCategoryId: detail.providerCategoryId,
      createdAt: detail.createdAt,
      updatedAt: extra.updatedAt,
      steps: detail.steps.map(toIngestStep),
      documents: detail.documents.map(toIngestDocument),
      photos: detail.photos.map((photo) => toIngestPhoto({ ...photo, createdAt: photoCreatedAt.get(photo.id) ?? detail.createdAt })),
      providers: detail.providers.map(toIngestProvider),
    };
  }

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
