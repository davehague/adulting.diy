import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { summarizeEvidence } from '@/server/utils/provider-evidence';
import {
  MAX_PROJECT_PROVIDERS,
  PROJECT_PROVIDER_STATUSES,
  type ProjectProviderDto,
  type ProjectProviderStatus,
} from '@/types/project';
import { sortProviderLinks } from '@/utils/project-providers';

// A link whose provider has been removed is kept, but never shown or counted.
export const visibleLinkWhere = { provider: { metaStatus: 'active' } } satisfies Prisma.ProjectProviderWhereInput;

export const linkOrder = { createdAt: 'asc' } satisfies Prisma.ProjectProviderOrderByWithRelationInput;

export const linkSelect = {
  providerId: true,
  status: true,
  provider: {
    select: { id: true, name: true, phone: true, evidence: { select: { kind: true, sourceDate: true } } },
  },
} satisfies Prisma.ProjectProviderSelect;

type LinkRow = Prisma.ProjectProviderGetPayload<{ select: typeof linkSelect }>;

const ALREADY_LINKED = 'That provider is already on this project';

// Rows must arrive oldest-first (linkOrder); the sort then groups them by status.
export const toProviderLinks = (rows: LinkRow[]): ProjectProviderDto[] =>
  sortProviderLinks(
    rows.map((row) => ({
      providerId: row.providerId,
      status: row.status as ProjectProviderStatus,
      provider: {
        id: row.provider.id,
        name: row.provider.name,
        phone: row.provider.phone,
        neighborCount: summarizeEvidence(row.provider.evidence).neighborCount,
      },
    })),
  );

export class ProjectProviderService {
  async listForProject(householdId: string, projectId: string): Promise<ProjectProviderDto[]> {
    await this.requireProject(householdId, projectId);
    return this.links(projectId);
  }

  async link(householdId: string, userId: string, projectId: string, providerId: string): Promise<ProjectProviderDto[]> {
    await this.requireProject(householdId, projectId);
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!provider) throw new HttpError('Provider not found', 404);

    // The provider is not removed, so a link to it, if there is one, is among the visible links.
    const existing = await this.links(projectId);
    if (existing.some((link) => link.providerId === providerId)) throw new HttpError(ALREADY_LINKED, 409);
    if (existing.length >= MAX_PROJECT_PROVIDERS) {
      throw new HttpError(`This project already has ${MAX_PROJECT_PROVIDERS} providers`, 409);
    }

    try {
      await prisma.projectProvider.create({ data: { projectId, providerId, createdById: userId } });
    } catch (error) {
      // Two people linking the same provider at once: the unique index stops the second.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new HttpError(ALREADY_LINKED, 409);
      }
      throw error;
    }
    return this.links(projectId);
  }

  async setStatus(
    householdId: string,
    projectId: string,
    providerId: string,
    status: ProjectProviderStatus,
  ): Promise<ProjectProviderDto[]> {
    if (!(PROJECT_PROVIDER_STATUSES as readonly string[]).includes(status)) throw new HttpError('Unknown status', 400);
    await this.requireProject(householdId, projectId);
    const link = await this.requireLink(projectId, providerId);
    await prisma.projectProvider.update({ where: { id: link.id }, data: { status } });
    return this.links(projectId);
  }

  async unlink(householdId: string, projectId: string, providerId: string): Promise<ProjectProviderDto[]> {
    await this.requireProject(householdId, projectId);
    const link = await this.requireLink(projectId, providerId);
    await prisma.projectProvider.delete({ where: { id: link.id } });
    return this.links(projectId);
  }

  private async links(projectId: string): Promise<ProjectProviderDto[]> {
    const rows = await prisma.projectProvider.findMany({
      where: { projectId, ...visibleLinkWhere },
      orderBy: linkOrder,
      select: linkSelect,
    });
    return toProviderLinks(rows);
  }

  private async requireProject(householdId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);
  }

  // The project has already been checked against the household, and a link can only be made to a
  // provider of the same household, so the project id is enough to scope this.
  private async requireLink(projectId: string, providerId: string): Promise<{ id: string }> {
    const link = await prisma.projectProvider.findFirst({
      where: { projectId, providerId, ...visibleLinkWhere },
      select: { id: true },
    });
    if (!link) throw new HttpError('That provider is not on this project', 404);
    return link;
  }
}
