// server/api/tasks/index.ts
import { type Task } from "@/types/tasks";
import { TaskService } from "@/server/services/TaskService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";

const taskService = new TaskService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (event.method === "GET") {
    const { organization_id } = getQuery(event);

    if (!organization_id) {
      throw createError({
        statusCode: 400,
        message: "organization_id parameter is required",
      });
    }

    try {
      const tasks = await taskService.findTasksByOrganization(
        organization_id as string
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
      const taskData: Omit<Task, "id" | "created_at" | "updated_at"> = {
        ...body,
        created_by: authenticatedUser.email, // We might want to get the user ID instead
      };

      const task = await taskService.createTask(taskData);
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
