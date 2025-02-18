// server/api/tasks/occurrences/[id]/status.ts
import { TaskService } from "@/server/services/TaskService";
import { defineProtectedEventHandler } from "@/server/utils/auth";
import { createError } from "h3";

const taskService = new TaskService();

export default defineProtectedEventHandler(async (event, authenticatedUser) => {
  if (event.method !== "PATCH") {
    throw createError({
      statusCode: 405,
      message: "Method not allowed",
    });
  }

  const id = event.context.params?.id;

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Occurrence ID is required",
    });
  }

  try {
    const body = await readBody(event);
    const { status, execution_notes } = body;

    const occurrence = await taskService.updateTaskOccurrenceStatus(
      id,
      status,
      authenticatedUser.email, // We might want to get the user ID instead
      execution_notes
    );
    return occurrence;
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to update task occurrence status",
    });
  }
});
