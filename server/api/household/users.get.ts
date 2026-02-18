import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { HouseholdService } from "@/server/services/HouseholdService";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const householdService = new HouseholdService();
      const [users, formerMembers] = await Promise.all([
        householdService.getUsers(householdId),
        householdService.getFormerMembers(householdId),
      ]);

      return {
        members: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
        })),
        formerMembers: formerMembers.map((fm) => ({
          userId: fm.userId,
          name: fm.name,
          leftAt: fm.leftAt,
        })),
      };
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
