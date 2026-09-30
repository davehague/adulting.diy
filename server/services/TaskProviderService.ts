import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export class TaskProviderService {
  async listForTask(householdId: string, taskId: string) {
    await this.requireTask(householdId, taskId);
    return prisma.taskProvider.findMany({
      where: { taskId, provider: { householdId, metaStatus: 'active' } },
      include: {
        provider: {
          select: {
            id: true, name: true, phone: true,
            category: { select: { id: true, name: true } },
            status: { select: { id: true, name: true, kind: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async link(householdId: string, taskId: string, providerId: string) {
    await this.requireTask(householdId, taskId);
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return prisma.taskProvider.upsert({
      where: { taskId_providerId: { taskId, providerId } },
      create: { taskId, providerId },
      update: {},
    });
  }

  async unlink(householdId: string, taskId: string, providerId: string) {
    await this.requireTask(householdId, taskId);
    await prisma.taskProvider.deleteMany({ where: { taskId, providerId } });
  }

  private async requireTask(householdId: string, taskId: string) {
    const task = await prisma.taskDefinition.findFirst({
      where: { id: taskId, householdId, metaStatus: { not: 'soft-deleted' } },
    });
    if (!task) throw new HttpError('Task not found', 404);
    return task;
  }
}
