import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export class ProviderCategoryService {
  async listForHousehold(householdId: string) {
    return prisma.providerCategory.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(householdId: string, name: string) {
    const max = await prisma.providerCategory.aggregate({
      where: { householdId },
      _max: { sortOrder: true },
    });
    return prisma.providerCategory.create({
      data: { householdId, name, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }

  async rename(householdId: string, id: string, name: string) {
    await this.requireOwned(householdId, id);
    return prisma.providerCategory.update({ where: { id }, data: { name } });
  }

  async reorder(householdId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.providerCategory.update({
          where: { id, householdId },
          data: { sortOrder: index },
        })
      )
    );
  }

  /**
   * Delete a category. If providers use it, moveToId must name another category
   * in the same household; providers are reassigned first.
   */
  async remove(householdId: string, id: string, moveToId?: string) {
    await this.requireOwned(householdId, id);
    const inUse = await prisma.provider.count({ where: { householdId, categoryId: id } });
    if (inUse > 0) {
      if (!moveToId) {
        throw new HttpError(`Category is used by ${inUse} provider(s); choose a category to move them to`, 409);
      }
      if (moveToId === id) {
        throw new HttpError('Cannot move providers to the category being deleted', 400);
      }
      await this.requireOwned(householdId, moveToId);
      await prisma.$transaction([
        prisma.provider.updateMany({
          where: { householdId, categoryId: id },
          data: { categoryId: moveToId },
        }),
        prisma.providerCategory.delete({ where: { id } }),
      ]);
      return;
    }
    await prisma.providerCategory.delete({ where: { id } });
  }

  async findOrCreateByName(householdId: string, name: string) {
    const existing = await prisma.providerCategory.findFirst({
      where: { householdId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;
    return this.create(householdId, name);
  }

  private async requireOwned(householdId: string, id: string) {
    const category = await prisma.providerCategory.findFirst({ where: { id, householdId } });
    if (!category) throw new HttpError('Category not found', 404);
    return category;
  }
}
