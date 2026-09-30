import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { normalizeProviderName } from '@/server/utils/provider-matching';
import { summarizeEvidence } from '@/server/utils/provider-evidence';
import { ProviderStatusService } from '@/server/services/ProviderStatusService';
import {
  type ProviderInput,
  type ProviderListFilters,
  type ProviderListItem,
  type ProviderStatusKind,
} from '@/types/provider';

const statusService = new ProviderStatusService();

export class ProviderService {
  async list(householdId: string, filters: ProviderListFilters): Promise<ProviderListItem[]> {
    const where: Prisma.ProviderWhereInput = { householdId, metaStatus: 'active' };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.statusId) {
      where.statusId = filters.statusId;
    } else if (!filters.includeHidden) {
      where.status = { hiddenByDefault: false };
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { company: { contains: term, mode: 'insensitive' } },
        { primaryContactName: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.provider.findMany({
      where,
      include: {
        category: true,
        status: true,
        evidence: { select: { kind: true, sourceDate: true } },
      },
    });

    const items: ProviderListItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company,
      phone: row.phone,
      rating: row.rating,
      category: {
        id: row.category.id, name: row.category.name, sortOrder: row.category.sortOrder,
      },
      status: {
        id: row.status.id,
        name: row.status.name,
        kind: row.status.kind as ProviderStatusKind,
        hiddenByDefault: row.status.hiddenByDefault,
        sortOrder: row.status.sortOrder,
      },
      ...summarizeEvidence(row.evidence),
    }));

    return this.sort(items, filters.sort ?? 'name');
  }

  async findById(householdId: string, id: string) {
    const provider = await prisma.provider.findFirst({
      where: { id, householdId, metaStatus: 'active' },
      include: {
        category: true,
        status: true,
        contacts: { orderBy: { createdAt: 'asc' } },
        evidence: { orderBy: { sourceDate: 'desc' } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, picture: true } } },
        },
        tasks: { include: { task: { select: { id: true, name: true } } } },
      },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return { ...provider, ...summarizeEvidence(provider.evidence) };
  }

  async create(householdId: string, input: ProviderInput) {
    await this.assertCategoryOwned(householdId, input.categoryId);

    let statusId = input.statusId;
    if (statusId) {
      await this.assertStatusOwned(householdId, statusId);
    } else {
      statusId = (await statusService.listForHousehold(householdId))[0]?.id;
    }
    if (!statusId) throw new HttpError('No provider statuses configured', 400);

    return prisma.provider.create({
      data: {
        ...input,
        statusId,
        householdId,
        nameKey: normalizeProviderName(input.name),
      },
    });
  }

  async update(householdId: string, id: string, input: Partial<ProviderInput>) {
    await this.requireOwned(householdId, id);
    if (input.categoryId) await this.assertCategoryOwned(householdId, input.categoryId);
    if (input.statusId) await this.assertStatusOwned(householdId, input.statusId);
    return prisma.provider.update({
      where: { id },
      data: {
        ...input,
        ...(input.name !== undefined ? { nameKey: normalizeProviderName(input.name) } : {}),
      },
    });
  }

  async softDelete(householdId: string, id: string) {
    await this.requireOwned(householdId, id);
    await prisma.provider.update({ where: { id }, data: { metaStatus: 'deleted' } });
  }

  private sort(items: ProviderListItem[], sort: NonNullable<ProviderListFilters['sort']>) {
    const byName = (a: ProviderListItem, b: ProviderListItem) => a.name.localeCompare(b.name);
    const copy = [...items];
    switch (sort) {
      case 'mentions':
        return copy.sort((a, b) => b.mentionCount - a.mentionCount || byName(a, b));
      case 'lastSighting':
        return copy.sort(
          (a, b) => (b.lastSightingAt?.getTime() ?? 0) - (a.lastSightingAt?.getTime() ?? 0) || byName(a, b)
        );
      case 'rating':
        return copy.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b));
      default:
        return copy.sort(byName);
    }
  }

  private async requireOwned(householdId: string, id: string) {
    const provider = await prisma.provider.findFirst({
      where: { id, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return provider;
  }

  private async assertCategoryOwned(householdId: string, categoryId: string) {
    const category = await prisma.providerCategory.findFirst({ where: { id: categoryId, householdId } });
    if (!category) throw new HttpError('Invalid category', 400);
  }

  private async assertStatusOwned(householdId: string, statusId: string) {
    const status = await prisma.providerStatus.findFirst({ where: { id: statusId, householdId } });
    if (!status) throw new HttpError('Invalid status', 400);
  }
}
