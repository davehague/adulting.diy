import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { HouseholdService } from "@/server/services/HouseholdService";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const householdService = new HouseholdService();
      const users = await householdService.getUsers(householdId);

      // Return only necessary user info (id, name, email)
      const simplifiedUsers = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      }));

      return simplifiedUsers;
    } catch (error) {
      console.error("[API] Error fetching household users:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching household users",
        cause: error,
      });
    }
  }
);
