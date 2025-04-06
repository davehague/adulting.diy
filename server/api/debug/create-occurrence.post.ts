import { defineEventHandler } from "h3"; // Change to standard handler
// import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth"; // Keep original commented out for easy revert
import { TaskService } from "@/server/services/TaskService";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { createError, readBody } from "h3";
import { PrismaClient } from "@prisma/client"; // Correct import for PrismaClient

export default defineEventHandler(async (event) => {
  // Remove authUser, householdId from signature
  try {
    // Read taskId from request body
    const body = await readBody(event);
    const taskId = body.taskId as string;
    const userId = body.userId as string; // Read userId from body

    if (!taskId || !userId) {
      // Check for both taskId and userId
      throw createError({
        statusCode: 400,
        message: "Task ID and User ID are required in the request body",
      });
    }

    // Verify the task exists
    const taskService = new TaskService();
    const task = await taskService.findById(taskId);

    if (!task) {
      throw createError({
        statusCode: 404,
        message: "Task not found",
      });
    }

    // Optional: Verify user exists (can be added for robustness)
    // const prisma = new PrismaClient();
    // const user = await prisma.user.findUnique({ where: { id: userId } });
    // if (!user) {
    //   throw createError({ statusCode: 404, message: "User not found" });
    // }
    // if (user.householdId !== task.household_id) {
    //   throw createError({ statusCode: 403, message: "User and Task household mismatch" });
    // }

    // Create the occurrence using the service
    const occurrenceService = new OccurrenceService();
    const newOccurrence = await occurrenceService.create({
      taskId: taskId, // Renamed from task_id
      dueDate: new Date(), // Renamed from due_date
      status: "assigned", // Default status
      assigneeIds: [userId], // Use userId from request body
    });

    console.log(
      `[API DEBUG] Created test occurrence ${newOccurrence.id} for task ${taskId}`
    );
    return newOccurrence;
  } catch (error) {
    console.error("[API DEBUG] Error creating test occurrence:", error);

    if ((error as any).statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: "Server error creating test occurrence",
      cause: error,
    });
  }
});
