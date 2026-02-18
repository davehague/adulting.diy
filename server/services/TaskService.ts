import prisma from "@/server/utils/prisma/client";
import type {
  TaskDefinition,
  Category,
  ScheduleConfig,
  ReminderConfig,
  TaskMetaStatus,
} from "@/types";
import { TaskDefinition as PrismaTaskDefinition, Prisma } from "@prisma/client"; // Import Prisma namespace
import { calculateCatchUpDueDate } from "@/server/utils/schedule";
import { OccurrenceService } from "./OccurrenceService"; // Import OccurrenceService
import { NotificationService } from "./NotificationService"; // Import NotificationService
// Helper function to map Prisma Task object (with included category) to our TaskDefinition type
export function mapPrismaTaskToDefinition( // Add export keyword
  prismaTask: PrismaTaskDefinition & { category: Category }
): TaskDefinition {
  const {
    householdId,
    categoryId,
    metaStatus,
    scheduleConfig,
    reminderConfig,
    createdAt,
    updatedAt,
    createdByUserId,
    defaultAssigneeIds,
    category,
    description, // Extract description
    instructions, // Extract instructions
    ...rest // Keep the rest for required fields like id, name
  } = prismaTask;

  return {
    ...rest, // Spread required fields (id, name)
    description: description ?? undefined, // Map null to undefined
    instructions: instructions ?? undefined, // Map null to undefined
    householdId: householdId, // Use camelCase
    categoryId: categoryId, // Use camelCase
    metaStatus: metaStatus as TaskMetaStatus, // Use camelCase
    // Prisma stores JSON, assume it matches ScheduleConfig structure
    // Assert structure; Prisma returns JsonValue, needs casting
    scheduleConfig: scheduleConfig as unknown as ScheduleConfig, // Use camelCase
    // Assert structure or undefined; Prisma returns JsonValue | null
    reminderConfig: reminderConfig // Use camelCase
      ? (reminderConfig as unknown as ReminderConfig)
      : undefined,
    createdAt: createdAt, // Use camelCase
    updatedAt: updatedAt, // Use camelCase
    createdByUserId: createdByUserId, // Use camelCase
    defaultAssigneeIds: defaultAssigneeIds ?? [], // Use camelCase, default to empty array
    category: category, // Assign the included category object
  };
}

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

      // Find tasks with their next pending occurrence
      const tasks = await prisma.taskDefinition.findMany({
        where,
        include: {
          category: true,
          occurrences: {
            where: {
              status: { in: ["created", "assigned"] },
            },
            orderBy: { dueDate: "asc" },
            take: 1,
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      return tasks.map((task) => {
        const { occurrences, ...taskWithoutOccurrences } = task;
        const mapped = mapPrismaTaskToDefinition(taskWithoutOccurrences);
        if (occurrences && occurrences.length > 0) {
          const occ = occurrences[0];
          mapped.nextOccurrence = {
            id: occ.id,
            dueDate: occ.dueDate,
            status: occ.status as any,
            assigneeIds: occ.assigneeIds ?? [],
          };
        }
        return mapped;
      });
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

      return task ? mapPrismaTaskToDefinition(task) : null;
    } catch (error) {
      console.error(`[TaskService] Unexpected error in findById:`, error);
      throw error;
    }
  }

  /**
   * Create a task
   */
  // Use Prisma's generated type for input, excluding relations and audit fields
  async create(
    // Use UncheckedCreateInput which expects scalar foreign keys (householdId, categoryId)
    data: Omit<
      Prisma.TaskDefinitionUncheckedCreateInput,
      "id" | "createdAt" | "updatedAt" // Omit audit fields
      // defaultAssigneeIds is part of this type if in schema
    >
  ): Promise<TaskDefinition> {
    try {
      // Ensure data matches Prisma's expected input structure (camelCase)
      const task = await prisma.taskDefinition.create({
        // Pass data directly, as UncheckedCreateInput includes scalar FKs (householdId, categoryId)
        data: {
          ...data,
          // Handle JSON fields correctly
          scheduleConfig: data.scheduleConfig
            ? (data.scheduleConfig as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          reminderConfig: data.reminderConfig
            ? (data.reminderConfig as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
        include: {
          category: true,
        },
      });

      // Map the result (which includes the category) back to our TaskDefinition type
      // Use the corrected mapping function
      const taskDefinition = mapPrismaTaskToDefinition(task);

      // After successful task creation, create the initial occurrence
      // Use the mapped TaskDefinition (taskDefinition) which has camelCase properties
      try {
        const occurrenceService = new OccurrenceService();
        console.log(
          `[TaskService] Attempting to create initial occurrence for task ${taskDefinition.id}...`
        );
        // Pass the created task definition and the user ID who created it
        const initialOccurrence =
          await occurrenceService.createInitialOccurrence(
            taskDefinition,
            taskDefinition.createdByUserId // Pass the creator's ID
          );
        if (initialOccurrence) {
          console.log(
            `[TaskService] Initial occurrence ${initialOccurrence.id} created for task ${taskDefinition.id}.`
          );
        } else {
          console.log(
            `[TaskService] No initial occurrence created for task ${taskDefinition.id} (likely due to schedule).`
          );
        }
      } catch (occError) {
        // Log the error but allow task creation to succeed for now.
        // This prevents the entire task creation from failing if occurrence generation has an issue.
        console.error(
          `[TaskService] CRITICAL: Failed to create initial occurrence for task ${taskDefinition.id}:`,
          occError
        );
      }

      // Send task creation notification
      try {
        const notificationService = new NotificationService();
        
        // Get the user who created the task for notification context
        const createdByUser = await prisma.user.findUnique({
          where: { id: taskDefinition.createdByUserId },
          select: { id: true, name: true, email: true },
        });

        if (createdByUser) {
          await notificationService.sendNotification(
            taskDefinition.householdId,
            "task_created",
            {
              user: createdByUser as any,
              task: taskDefinition,
              actionUser: createdByUser as any,
              household: { id: taskDefinition.householdId, name: "" },
            },
            taskDefinition.createdByUserId // Don't notify the creator
          );
        }
      } catch (notificationError) {
        // Log notification errors but don't fail task creation
        console.error(
          `[TaskService] Failed to send task creation notification for task ${taskDefinition.id}:`,
          notificationError
        );
      }

      return taskDefinition; // Return the mapped task definition
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
    // Input data uses our TaskDefinition structure (camelCase, optional category object)
    data: Partial<TaskDefinition>
  ): Promise<TaskDefinition> {
    try {
      // Manually construct the data payload for Prisma, mapping fields
      const prismaUpdateData: Prisma.TaskDefinitionUpdateInput = {
        updatedAt: new Date(),
      };

      // Map camelCase fields from TaskDefinition to camelCase for Prisma (already matching)
      if (data.name !== undefined) prismaUpdateData.name = data.name;
      if (data.description !== undefined)
        prismaUpdateData.description = data.description; // Prisma handles null
      if (data.instructions !== undefined)
        prismaUpdateData.instructions = data.instructions; // Prisma handles null
      if (data.metaStatus !== undefined)
        // Use camelCase
        prismaUpdateData.metaStatus = data.metaStatus;
      if (data.defaultAssigneeIds !== undefined)
        // Use camelCase
        prismaUpdateData.defaultAssigneeIds = data.defaultAssigneeIds;

      // Handle relation updates via connect
      if (data.categoryId !== undefined) {
        // Use camelCase
        prismaUpdateData.category = { connect: { id: data.categoryId } };
      }
      // Note: Updating household_id might require similar logic if allowed
      // if (data.household_id !== undefined) {
      //   prismaUpdateData.household = { connect: { id: data.household_id } };
      // }

      // Handle JSON fields
      if (data.scheduleConfig !== undefined) {
        // Use camelCase
        prismaUpdateData.scheduleConfig =
          data.scheduleConfig as unknown as Prisma.InputJsonValue;
      }
      if (data.reminderConfig !== undefined) {
        // Use camelCase
        // Handle potential undefined for optional reminder_config
        prismaUpdateData.reminderConfig = data.reminderConfig
          ? (data.reminderConfig as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      } else if (
        // Use camelCase
        data.hasOwnProperty("reminderConfig") &&
        data.reminderConfig === undefined
      ) {
        // Explicitly set to null if undefined was passed
        prismaUpdateData.reminderConfig = Prisma.JsonNull;
      }

      const task = await prisma.taskDefinition.update({
        where: { id },
        data: prismaUpdateData,
        include: {
          category: true,
        },
      });

      // Map the result (which includes the category) back to our TaskDefinition type
      // Use the corrected mapping function
      return mapPrismaTaskToDefinition(task);
    } catch (error) {
      console.error(`[TaskService] Unexpected error in update:`, error);
      throw error;
    }
  }

  /**
   * Pause a task
   */
  async pause(id: string, userId?: string): Promise<TaskDefinition> {
    try {
      // Start a transaction to ensure all related operations succeed or fail together
      const pausedTask = await prisma.$transaction(async (tx) => {
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

        // Use the corrected mapping function
        return mapPrismaTaskToDefinition(task);
      });

      // Send task paused notification
      if (userId) {
        try {
          const notificationService = new NotificationService();
          
          // Get the user who paused the task
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });

          if (actionUser) {
            await notificationService.sendNotification(
              pausedTask.householdId,
              "task_paused",
              {
                user: actionUser as any,
                task: pausedTask,
                actionUser: actionUser as any,
                household: { id: pausedTask.householdId, name: "" },
              }
            );
          }
        } catch (notificationError) {
          console.error(
            `[TaskService] Failed to send task paused notification for task ${id}:`,
            notificationError
          );
        }
      }

      return pausedTask;
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

      // Use the corrected mapping function
      return mapPrismaTaskToDefinition(task);
    } catch (error) {
      console.error(`[TaskService] Unexpected error in unpause:`, error);
      throw error;
    }
  }

  /**
   * Soft delete a task
   */
  async softDelete(id: string, userId?: string): Promise<TaskDefinition> {
    try {
      // Start a transaction to ensure all related operations succeed or fail together
      const deletedTask = await prisma.$transaction(async (tx) => {
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

        // Use the corrected mapping function
        return mapPrismaTaskToDefinition(task);
      });

      // Send task deleted notification
      if (userId) {
        try {
          const notificationService = new NotificationService();
          
          // Get the user who deleted the task
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });

          if (actionUser) {
            await notificationService.sendNotification(
              deletedTask.householdId,
              "task_deleted",
              {
                user: actionUser as any,
                task: deletedTask,
                actionUser: actionUser as any,
                household: { id: deletedTask.householdId, name: "" },
              }
            );
          }
        } catch (notificationError) {
          console.error(
            `[TaskService] Failed to send task deleted notification for task ${id}:`,
            notificationError
          );
        }
      }

      return deletedTask;
    } catch (error) {
      console.error(`[TaskService] Unexpected error in softDelete:`, error);
      throw error;
    }
  }

  /**
   * Catch up a task by skipping all overdue occurrences and creating the next future occurrence.
   */
  async catchUp(
    id: string,
    userId: string,
    comment?: string
  ): Promise<{ occurrencesSkipped: number; newDueDate: Date | null }> {
    try {
      const task = await prisma.taskDefinition.findUnique({
        where: { id },
        include: { category: true },
      });

      if (!task) {
        throw new Error("Task not found");
      }

      const scheduleConfig = task.scheduleConfig as unknown as ScheduleConfig;
      const now = new Date();

      // Find all overdue occurrences
      const overdueOccurrences = await prisma.taskOccurrence.findMany({
        where: {
          taskId: id,
          status: { in: ["created", "assigned"] },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: "asc" },
      });

      if (overdueOccurrences.length === 0) {
        throw new Error("No overdue occurrences to catch up");
      }

      const lastOverdueDueDate =
        overdueOccurrences[overdueOccurrences.length - 1].dueDate;
      const newDueDate = calculateCatchUpDueDate(
        scheduleConfig,
        lastOverdueDueDate
      );

      await prisma.$transaction(async (tx) => {
        // Skip all overdue occurrences
        for (const occ of overdueOccurrences) {
          await tx.taskOccurrence.update({
            where: { id: occ.id },
            data: {
              status: "skipped",
              skippedAt: now,
              updatedAt: now,
            },
          });

          await tx.occurrenceHistoryLog.create({
            data: {
              occurrenceId: occ.id,
              userId,
              logType: "status_change",
              oldValue: occ.status,
              newValue: "skipped",
              comment: "Skipped during catch-up",
            },
          });
        }

        // Check for existing future occurrence
        const existingFuture = await tx.taskOccurrence.findFirst({
          where: {
            taskId: id,
            status: { in: ["created", "assigned"] },
            dueDate: { gte: now },
          },
        });

        let actualNewDueDate = newDueDate;

        // Create new occurrence if needed
        if (newDueDate && !existingFuture) {
          const initialAssignees = task.defaultAssigneeIds || [];
          const initialStatus =
            initialAssignees.length > 0 ? "assigned" : "created";

          await tx.taskOccurrence.create({
            data: {
              taskId: id,
              dueDate: newDueDate,
              status: initialStatus,
              assigneeIds: initialAssignees,
            },
          });
        } else if (existingFuture) {
          actualNewDueDate = existingFuture.dueDate;
        }

        // Log the catch-up event
        await tx.taskHistoryLog.create({
          data: {
            taskId: id,
            userId,
            logType: "catch_up",
            details: {
              occurrencesSkipped: overdueOccurrences.length,
              newDueDate: actualNewDueDate?.toISOString() ?? null,
              previousDueDate: lastOverdueDueDate.toISOString(),
            },
            comment: comment || null,
          },
        });
      });

      // Check for future occurrence for return value
      const existingFuture = await prisma.taskOccurrence.findFirst({
        where: {
          taskId: id,
          status: { in: ["created", "assigned"] },
          dueDate: { gte: now },
        },
      });

      return {
        occurrencesSkipped: overdueOccurrences.length,
        newDueDate: existingFuture ? existingFuture.dueDate : newDueDate,
      };
    } catch (error) {
      console.error(`[TaskService] Unexpected error in catchUp:`, error);
      throw error;
    }
  }
}
