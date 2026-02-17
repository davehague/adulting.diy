import { createError } from "h3";
import { NotificationService } from "@/server/services/NotificationService";

export default defineSchedulerProtectedEventHandler(async (event) => {
  console.log("[Reminder Scheduler] Running reminder notifications...");

  try {
    const notificationService = new NotificationService();
    
    // Send all task reminders
    const result = await notificationService.sendTaskReminders();
    
    console.log(
      `[Reminder Scheduler] Finished. Sent: ${result.sent} reminders, Errors: ${result.errors}`
    );
    
    return {
      success: true,
      remindersSent: result.sent,
      errors: result.errors,
    };
  } catch (error: any) {
    console.error("[Reminder Scheduler] Error during reminder sending:", error);
    throw createError({
      statusCode: 500,
      message: "Reminder scheduler failed",
      cause: error.message,
    });
  }
});