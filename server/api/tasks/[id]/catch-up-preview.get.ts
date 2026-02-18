import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import { calculateCatchUpDueDate } from "@/server/utils/schedule";
import { createError } from "h3";
import prisma from "@/server/utils/prisma/client";
import type { ScheduleConfig } from "@/types";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const taskId = event.context.params?.id;

      if (!taskId) {
        throw createError({ statusCode: 400, message: "Task ID is required" });
      }

      const taskService = new TaskService();
      const task = await taskService.findById(taskId);

      if (!task) {
        throw createError({ statusCode: 404, message: "Task not found" });
      }

      if (task.householdId !== householdId) {
        throw createError({ statusCode: 403, message: "Forbidden" });
      }

      const now = new Date();
      const overdueOccurrences = await prisma.taskOccurrence.findMany({
        where: {
          taskId,
          status: { in: ["created", "assigned"] },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: "asc" },
      });

      if (overdueOccurrences.length === 0) {
        return { calculatedNextDueDate: null };
      }

      const lastOverdueDueDate =
        overdueOccurrences[overdueOccurrences.length - 1].dueDate;
      const scheduleConfig = task.scheduleConfig as unknown as ScheduleConfig;
      const calculatedDate = calculateCatchUpDueDate(
        scheduleConfig,
        lastOverdueDueDate
      );

      return {
        calculatedNextDueDate: calculatedDate?.toISOString() ?? null,
      };
    } catch (error) {
      if ((error as any).statusCode) throw error;
      throw createError({
        statusCode: 500,
        message: "Server error",
        cause: error,
      });
    }
  }
);
