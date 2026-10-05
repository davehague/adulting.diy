import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { stepOrder, stepSelect } from '@/server/services/ProjectStepService';
import { linkOrder, linkSelect, toProviderLinks, visibleLinkWhere } from '@/server/services/ProjectProviderService';
import {
  DEFAULT_LIST_STATUSES,
  type ProjectCreateInput,
  type ProjectDetail,
  type ProjectListFilters,
  type ProjectListItem,
  type ProjectPath,
  type ProjectStatus,
  type ProjectUpdateInput,
} from '@/types/project';

const STATUS_ORDER: Record<ProjectStatus, number> = { active: 0, planning: 1, future: 2, done: 3 };

const detailInclude = {
  photos: {
    orderBy: { position: 'asc' },
    select: { id: true, width: true, height: true, position: true },
  },
  steps: { orderBy: stepOrder, select: stepSelect },
  providers: { where: visibleLinkWhere, orderBy: linkOrder, select: linkSelect },
} satisfies Prisma.ProjectInclude;

type ProjectWithPhotos = Prisma.ProjectGetPayload<{ include: typeof detailInclude }>;

const toDetail = (project: ProjectWithPhotos): ProjectDetail => ({
  id: project.id,
  title: project.title,
  location: project.location,
  status: project.status as ProjectStatus,
  path: project.path as ProjectPath | null,
  notes: project.notes,
  completedAt: project.completedAt,
  createdAt: project.createdAt,
  providerCategoryId: project.providerCategoryId,
  photos: project.photos,
  steps: project.steps,
  providers: toProviderLinks(project.providers),
});

export class ProjectService {
  async list(householdId: string, filters: ProjectListFilters): Promise<ProjectListItem[]> {
    const statuses = filters.statuses?.length ? filters.statuses : DEFAULT_LIST_STATUSES;
    const where: Prisma.ProjectWhereInput = { householdId, metaStatus: 'active', status: { in: statuses } };
    if (filters.path === 'none') where.path = null;
    else if (filters.path) where.path = filters.path;

    const rows = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        photos: { orderBy: { position: 'asc' }, select: { id: true } },
        providers: {
          where: { status: 'chosen', ...visibleLinkWhere },
          orderBy: linkOrder,
          select: { provider: { select: { name: true } } },
        },
      },
    });

    // Array.prototype.sort is stable, so newest-first from the query survives within each status.
    return [...rows]
      .sort((a, b) => STATUS_ORDER[a.status as ProjectStatus] - STATUS_ORDER[b.status as ProjectStatus])
      .map((project) => ({
        id: project.id,
        title: project.title,
        location: project.location,
        status: project.status as ProjectStatus,
        path: project.path as ProjectPath | null,
        photoCount: project.photos.length,
        coverPhotoId: project.photos[0]?.id ?? null,
        photoIds: project.photos.map((photo) => photo.id),
        chosenProviderNames: project.providers.map((link) => link.provider.name),
      }));
  }

  async create(householdId: string, userId: string, input: ProjectCreateInput): Promise<{ id: string }> {
    const project = await prisma.project.create({
      data: {
        householdId,
        createdById: userId,
        title: input.title,
        location: input.location ?? null,
        notes: input.notes ?? null,
      },
    });
    return { id: project.id };
  }

  async get(householdId: string, id: string): Promise<ProjectDetail> {
    return toDetail(await this.requireProject(householdId, id));
  }

  async update(householdId: string, id: string, input: ProjectUpdateInput): Promise<ProjectDetail> {
    const existing = await this.requireProject(householdId, id);
    const data: Prisma.ProjectUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.location !== undefined) data.location = input.location;
    if (input.path !== undefined) data.path = input.path;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.providerCategoryId !== undefined) {
      if (input.providerCategoryId !== null) {
        const category = await prisma.providerCategory.findFirst({
          where: { id: input.providerCategoryId, householdId },
          select: { id: true },
        });
        if (!category) throw new HttpError('Unknown provider category', 400);
      }
      data.providerCategoryId = input.providerCategoryId;
    }
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status !== 'done') data.completedAt = null;
      else data.completedAt = existing.status === 'done' ? existing.completedAt : new Date();
    }
    const updated = await prisma.project.update({ where: { id }, data, include: detailInclude });
    return toDetail(updated);
  }

  async softDelete(householdId: string, id: string): Promise<void> {
    await this.requireProject(householdId, id);
    await prisma.project.update({ where: { id }, data: { metaStatus: 'deleted' } });
  }

  async locations(householdId: string): Promise<string[]> {
    const rows = await prisma.project.findMany({
      where: { householdId, metaStatus: 'active', location: { not: null } },
      distinct: ['location'],
      select: { location: true },
    });
    return rows
      .map((r) => r.location)
      .filter((location): location is string => !!location)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  private async requireProject(householdId: string, id: string): Promise<ProjectWithPhotos> {
    const project = await prisma.project.findFirst({
      where: { id, householdId, metaStatus: 'active' },
      include: detailInclude,
    });
    if (!project) throw new HttpError('Project not found', 404);
    return project;
  }
}
