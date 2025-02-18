// server/api/tasks/index.ts
import { TaskService } from "@/server/services/TaskService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";

const taskService = new TaskService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (event.method === "GET") {
    try {
      const tasks = await taskService.findTasksByOrganization(
        authenticatedUser.organizationId
      );
      return tasks;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: "Failed to fetch tasks",
      });
    }
  }

  if (event.method === "POST") {
    try {
      const body = await readBody(event);
      const { task: taskInput, occurrence: occurrenceInput } = body;

      const taskData = {
        ...taskInput,
        organization_id: authenticatedUser.organizationId,
        created_by: authenticatedUser.userId,
      };

      const occurrenceData = {
        ...occurrenceInput,
        // Add any additional occurrence fields you need
      };

      const task = await taskService.createTaskWithOccurrence(
        taskData,
        occurrenceData
      );
      return task;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: "Failed to create task",
      });
    }
  }

  throw createError({
    statusCode: 405,
    message: "Method not allowed",
  });
});
