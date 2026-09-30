import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { type ProviderStatusKind } from '@/types/provider';

export const DEFAULT_PROVIDER_STATUSES: {
  name: string;
  kind: ProviderStatusKind;
  hiddenByDefault: boolean;
}[] = [
  { name: 'Lead', kind: 'neutral', hiddenByDefault: true },
  { name: 'Recommended', kind: 'positive', hiddenByDefault: false },
  { name: 'Hired', kind: 'positive', hiddenByDefault: false },
  { name: 'Passed', kind: 'neutral', hiddenByDefault: false },
  { name: 'Avoid', kind: 'negative', hiddenByDefault: false },
];

const VALID_KINDS: ProviderStatusKind[] = ['neutral', 'positive', 'negative'];

interface StatusInput {
  name: string;
  kind?: ProviderStatusKind;
  hiddenByDefault?: boolean;
}

export class ProviderStatusService {
  /** Lists statuses, seeding the defaults the first time a household asks. */
  async listForHousehold(householdId: string) {
    const existing = await prisma.providerStatus.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (existing.length > 0) return existing;

    await prisma.providerStatus.createMany({
      data: DEFAULT_PROVIDER_STATUSES.map((s, i) => ({ ...s, householdId, sortOrder: i })),
      skipDuplicates: true,
    });
    return prisma.providerStatus.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(householdId: string, input: StatusInput) {
    this.validateKind(input.kind);
    const max = await prisma.providerStatus.aggregate({
      where: { householdId },
      _max: { sortOrder: true },
    });
    return prisma.providerStatus.create({
      data: {
        householdId,
        name: input.name,
        kind: input.kind ?? 'neutral',
        hiddenByDefault: input.hiddenByDefault ?? false,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async update(householdId: string, id: string, input: Partial<StatusInput>) {
    this.validateKind(input.kind);
    await this.requireOwned(householdId, id);
    return prisma.providerStatus.update({ where: { id }, data: input });
  }

  async reorder(householdId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.providerStatus.update({ where: { id, householdId }, data: { sortOrder: index } })
      )
    );
  }

  async remove(householdId: string, id: string, moveToId?: string) {
    await this.requireOwned(householdId, id);
    const inUse = await prisma.provider.count({ where: { householdId, statusId: id } });
    if (inUse > 0) {
      if (!moveToId) {
        throw new HttpError(`Status is used by ${inUse} provider(s); choose a status to move them to`, 409);
      }
      if (moveToId === id) {
        throw new HttpError('Cannot move providers to the status being deleted', 400);
      }
      await this.requireOwned(householdId, moveToId);
      await prisma.$transaction([
        prisma.provider.updateMany({
          where: { householdId, statusId: id },
          data: { statusId: moveToId },
        }),
        prisma.providerStatus.delete({ where: { id } }),
      ]);
      return;
    }
    await prisma.providerStatus.delete({ where: { id } });
  }

  async findOrCreateByName(householdId: string, name: string) {
    const existing = await prisma.providerStatus.findFirst({
      where: { householdId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;
    return this.create(householdId, { name });
  }

  private validateKind(kind?: string) {
    if (kind !== undefined && !VALID_KINDS.includes(kind as ProviderStatusKind)) {
      throw new HttpError(`kind must be one of ${VALID_KINDS.join(', ')}`, 400);
    }
  }

  private async requireOwned(householdId: string, id: string) {
    const status = await prisma.providerStatus.findFirst({ where: { id, householdId } });
    if (!status) throw new HttpError('Status not found', 404);
    return status;
  }
}
