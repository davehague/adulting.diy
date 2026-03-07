import { createError } from "h3";
import prisma from "@/server/utils/prisma/client";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { TaskDefinition as PrismaTaskDefinition } from "@prisma/client";
import type { Category } from "@/types";
import { addMonths } from "date-fns";

// TODO: Move mapPrismaTaskToDefinition to a shared utility or ensure it's exported from TaskService
// Temporary duplication for demonstration if not exported:
function mapPrismaTaskToDefinitionTemp(
  prismaTask: PrismaTaskDefinition & { category: Category }
): import("@/types").TaskDefinition {
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
    description,
    instructions,
    ...rest
  } = prismaTask;

  return {
    ...rest,
    description: description ?? undefined,
    instructions: instructions ?? undefined,
    householdId: householdId,
    categoryId: categoryId,
    metaStatus: metaStatus as import("@/types").TaskMetaStatus,
    scheduleConfig:
      scheduleConfig as unknown as import("@/types").ScheduleConfig,
    reminderConfig: reminderConfig
      ? (reminderConfig as unknown as import("@/types").ReminderConfig)
      : undefined,
    createdAt: createdAt,
    updatedAt: updatedAt,
    createdByUserId: createdByUserId,
    defaultAssigneeIds: defaultAssigneeIds ?? undefined,
    category: category,
  };
}

export default defineSchedulerProtectedEventHandler(async (event) => {
  console.log("[Scheduler API] Running occurrence generation...");

  const occurrenceService = new OccurrenceService();
  const generationHorizonMonths = 3; // Generate occurrences 3 months ahead
  const horizonDate = addMonths(new Date(), generationHorizonMonths);
  let tasksProcessed = 0;
  let occurrencesGenerated = 0;

  try {
    // 1. Fetch all active task definitions
    const activeTasks = await prisma.taskDefinition.findMany({
      where: {
        metaStatus: "active",
      },
      include: {
        category: true, // Include category for mapping
      },
    });

    console.log(`[Scheduler API] Found ${activeTasks.length} active tasks.`);

    // 2. Process each task
    let tasksSkipped = 0;
    for (const prismaTask of activeTasks) {
      tasksProcessed++;
      const task = mapPrismaTaskToDefinitionTemp(
        prismaTask as PrismaTaskDefinition & { category: Category }
      ); // Use temp mapper

      // 3. Skip tasks that already have a pending occurrence — the execute/skip
      //    flow is responsible for creating the next occurrence. The scheduler
      //    only fills in gaps when that flow missed or failed.
      const pendingCount = await prisma.taskOccurrence.count({
        where: {
          taskId: task.id,
          status: { in: ["created", "assigned"] },
        },
      });

      if (pendingCount > 0) {
        console.log(
          `[Scheduler API] Skipping task ${task.id} — already has ${pendingCount} pending occurrence(s)`
        );
        tasksSkipped++;
        continue;
      }

      // 4. Find the last occurrence to determine base date for next generation
      const lastOccurrence = await prisma.taskOccurrence.findFirst({
        where: { taskId: task.id },
        orderBy: { dueDate: "desc" },
      });
      const lastDueDate = lastOccurrence?.dueDate || null;

      console.log(
        `[Scheduler API] Generating occurrences for task ${task.id} (Last Due: ${lastDueDate})`
      );

      // 5. Generate next occurrence. Use generateNextOccurrence (not bounded
      //    by horizon) so tasks with long intervals (e.g. 6 months) still get
      //    their next occurrence created even when it's beyond the 3-month window.
      if (lastOccurrence && task.scheduleConfig.type !== "once") {
        // For fixed schedules, base date is the due date (preserves cadence).
        // For variable intervals, base date is the completion/skip date.
        const baseDate = task.scheduleConfig.type === "variable_interval"
          ? (lastOccurrence.completedAt || lastOccurrence.skippedAt || lastOccurrence.dueDate)
          : lastOccurrence.dueDate;

        const newOccurrence = await occurrenceService.generateNextOccurrence(
          task,
          baseDate,
          'system'
        );
        if (newOccurrence) {
          occurrencesGenerated++;
        }
      } else {
        // No existing occurrences — use bulk generation for new tasks
        const newOccurrences = await occurrenceService.generateAndCreateOccurrences(
          task,
          horizonDate,
          'system'
        );
        occurrencesGenerated += newOccurrences.length;
      }
    }

    console.log(
      `[Scheduler API] Finished. Processed ${tasksProcessed} tasks (${tasksSkipped} skipped with pending), generated ${occurrencesGenerated} occurrences.`
    );
    return {
      success: true,
      tasksProcessed,
      tasksSkipped,
      occurrencesGenerated,
    };
  } catch (error: any) {
    console.error("[Scheduler API] Error during occurrence generation:", error);
    throw createError({
      statusCode: 500,
      message: "Scheduler run failed",
      cause: error.message,
    });
  }
});
