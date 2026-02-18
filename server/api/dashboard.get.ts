import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { DashboardService } from "@/server/services/DashboardService";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const dashboardService = new DashboardService();
      return await dashboardService.getDashboardData(householdId);
    } catch (error) {
      console.error("[API] Error fetching dashboard data:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching dashboard data",
        cause: error,
      });
    }
  }
);
