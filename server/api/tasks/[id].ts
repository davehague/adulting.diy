// server/api/tasks/[id].ts
import { TaskService } from "@/server/services/TaskService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";

const taskService = new TaskService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  const id = event.context.params?.id;

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Task ID is required",
    });
  }

  if (event.method === "GET") {
    try {
      const task = await taskService.findTaskById(id);
      if (!task) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }
      if (task.organization_id !== authenticatedUser.organizationId) {
        throw createError({
          statusCode: 403,
          message: "Unauthorized access to task",
        });
      }
      return task;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: "Failed to fetch task",
      });
    }
  }

  if (event.method === "PATCH") {
    try {
      const task = await taskService.findTaskById(id);
      if (!task) {
        throw createError({
          statusCode: 404,
          message: "Task not found",
        });
      }
      if (task.organization_id !== authenticatedUser.organizationId) {
        throw createError({
          statusCode: 403,
          message: "Unauthorized access to task",
        });
      }

      const body = await readBody(event);
      const updatedTask = await taskService.updateTask(id, body);
      return updatedTask;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: "Failed to update task",
      });
    }
  }

  throw createError({
    statusCode: 405,
    message: "Method not allowed",
  });
});
