import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { generateApiKey, hashApiKey } from '@/server/utils/api-key';

export class ApiKeyService {
  /** Creates a key. The plaintext `key` is returned here and never retrievable again. */
  async create(householdId: string, userId: string, name: string) {
    const { key, prefix, hashedKey } = generateApiKey();
    const record = await prisma.apiKey.create({
      data: { householdId, name, prefix, hashedKey, createdByUserId: userId },
    });
    return { id: record.id, name, prefix, key };
  }

  async list(householdId: string) {
    return prisma.apiKey.findMany({
      where: { householdId },
      select: {
        id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(householdId: string, id: string) {
    const existing = await prisma.apiKey.findFirst({ where: { id, householdId } });
    if (!existing) throw new HttpError('API key not found', 404);
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Records written through a key are attributed to its creator, who must still belong to the household. */
  async requireOwnerInHousehold(householdId: string, userId: string): Promise<void> {
    const owner = await prisma.user.findFirst({ where: { id: userId, householdId }, select: { id: true } });
    if (!owner) throw new HttpError('The API key owner is no longer a member of this household', 403);
  }

  async authenticate(key: string): Promise<{ householdId: string; apiKeyId: string; userId: string } | null> {
    const record = await prisma.apiKey.findFirst({
      where: { hashedKey: hashApiKey(key), revokedAt: null },
    });
    if (!record) return null;
    // Best-effort: a transient write failure must not reject a valid key.
    try {
      await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    } catch (error) {
      console.error('[ApiKeyService] failed to update lastUsedAt', error);
    }
    return { householdId: record.householdId, apiKeyId: record.id, userId: record.createdByUserId };
  }
}
