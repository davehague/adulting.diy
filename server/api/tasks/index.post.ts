import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { TaskService } from "@/server/services/TaskService";
import { createError, readBody } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      // Read request body
      const body = await readBody(event);

      // Validate required fields
      if (!body.name || !body.categoryId || !body.scheduleConfig) {
        throw createError({
          statusCode: 400,
          message:
            "Missing required fields: name, categoryId, or scheduleConfig",
        });
      }

      // Create task using the service
      const taskService = new TaskService();
      const task = await taskService.create({
        householdId,
        name: body.name,
        description: body.description,
        instructions: body.instructions,
        categoryId: body.categoryId,
        metaStatus: "active", // Default status
        scheduleConfig: body.scheduleConfig,
        reminderConfig: body.reminderConfig,
        createdByUserId: authUser.userId,
        defaultAssigneeIds: body.defaultAssigneeIds || [],
      });

      return task;
    } catch (error) {
      console.error("[API] Error creating task:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error creating task",
        cause: error,
      });
    }
  }
);
