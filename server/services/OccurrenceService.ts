import prisma from '@/server/utils/prisma/client';
import type { TaskOccurrence, OccurrenceHistoryLog } from '@/types';

export class OccurrenceService {
  /**
   * Find occurrences for a task
   */
  async findForTask(taskId: string): Promise<TaskOccurrence[]> {
    try {
      const occurrences = await prisma.taskOccurrence.findMany({
        where: { taskId },
        orderBy: {
          dueDate: 'asc'
        }
      });
      
      return occurrences;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in findForTask:`, error);
      throw error;
    }
  }
  
  /**
   * Find occurrences for a household
   */
  async findForHousehold(
    householdId: string,
    filters: {
      status?: string,
      categoryId?: string,
      assigneeId?: string,
      dueDateFrom?: Date,
      dueDateTo?: Date,
      search?: string
    } = {}
  ): Promise<TaskOccurrence[]> {
    try {
      // Build the where clause for tasks
      const taskWhere: any = {
        householdId
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
          has: filters.assigneeId
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
          task: taskWhere
        },
        include: {
          task: {
            include: {
              category: true
            }
          }
        },
        orderBy: {
          dueDate: 'asc'
        }
      });
      
      // Filter by search term if provided
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.toLowerCase();
        return occurrences.filter(occurrence => 
          occurrence.task.name.toLowerCase().includes(searchTerm) ||
          (occurrence.task.description && 
           occurrence.task.description.toLowerCase().includes(searchTerm))
        );
      }
      
      return occurrences;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in findForHousehold:`, error);
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
            include: {
              category: true
            }
          }
        }
      });
      
      return occurrence;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in findById:`, error);
      throw error;
    }
  }
  
  /**
   * Create an occurrence
   */
  async create(data: Omit<TaskOccurrence, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskOccurrence> {
    try {
      const occurrence = await prisma.taskOccurrence.create({
        data,
        include: {
          task: true
        }
      });
      
      return occurrence;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in create:`, error);
      throw error;
    }
  }
  
  /**
   * Update an occurrence
   */
  async update(id: string, userId: string, data: Partial<TaskOccurrence>): Promise<TaskOccurrence> {
    try {
      // Start a transaction to log the changes
      return await prisma.$transaction(async (tx) => {
        // Get current occurrence state
        const currentOccurrence = await tx.taskOccurrence.findUnique({
          where: { id }
        });
        
        if (!currentOccurrence) {
          throw new Error('Occurrence not found');
        }
        
        // Update occurrence
        const updatedOccurrence = await tx.taskOccurrence.update({
          where: { id },
          data: {
            ...data,
            updatedAt: new Date()
          },
          include: {
            task: true
          }
        });
        
        // Log changes
        if (data.dueDate && data.dueDate !== currentOccurrence.dueDate) {
          await tx.occurrenceHistoryLog.create({
            data: {
              occurrenceId: id,
              userId,
              logType: 'date_change',
              oldValue: currentOccurrence.dueDate.toISOString(),
              newValue: data.dueDate.toISOString()
            }
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
                logType: 'assignment_change',
                oldValue: JSON.stringify(oldAssignees),
                newValue: JSON.stringify(newAssignees)
              }
            });
          }
        }
        
        return updatedOccurrence;
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
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date()
          },
          include: {
            task: true
          }
        });
        
        // Log status change
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: id,
            userId,
            logType: 'status_change',
            oldValue: 'assigned',
            newValue: 'completed'
          }
        });
        
        return occurrence;
      });
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in execute:`, error);
      throw error;
    }
  }
  
  /**
   * Skip an occurrence with a reason
   */
  async skip(id: string, userId: string, reason: string): Promise<TaskOccurrence> {
    try {
      // Start a transaction to log the change
      return await prisma.$transaction(async (tx) => {
        // Update occurrence
        const occurrence = await tx.taskOccurrence.update({
          where: { id },
          data: {
            status: 'skipped',
            skippedAt: new Date(),
            updatedAt: new Date()
          },
          include: {
            task: true
          }
        });
        
        // Log status change
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: id,
            userId,
            logType: 'status_change',
            oldValue: 'assigned',
            newValue: 'skipped'
          }
        });
        
        // Log skip reason as a comment
        await tx.occurrenceHistoryLog.create({
          data: {
            occurrenceId: id,
            userId,
            logType: 'comment',
            comment: `Skipped: ${reason}`
          }
        });
        
        return occurrence;
      });
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in skip:`, error);
      throw error;
    }
  }
  
  /**
   * Add a comment to an occurrence
   */
  async addComment(id: string, userId: string, comment: string): Promise<OccurrenceHistoryLog> {
    try {
      const historyLog = await prisma.occurrenceHistoryLog.create({
        data: {
          occurrenceId: id,
          userId,
          logType: 'comment',
          comment
        },
        include: {
          occurrence: true,
          user: true
        }
      });
      
      return historyLog;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in addComment:`, error);
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
          user: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      return historyLogs;
    } catch (error) {
      console.error(`[OccurrenceService] Unexpected error in getHistory:`, error);
      throw error;
    }
  }
}
