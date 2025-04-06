import { defineEventHandler, createError } from "h3";
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
    household_id: householdId,
    category_id: categoryId,
    meta_status: metaStatus as import("@/types").TaskMetaStatus,
    schedule_config:
      scheduleConfig as unknown as import("@/types").ScheduleConfig,
    reminder_config: reminderConfig
      ? (reminderConfig as unknown as import("@/types").ReminderConfig)
      : undefined,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by_user_id: createdByUserId,
    default_assignee_ids: defaultAssigneeIds ?? undefined,
    category: category,
  };
}

export default defineEventHandler(async (event) => {
  console.log("[Scheduler API] Running occurrence generation...");
  // TODO: Add security - This endpoint should ideally be protected (e.g., require a secret key)
  //       if exposed publicly and triggered by an external scheduler.

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
    for (const prismaTask of activeTasks) {
      tasksProcessed++;
      const task = mapPrismaTaskToDefinitionTemp(
        prismaTask as PrismaTaskDefinition & { category: Category }
      ); // Use temp mapper

      // 3. Find the last generated occurrence date for this task
      const lastOccurrence = await prisma.taskOccurrence.findFirst({
        where: { taskId: task.id },
        orderBy: { dueDate: "desc" },
      });
      const lastDueDate = lastOccurrence?.dueDate || null;

      // 4. Determine how many occurrences are needed to reach the horizon
      //    (This is simplified - a more robust approach would calculate dates iteratively)
      //    For now, let's just call the existing generator which defaults to 5,
      //    assuming it will eventually be smarter about the horizon.
      //    A better approach would be needed here for production.
      console.log(
        `[Scheduler API] Generating occurrences for task ${task.id} (Last Due: ${lastDueDate})`
      );

      // 5. Generate and create occurrences (using the service method)
      //    Pass the mapped task definition
      const newOccurrences =
        await occurrenceService.generateAndCreateOccurrences(
          task,
          5 // Keep default 5 for now, needs refinement for horizon logic
          // We might need to pass lastDueDate or startDate to generateFutureDueDates eventually
        );
      occurrencesGenerated += newOccurrences.length;
    }

    console.log(
      `[Scheduler API] Finished. Processed ${tasksProcessed} tasks, generated ${occurrencesGenerated} occurrences.`
    );
    return {
      success: true,
      tasksProcessed,
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
