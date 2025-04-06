import prisma from "@/server/utils/prisma/client";
import type { TaskDefinition } from "@/types";

export class TaskService {
  /**
   * Find tasks for a household
   */
  async findForHousehold(
    householdId: string,
    filters: {
      status?: string;
      categoryId?: string;
      search?: string;
    } = {}
  ): Promise<TaskDefinition[]> {
    try {
      // Build the where clause based on filters
      const where: any = {
        householdId,
        metaStatus: { not: "soft-deleted" }, // Exclude soft-deleted by default
      };

      // Add status filter if provided, overriding the default exclusion if necessary
      if (filters.status) {
        // If the filter is specifically for 'soft-deleted', allow it. Otherwise, use the provided status.
        where.metaStatus =
          filters.status === "soft-deleted" ? "soft-deleted" : filters.status;
      } else {
        // Ensure the default exclusion remains if no specific status filter is given
        where.metaStatus = { not: "soft-deleted" };
      }

      // Add category filter if provided
      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }

      // Add search filter if provided
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ];
      }

      // Find tasks
      const tasks = await prisma.taskDefinition.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return tasks;
    } catch (error) {
      console.error(
        `[TaskService] Unexpected error in findForHousehold:`,
        error
      );
      throw error;
    }
  }

  /**
   * Find a task by ID
   */
  async findById(id: string): Promise<TaskDefinition | null> {
    try {
      const task = await prisma.taskDefinition.findUnique({
        where: { id },
        include: {
          category: true,
        },
      });

      return task;
    } catch (error) {
      console.error(`[TaskService] Unexpected error in findById:`, error);
      throw error;
    }
  }

  /**
   * Create a task
   */
  async create(
    data: Omit<TaskDefinition, "id" | "createdAt" | "updatedAt">
  ): Promise<TaskDefinition> {
    try {
      const task = await prisma.taskDefinition.create({
        data,
        include: {
          category: true,
        },
      });

      return task;
    } catch (error) {
      console.error(`[TaskService] Unexpected error in create:`, error);
      throw error;
    }
  }

  /**
   * Update a task
   */
  async update(
    id: string,
    data: Partial<TaskDefinition>
  ): Promise<TaskDefinition> {
    try {
      const task = await prisma.taskDefinition.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          category: true,
        },
      });

      return task;
    } catch (error) {
      console.error(`[TaskService] Unexpected error in update:`, error);
      throw error;
    }
  }

  /**
   * Pause a task
   */
  async pause(id: string): Promise<TaskDefinition> {
    try {
      // Start a transaction to ensure all related operations succeed or fail together
      return await prisma.$transaction(async (tx) => {
        // Update task status
        const task = await tx.taskDefinition.update({
          where: { id },
          data: {
            metaStatus: "paused",
            updatedAt: new Date(),
          },
          include: {
            category: true,
          },
        });

        // Delete future occurrences
        await tx.taskOccurrence.updateMany({
          where: {
            taskId: id,
            status: {
              in: ["created", "assigned"],
            },
            dueDate: {
              gt: new Date(),
            },
          },
          data: {
            status: "deleted",
            updatedAt: new Date(),
          },
        });

        return task;
      });
    } catch (error) {
      console.error(`[TaskService] Unexpected error in pause:`, error);
      throw error;
    }
  }

  /**
   * Unpause a task
   */
  async unpause(id: string): Promise<TaskDefinition> {
    try {
      const task = await prisma.taskDefinition.update({
        where: { id },
        data: {
          metaStatus: "active",
          updatedAt: new Date(),
        },
        include: {
          category: true,
        },
      });

      return task;
    } catch (error) {
      console.error(`[TaskService] Unexpected error in unpause:`, error);
      throw error;
    }
  }

  /**
   * Soft delete a task
   */
  async softDelete(id: string): Promise<TaskDefinition> {
    try {
      // Start a transaction to ensure all related operations succeed or fail together
      return await prisma.$transaction(async (tx) => {
        // Update task status
        const task = await tx.taskDefinition.update({
          where: { id },
          data: {
            metaStatus: "soft-deleted",
            updatedAt: new Date(),
          },
          include: {
            category: true,
          },
        });

        // Delete future occurrences
        await tx.taskOccurrence.updateMany({
          where: {
            taskId: id,
            status: {
              in: ["created", "assigned"],
            },
            dueDate: {
              gt: new Date(),
            },
          },
          data: {
            status: "deleted",
            updatedAt: new Date(),
          },
        });

        return task;
      });
    } catch (error) {
      console.error(`[TaskService] Unexpected error in softDelete:`, error);
      throw error;
    }
  }
}
