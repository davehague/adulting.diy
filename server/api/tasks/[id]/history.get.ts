import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import prisma from "@/server/utils/prisma/client";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const taskId = event.context.params?.id;

      if (!taskId) {
        throw createError({
          statusCode: 400,
          message: "Task ID is required",
        });
      }

      const taskService = new TaskService();

      // Verify task exists and belongs to user's household
      const existingTask = await taskService.findById(taskId);

      if (!existingTask) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }

      if (existingTask.householdId !== householdId) {
        throw createError({
          statusCode: 403,
          message: "You do not have permission to view this task's history",
        });
      }

      const historyLogs = await prisma.taskHistoryLog.findMany({
        where: { taskId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return historyLogs;
    } catch (error) {
      console.error("[API] Error fetching task history:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching task history",
        cause: error,
      });
    }
  }
);
