import prisma from "@/server/utils/prisma/client";
import type {
  TaskOccurrence,
  OccurrenceHistoryLog,
  TaskDefinition,
  OccurrenceStatus, // Import OccurrenceStatus
} from "@/types";
import { calculateNextDueDate } from "@/server/utils/schedule"; // Import the correct schedule utility
import { Prisma } from "@prisma/client"; // Import Prisma namespace for types

// Define a type for the updatable fields, excluding relations and immutable fields
type OccurrenceUpdateData = Partial<
  Pick<
    TaskOccurrence,
    "dueDate" | "status" | "assigneeIds" | "completedAt" | "skippedAt"
  >
>;
export class OccurrenceService {
  /**
   * Find occurrences for a task
   */
  async findForTask(taskId: string): Promise<TaskOccurrence[]> {
    try {
      const occurrences = await prisma.taskOccurrence.findMany({
        where: { taskId },
        orderBy: {
          dueDate: "asc",
        },
      });

      // Cast Prisma result to TaskOccurrence[]
      return occurrences as unknown as TaskOccurrence[];
    } catch (error) {
      console.error(
        `[OccurrenceService] Unexpected error in findForTask:`,
        error
      );
      throw error;
    }
  }

  /**
   * Find occurrences for a household
   */
  async findForHousehold(
    householdId: string,
    filters: {
      status?: string;
      categoryId?: string;
      assigneeId?: string;
      dueDateFrom?: Date;
      dueDateTo?: Date;
      search?: string;
    } = {}
  ): Promise<TaskOccurrence[]> {
    try {
      // Build the where clause for tasks
      const taskWhere: any = {
        householdId,
      };

      // Add category filter if provided
      if (filters.categoryId) {
        taskWhere.categoryId = filters.categoryId;
      }

      // Build the where clause for occurrences
      const occurrenceWhere: any = {};

      // Add status filter if provided
      if (filters.status) {
        occurrenceWhere.status = filters.status;
      }

      // Add assignee filter if provided
      if (filters.assigneeId) {
        occurrenceWhere.assigneeIds = {
          has: filters.assigneeId,
        };
      }

      // Add due date range filter if provided
      if (filters.dueDateFrom || filters.dueDateTo) {
        occurrenceWhere.dueDate = {};

        if (filters.dueDateFrom) {
          occurrenceWhere.dueDate.gte = filters.dueDateFrom;
        }

        if (filters.dueDateTo) {
          occurrenceWhere.dueDate.lte = filters.dueDateTo;
        }
      }

      // Find occurrences
      const occurrences = await prisma.taskOccurrence.findMany({
        where: {
          ...occurrenceWhere,
          task: taskWhere,
        },
        include: {
          task: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      });

      // Filter by search term if provided
      if (filters.search && filters.search.trim() !== "") {
        const searchTerm = filters.search.toLowerCase();
        // Cast filtered result
        return occurrences.filter(
          (occurrence) =>
            occurrence.task.name.toLowerCase().includes(searchTerm) ||
            (occurrence.task.description &&
              occurrence.task.description.toLowerCase().includes(searchTerm))
        ) as unknown as TaskOccurrence[]; // Ensure cast is here
      }

      // Cast Prisma result
      return occurrences as unknown as TaskOccurrence[];
    } catch (error) {
      console.error(
        `[OccurrenceService] Unexpected error in findForHousehold:`,
        error
      );
      throw error;
    }
  }

  /**
   * Find an occurrence by ID
   */
  async findById(id: string): Promise<TaskOccurrence | null> {
    try {
      const occurrence = await prisma.taskOccurrence.findUnique({
        where: { id },
        include: {
          task: {
            select: {
              // Use select to specify fields
              id: true,
              name: true,
              description: true,
              householdId: true, // Explicitly select householdId (camelCase)
              category: true, // Keep including category if needed elsewhere
              // Add other necessary task fields if required by TaskOccurrence type
            },
          },
        },
      });

      // Cast Prisma result
      return occurrence as unknown as TaskOccurrence | null;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in findById:`, error);
      throw error;
    }
  }

  /**
   * Create an occurrence
   */
  // Use Prisma's Unchecked type which expects scalar FKs like taskId
  async create(
    data: Omit<
      Prisma.TaskOccurrenceUncheckedCreateInput,
      "id" | "createdAt" | "updatedAt"
    >
  ): Promise<TaskOccurrence> {
    try {
      const occurrence = await prisma.taskOccurrence.create({
        // Pass data directly as it matches the UncheckedCreateInput structure
        data: data,
        include: {
          task: true, // Include the related task in the returned object
        },
      });

      // Cast Prisma result
      return occurrence as unknown as TaskOccurrence;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in create:`, error);
      throw error;
    }
  }

  /**
   * Creates the initial occurrence for a newly created task definition.
   * Calculates the first due date and creates the occurrence and history log.
   */
  async createInitialOccurrence(
    task: TaskDefinition,
    userId: string // User who created the task
  ): Promise<TaskOccurrence | null> {
    try {
      const initialDueDate = calculateNextDueDate(task.scheduleConfig);

      if (!initialDueDate) {
        console.warn(
          `[OccurrenceService] Could not calculate initial due date for task ${task.id}. No occurrence created.`
        );
        return null;
      }

      const initialAssignees = task.defaultAssigneeIds || [];
      const initialStatus: OccurrenceStatus =
        initialAssignees.length > 0 ? "assigned" : "created";

      // Use a transaction to create occurrence and history log together
      const occurrence = await prisma.$transaction(async (tx) => {
        const newOccurrence = await tx.taskOccurrence.create({
          data: {
            taskId: task.id,
            dueDate: initialDueDate,
            status: initialStatus,
            assigneeIds: initialAssignees,
          },
        });

        // Log the creation event
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: newOccurrence.id,
            userId: userId, // The user who triggered the task creation
            logType: "status_change", // Log as status change to 'created' or 'assigned'
            newValue: initialStatus,
            comment: `Initial occurrence created for task: ${task.name}`, // Add context
          },
        });

        return newOccurrence;
      });

      console.log(
        `[OccurrenceService] Initial occurrence ${
          occurrence.id
        } created for task ${
          task.id
        } with status '${initialStatus}' and due date ${initialDueDate.toISOString()}`
      );
      return occurrence as unknown as TaskOccurrence; // Cast Prisma result
    } catch (error) {
      console.error(
        `[OccurrenceService] Error creating initial occurrence for task ${task.id}:`,
        error
      );
      // Decide whether to re-throw or return null based on desired behavior in TaskService
      throw error; // Re-throw to potentially fail the task creation if occurrence fails
    }
  }
  /**
   * Update an occurrence
   */
  async update(
    id: string,
    userId: string,
    data: OccurrenceUpdateData // Use the refined type
  ): Promise<TaskOccurrence> {
    try {
      // Start a transaction to log the changes
      return await prisma.$transaction(async (tx) => {
        // Get current occurrence state
        const currentOccurrence = await tx.taskOccurrence.findUnique({
          where: { id },
        });

        if (!currentOccurrence) {
          throw new Error("Occurrence not found");
        }

        // Update occurrence
        const updatedOccurrence = await tx.taskOccurrence.update({
          where: { id },
          // Construct the data payload explicitly with allowed fields
          data: {
            ...(data.dueDate && { dueDate: data.dueDate }),
            ...(data.status && { status: data.status }),
            ...(data.assigneeIds && { assigneeIds: data.assigneeIds }),
            ...(data.completedAt && { completedAt: data.completedAt }),
            ...(data.skippedAt && { skippedAt: data.skippedAt }),
            updatedAt: new Date(), // Always update this timestamp
          },
          include: {
            task: true,
          },
        });

        // Log changes
        if (data.dueDate && data.dueDate !== currentOccurrence.dueDate) {
          await tx.occurrenceHistoryLog.create({
            data: {
              occurrenceId: id,
              userId,
              logType: "date_change",
              oldValue: currentOccurrence.dueDate.toISOString(),
              newValue: data.dueDate.toISOString(),
            },
          });
        }

        // Log assignee changes if provided
        if (data.assigneeIds) {
          const oldAssignees = currentOccurrence.assigneeIds || [];
          const newAssignees = data.assigneeIds || [];

          if (JSON.stringify(oldAssignees) !== JSON.stringify(newAssignees)) {
            await tx.occurrenceHistoryLog.create({
              data: {
                occurrenceId: id,
                userId,
                logType: "assignment_change",
                oldValue: JSON.stringify(oldAssignees),
                newValue: JSON.stringify(newAssignees),
              },
            });
          }
        }

        return updatedOccurrence as unknown as TaskOccurrence; // Ensure cast is here
      });
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in update:`, error);
      throw error;
    }
  }

  /**
   * Execute (complete) an occurrence
   */
  async execute(id: string, userId: string): Promise<TaskOccurrence> {
    try {
      // Start a transaction to log the change
      return await prisma.$transaction(async (tx) => {
        // Update occurrence
        const occurrence = await tx.taskOccurrence.update({
          where: { id },
          data: {
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          },
          include: {
            task: true,
          },
        });

        // Log status change
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: id,
            userId,
            logType: "status_change",
            oldValue: "assigned",
            newValue: "completed",
          },
        });

        return occurrence as unknown as TaskOccurrence; // Ensure cast is here
      });
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in execute:`, error);
      throw error;
    }
  }

  /**
   * Skip an occurrence with a reason
   */
  async skip(
    id: string,
    userId: string,
    reason: string
  ): Promise<TaskOccurrence> {
    try {
      // Start a transaction to log the change
      return await prisma.$transaction(async (tx) => {
        // Update occurrence
        const occurrence = await tx.taskOccurrence.update({
          where: { id },
          data: {
            status: "skipped",
            skippedAt: new Date(),
            updatedAt: new Date(),
          },
          include: {
            task: true,
          },
        });

        // Log status change
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: id,
            userId,
            logType: "status_change",
            oldValue: "assigned",
            newValue: "skipped",
          },
        });

        // Log skip reason as a comment
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: id,
            userId,
            logType: "comment",
            comment: `Skipped: ${reason}`,
          },
        });

        return occurrence as unknown as TaskOccurrence; // Ensure cast is here
      });
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in skip:`, error);
      throw error;
    }
  }

  /**
   * Add a comment to an occurrence
   */
  async addComment(
    id: string,
    userId: string,
    comment: string
  ): Promise<OccurrenceHistoryLog> {
    try {
      const historyLog = await prisma.occurrenceHistoryLog.create({
        data: {
          occurrenceId: id,
          userId,
          logType: "comment",
          comment,
        },
        include: {
          occurrence: true,
          user: true,
        },
      });

      // Cast Prisma result to align with OccurrenceHistoryLog type
      return historyLog as unknown as OccurrenceHistoryLog;
    } catch (error) {
      console.error(
        `[OccurrenceService] Unexpected error in addComment:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get history logs for an occurrence
   */
  async getHistory(occurrenceId: string): Promise<OccurrenceHistoryLog[]> {
    try {
      const historyLogs = await prisma.occurrenceHistoryLog.findMany({
        where: { occurrenceId },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Cast Prisma result to align with OccurrenceHistoryLog[] type
      return historyLogs as unknown as OccurrenceHistoryLog[];
    } catch (error) {
      console.error(
        `[OccurrenceService] Unexpected error in getHistory:`,
        error
      );
      throw error;
    }
  }
}
