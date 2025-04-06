import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import { createError, readBody } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      // Get task ID from route params
      const taskId = event.context.params?.id;

      if (!taskId) {
        throw createError({
          statusCode: 400,
          message: "Task ID is required",
        });
      }

      // Read request body
      const body = await readBody(event);

      // Get task service
      const taskService = new TaskService();

      // Verify task exists and belongs to user's household
      const existingTask = await taskService.findById(taskId);

      if (!existingTask) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }

      if (existingTask.household_id !== householdId) {
        // Use snake_case property from TaskDefinition type
        throw createError({
          statusCode: 403,
          message: "You do not have permission to update this task",
        });
      }

      // Update task using the service
      // Map body properties (likely camelCase) to TaskDefinition properties (snake_case)
      const task = await taskService.update(taskId, {
        name: body.name,
        description: body.description,
        instructions: body.instructions,
        category_id: body.categoryId, // Use snake_case
        schedule_config: body.scheduleConfig, // Use snake_case
        reminder_config: body.reminderConfig, // Use snake_case
        default_assignee_ids: body.defaultAssigneeIds, // Use snake_case
      });

      return task;
    } catch (error) {
      console.error("[API] Error updating task:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error updating task",
        cause: error,
      });
    }
  }
);
