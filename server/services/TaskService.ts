import prisma from "@/server/utils/prisma/client";
import type {
  TaskDefinition,
  Category,
  ScheduleConfig,
  ReminderConfig,
  TaskMetaStatus,
} from "@/types";
import { TaskDefinition as PrismaTaskDefinition, Prisma } from "@prisma/client"; // Import Prisma namespace
import { OccurrenceService } from "./OccurrenceService"; // Import OccurrenceService
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
    household_id: householdId,
    category_id: categoryId,
    meta_status: metaStatus as TaskMetaStatus, // Assert type
    // Prisma stores JSON, assume it matches ScheduleConfig structure
    // Assert structure; Prisma returns JsonValue, needs casting
    schedule_config: scheduleConfig as unknown as ScheduleConfig,
    // Assert structure or undefined; Prisma returns JsonValue | null
    reminder_config: reminderConfig
      ? (reminderConfig as unknown as ReminderConfig)
      : undefined,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by_user_id: createdByUserId,
    default_assignee_ids: defaultAssigneeIds ?? undefined, // Handle null from DB
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

      return tasks.map(mapPrismaTaskToDefinition);
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
      const taskDefinition = mapPrismaTaskToDefinition(
        task as PrismaTaskDefinition & { category: Category } // Cast needed because include adds category
      );

      // After successful task creation, generate initial occurrences
      // Use the mapped TaskDefinition (taskDefinition) which has snake_case properties
      try {
        const occurrenceService = new OccurrenceService();
        console.log(
          `[TaskService] Attempting to generate occurrences for task ${taskDefinition.id}...`
        );
        const generated = await occurrenceService.generateAndCreateOccurrences(
          taskDefinition
        );
        console.log(
          `[TaskService] ${generated.length} occurrences generated for task ${taskDefinition.id}.`
        );
      } catch (genError) {
        // Log the error but allow task creation to succeed for now.
        // Consider if this should throw an error to fail the whole task creation.
        console.error(
          `[TaskService] CRITICAL: Failed to generate initial occurrences for task ${taskDefinition.id}:`,
          genError
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
    // Input data uses our TaskDefinition structure (snake_case, optional category object)
    data: Partial<TaskDefinition>
  ): Promise<TaskDefinition> {
    try {
      // Manually construct the data payload for Prisma, mapping fields
      const prismaUpdateData: Prisma.TaskDefinitionUpdateInput = {
        updatedAt: new Date(),
      };

      // Map snake_case fields from TaskDefinition to camelCase for Prisma
      if (data.name !== undefined) prismaUpdateData.name = data.name;
      if (data.description !== undefined)
        prismaUpdateData.description = data.description; // Prisma handles null
      if (data.instructions !== undefined)
        prismaUpdateData.instructions = data.instructions; // Prisma handles null
      if (data.meta_status !== undefined)
        prismaUpdateData.metaStatus = data.meta_status;
      if (data.default_assignee_ids !== undefined)
        prismaUpdateData.defaultAssigneeIds = data.default_assignee_ids;

      // Handle relation updates via connect
      if (data.category_id !== undefined) {
        prismaUpdateData.category = { connect: { id: data.category_id } };
      }
      // Note: Updating household_id might require similar logic if allowed
      // if (data.household_id !== undefined) {
      //   prismaUpdateData.household = { connect: { id: data.household_id } };
      // }

      // Handle JSON fields
      if (data.schedule_config !== undefined) {
        prismaUpdateData.scheduleConfig =
          data.schedule_config as unknown as Prisma.InputJsonValue;
      }
      if (data.reminder_config !== undefined) {
        // Handle potential undefined for optional reminder_config
        prismaUpdateData.reminderConfig = data.reminder_config
          ? (data.reminder_config as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      } else if (
        data.hasOwnProperty("reminder_config") &&
        data.reminder_config === undefined
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
      return mapPrismaTaskToDefinition(
        task as PrismaTaskDefinition & { category: Category }
      );
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

        return mapPrismaTaskToDefinition(task);
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

      return mapPrismaTaskToDefinition(task);
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

        return mapPrismaTaskToDefinition(task);
      });
    } catch (error) {
      console.error(`[TaskService] Unexpected error in softDelete:`, error);
      throw error;
    }
  }
}
