import prisma from "@/server/utils/prisma/client";

export interface DashboardData {
  pendingOccurrences: {
    id: string;
    dueDate: Date;
    assigneeIds: string[];
    status: string;
    task: {
      name: string;
      category: {
        name: string;
      } | null;
    };
  }[];
  recentlyCompletedCount: number;
  categoryBreakdown: {
    name: string;
    count: number;
  }[];
  householdMembers: {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
  }[];
}

export class DashboardService {
  async getDashboardData(householdId: string): Promise<DashboardData> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      pendingOccurrences,
      recentlyCompletedCount,
      categoryBreakdown,
      householdMembers,
    ] = await Promise.all([
      this.getPendingOccurrences(householdId),
      this.getRecentlyCompletedCount(householdId, sevenDaysAgo),
      this.getCategoryBreakdown(householdId),
      this.getHouseholdMembers(householdId),
    ]);

    return {
      pendingOccurrences,
      recentlyCompletedCount,
      categoryBreakdown,
      householdMembers,
    };
  }

  private async getPendingOccurrences(householdId: string) {
    return prisma.taskOccurrence.findMany({
      where: {
        status: { in: ["created", "assigned"] },
        task: {
          householdId,
          metaStatus: { not: "soft-deleted" },
        },
      },
      select: {
        id: true,
        dueDate: true,
        assigneeIds: true,
        status: true,
        task: {
          select: {
            name: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  private async getRecentlyCompletedCount(
    householdId: string,
    since: Date
  ): Promise<number> {
    return prisma.taskOccurrence.count({
      where: {
        status: "completed",
        completedAt: { gte: since },
        task: {
          householdId,
          metaStatus: { not: "soft-deleted" },
        },
      },
    });
  }

  private async getCategoryBreakdown(householdId: string) {
    const taskCounts = await prisma.taskDefinition.groupBy({
      by: ["categoryId"],
      where: {
        householdId,
        metaStatus: "active",
      },
      _count: { id: true },
    });

    if (taskCounts.length === 0) return [];

    const categoryIds = taskCounts.map((tc) => tc.categoryId);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return taskCounts
      .map((tc) => ({
        name: categoryMap.get(tc.categoryId) || "Uncategorized",
        count: tc._count.id,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private async getHouseholdMembers(householdId: string) {
    return prisma.user.findMany({
      where: { householdId },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
      },
    });
  }
}
