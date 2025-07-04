import prisma from "@/server/utils/prisma/client";
import type {
  TaskOccurrence,
  OccurrenceHistoryLog,
  TaskDefinition,
  OccurrenceStatus, // Import OccurrenceStatus
} from "@/types";
import { calculateNextDueDate, generateFutureOccurrences, checkEndCondition } from "@/server/utils/schedule"; // Import the correct schedule utility
import { Prisma } from "@prisma/client"; // Import Prisma namespace for types
import { NotificationService } from "./NotificationService"; // Import NotificationService

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
      statusIn?: string;
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
        // Exclude occurrences from soft-deleted tasks
        metaStatus: {
          not: "soft-deleted"
        }
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
      } else if (filters.statusIn) {
        // Handle multiple status values (e.g., "created,assigned")
        const statusValues = filters.statusIn.split(',').map(s => s.trim());
        occurrenceWhere.status = {
          in: statusValues
        };
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
      // Start a transaction to log the change and potentially generate next occurrence
      const updatedOccurrence = await prisma.$transaction(async (tx) => {
        // Update occurrence
        const occurrence = await tx.taskOccurrence.update({
          where: { id },
          data: {
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          },
          include: {
            task: {
              include: {
                category: true, // Include category for task mapping
              },
            },
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

      // After successful completion, generate next occurrence if task is recurring
      if (updatedOccurrence.task) {
        const task = updatedOccurrence.task as unknown as TaskDefinition;
        
        // Only generate next occurrence for recurring tasks (not "once" type)
        if (task.scheduleConfig.type !== "once" && task.metaStatus === "active") {
          try {
            await this.generateNextOccurrence(
              task,
              updatedOccurrence.completedAt!,
              userId
            );
          } catch (error) {
            console.warn(
              `[OccurrenceService] Failed to generate next occurrence for task ${task.id} after execution:`,
              error
            );
            // Don't fail the execution if next occurrence generation fails
          }
        }

        // Send occurrence executed notification
        try {
          const notificationService = new NotificationService();
          
          // Get the user who executed the task
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });

          if (actionUser) {
            await notificationService.sendNotification(
              updatedOccurrence.task.householdId,
              "occurrence_executed",
              {
                user: actionUser as any,
                task: updatedOccurrence.task as unknown as TaskDefinition,
                occurrence: updatedOccurrence,
                actionUser: actionUser as any,
                household: { id: updatedOccurrence.task.householdId, name: "" },
              }
            );
          }
        } catch (notificationError) {
          console.warn(
            `[OccurrenceService] Failed to send occurrence executed notification:`,
            notificationError
          );
        }
      }

      return updatedOccurrence;
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
      const skippedOccurrence = await prisma.$transaction(async (tx) => {
        // Update occurrence
        const occurrence = await tx.taskOccurrence.update({
          where: { id },
          data: {
            status: "skipped",
            skippedAt: new Date(),
            updatedAt: new Date(),
          },
          include: {
            task: {
              include: {
                category: true, // Include category for task mapping
              },
            },
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

      // After successful skip, generate next occurrence if task is recurring
      if (skippedOccurrence.task) {
        const task = skippedOccurrence.task as unknown as TaskDefinition;
        
        // Only generate next occurrence for recurring tasks (not "once" type)
        if (task.scheduleConfig.type !== "once" && task.metaStatus === "active") {
          try {
            await this.generateNextOccurrence(
              task,
              skippedOccurrence.skippedAt!,
              userId
            );
          } catch (error) {
            console.warn(
              `[OccurrenceService] Failed to generate next occurrence for task ${task.id} after skip:`,
              error
            );
            // Don't fail the skip if next occurrence generation fails
          }
        }

        // Send occurrence skipped notification
        try {
          const notificationService = new NotificationService();
          
          // Get the user who skipped the task
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });

          if (actionUser) {
            await notificationService.sendNotification(
              skippedOccurrence.task.householdId,
              "occurrence_skipped",
              {
                user: actionUser as any,
                task: skippedOccurrence.task as unknown as TaskDefinition,
                occurrence: skippedOccurrence,
                actionUser: actionUser as any,
                household: { id: skippedOccurrence.task.householdId, name: "" },
              }
            );
          }
        } catch (notificationError) {
          console.warn(
            `[OccurrenceService] Failed to send occurrence skipped notification:`,
            notificationError
          );
        }
      }

      return skippedOccurrence;
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

      // Send occurrence commented notification
      try {
        const notificationService = new NotificationService();
        
        // Get the occurrence with task info for notifications
        const occurrence = await prisma.taskOccurrence.findUnique({
          where: { id },
          include: {
            task: {
              include: {
                category: true,
              },
            },
          },
        });

        if (occurrence?.task) {
          // Get the user who commented
          const actionUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
          });

          if (actionUser) {
            await notificationService.sendNotification(
              occurrence.task.householdId,
              "occurrence_commented",
              {
                user: actionUser as any,
                task: occurrence.task as unknown as TaskDefinition,
                occurrence: occurrence as unknown as TaskOccurrence,
                actionUser: actionUser as any,
                household: { id: occurrence.task.householdId, name: "" },
              }
            );
          }
        }
      } catch (notificationError) {
        console.warn(
          `[OccurrenceService] Failed to send occurrence commented notification:`,
          notificationError
        );
      }

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
          createdAt: "desc",
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

  /**
   * Generate and create multiple future occurrences for a task up to a horizon date
   * @param task The task definition to generate occurrences for
   * @param horizonDate Generate occurrences up to this date
   * @param userId User ID for history logging
   * @returns Array of created occurrences
   */
  async generateAndCreateOccurrences(
    task: TaskDefinition,
    horizonDate: Date,
    userId: string
  ): Promise<TaskOccurrence[]> {
    try {
      // Get current occurrence count for this task
      const existingCount = await prisma.taskOccurrence.count({
        where: { taskId: task.id }
      });

      // Get the last occurrence to determine starting point for variable intervals
      const lastOccurrence = await prisma.taskOccurrence.findFirst({
        where: { 
          taskId: task.id,
          status: { in: ["completed", "skipped"] }
        },
        orderBy: { dueDate: "desc" }
      });

      const lastCompletedDate = lastOccurrence?.completedAt || lastOccurrence?.skippedAt || null;

      // Generate future due dates using the schedule utility
      const futureDueDates = generateFutureOccurrences(
        task.scheduleConfig,
        horizonDate,
        existingCount,
        lastCompletedDate
      );

      if (futureDueDates.length === 0) {
        console.log(`[OccurrenceService] No future occurrences to generate for task ${task.id}`);
        return [];
      }

      // Create occurrences in batch
      const createdOccurrences: TaskOccurrence[] = [];
      
      await prisma.$transaction(async (tx) => {
        for (const dueDate of futureDueDates) {
          // Check if occurrence already exists for this date (prevent duplicates)
          const existingForDate = await tx.taskOccurrence.findFirst({
            where: {
              taskId: task.id,
              dueDate: dueDate
            }
          });

          if (existingForDate) {
            console.log(`[OccurrenceService] Skipping duplicate occurrence for task ${task.id} on ${dueDate.toISOString()}`);
            continue;
          }

          const initialAssignees = task.defaultAssigneeIds || [];
          const initialStatus: OccurrenceStatus = initialAssignees.length > 0 ? "assigned" : "created";

          // Create the occurrence
          const newOccurrence = await tx.taskOccurrence.create({
            data: {
              taskId: task.id,
              dueDate: dueDate,
              status: initialStatus,
              assigneeIds: initialAssignees,
            },
            include: {
              task: true,
            }
          });

          // Log the creation event
          await tx.occurrenceHistoryLog.create({
            data: {
              occurrenceId: newOccurrence.id,
              userId: userId,
              logType: "status_change",
              newValue: initialStatus,
              comment: `Occurrence generated by scheduler for task: ${task.name}`,
            },
          });

          createdOccurrences.push(newOccurrence as unknown as TaskOccurrence);
        }
      });

      console.log(
        `[OccurrenceService] Generated ${createdOccurrences.length} occurrences for task ${task.id} up to ${horizonDate.toISOString()}`
      );

      return createdOccurrences;
    } catch (error) {
      console.error(
        `[OccurrenceService] Error generating occurrences for task ${task.id}:`,
        error
      );
      throw error;      
    }
  }

  /**
   * Generate next occurrence after a task is completed or skipped (for recurring tasks)
   * @param task The task definition
   * @param lastCompletedDate Date when the occurrence was completed/skipped
   * @param userId User ID for history logging
   * @returns The created occurrence or null if no more occurrences should be generated
   */
  async generateNextOccurrence(
    task: TaskDefinition,
    lastCompletedDate: Date,
    userId: string
  ): Promise<TaskOccurrence | null> {
    try {
      // Get current occurrence count
      const existingCount = await prisma.taskOccurrence.count({
        where: { taskId: task.id }
      });

      // Check if task has reached its end condition
      if (checkEndCondition(task.scheduleConfig, existingCount + 1)) {
        console.log(`[OccurrenceService] Task ${task.id} has reached its end condition, no more occurrences will be generated`);
        return null;
      }

      // Calculate next due date
      const nextDueDate = calculateNextDueDate(task.scheduleConfig, lastCompletedDate);
      
      if (!nextDueDate) {
        console.log(`[OccurrenceService] No next due date calculated for task ${task.id}`);
        return null;
      }

      // Check if this would exceed the end date condition
      if (checkEndCondition(task.scheduleConfig, existingCount + 1, nextDueDate)) {
        console.log(`[OccurrenceService] Next occurrence date ${nextDueDate.toISOString()} would exceed end condition for task ${task.id}`);
        return null;
      }

      // Check if occurrence already exists for this date
      const existingForDate = await prisma.taskOccurrence.findFirst({
        where: {
          taskId: task.id,
          dueDate: nextDueDate
        }
      });

      if (existingForDate) {
        console.log(`[OccurrenceService] Occurrence already exists for task ${task.id} on ${nextDueDate.toISOString()}`);
        return existingForDate as unknown as TaskOccurrence;
      }

      const initialAssignees = task.defaultAssigneeIds || [];
      const initialStatus: OccurrenceStatus = initialAssignees.length > 0 ? "assigned" : "created";

      // Create the next occurrence
      const occurrence = await prisma.$transaction(async (tx) => {
        const newOccurrence = await tx.taskOccurrence.create({
          data: {
            taskId: task.id,
            dueDate: nextDueDate,
            status: initialStatus,
            assigneeIds: initialAssignees,
          },
          include: {
            task: true,
          }
        });

        // Log the creation event
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: newOccurrence.id,
            userId: userId,
            logType: "status_change",
            newValue: initialStatus,
            comment: `Next occurrence generated after task completion`,
          },
        });

        return newOccurrence;
      });

      console.log(
        `[OccurrenceService] Generated next occurrence ${occurrence.id} for task ${task.id} with due date ${nextDueDate.toISOString()}`
      );

      return occurrence as unknown as TaskOccurrence;
    } catch (error) {
      console.error(
        `[OccurrenceService] Error generating next occurrence for task ${task.id}:`,
        error
      );
      throw error;
    }
  }
}
