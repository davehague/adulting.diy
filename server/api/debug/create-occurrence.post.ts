import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import { OccurrenceService } from "@/server/services/OccurrenceService";
import { createError, readBody } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      // Read taskId from request body
      const body = await readBody(event);
      const taskId = body.taskId as string;

      if (!taskId) {
        throw createError({
          statusCode: 400,
          message: "Task ID is required in the request body",
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

      if (task.household_id !== householdId) {
        throw createError({
          statusCode: 403,
          message:
            "You do not have permission to create occurrences for this task",
        });
      }

      // Create the occurrence using the service
      const occurrenceService = new OccurrenceService();
      const newOccurrence = await occurrenceService.create({
        taskId: taskId, // Renamed from task_id
        dueDate: new Date(), // Renamed from due_date
        status: "assigned", // Default status
        assigneeIds: [authUser.userId], // Renamed from assignee_ids
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
  }
);
