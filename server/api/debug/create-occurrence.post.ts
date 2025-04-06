import { defineEventHandler, createError, readBody } from "h3"; // Use defineEventHandler
import { TaskService } from "@/server/services/TaskService";
import { OccurrenceService } from "@/server/services/OccurrenceService";
// Removed PrismaClient import

export default defineEventHandler(async (event) => {
  // Removed authUser, householdId
  try {
    // Read taskId and userId from request body
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

    // Verify the task exists and belongs to the user's household
    const taskService = new TaskService();
    const task = await taskService.findById(taskId);

    if (!task) {
      throw createError({
        statusCode: 404,
        message: "Task not found",
      });
    }

    // Removed household check as endpoint is unauthenticated

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
