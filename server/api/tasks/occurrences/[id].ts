// server/api/tasks/occurrences/[id].ts
import { TaskService } from "@/server/services/TaskService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";

const taskService = new TaskService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  const id = event.context.params?.id;

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Occurrence ID is required",
    });
  }

  if (event.method === "PATCH") {
    try {
      const body = await readBody(event);

      // If this is a status update, use the specific method
      if ("status" in body) {
        const occurrence = await taskService.updateTaskOccurrenceStatus(
          id,
          body.status,
          authenticatedUser.userId,
          body.execution_notes
        );
        return occurrence;
      }

      // Otherwise, use the general update method
      const occurrence = await taskService.updateTaskOccurrence(id, body);
      return occurrence;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: "Failed to update task occurrence",
      });
    }
  }

  throw createError({
    statusCode: 405,
    message: "Method not allowed",
  });
});
