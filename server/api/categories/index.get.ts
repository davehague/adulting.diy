import { defineProtectedEventHandler } from "@/server/utils/auth";
import { CategoryService } from "@/server/services/CategoryService";
import { UserService } from "@/server/services/UserService";
import { createError } from "h3";

export default defineProtectedEventHandler(async (event, authUser) => {
  try {
    // Get user's current household
    const userService = new UserService();
    const user = await userService.findByEmail(authUser.email);

    if (!user || !user.householdId) {
      throw createError({
        statusCode: 404,
        message: "You are not part of a household",
      });
    }

    // Get categories for the household
    const categoryService = new CategoryService();
    const categories = await categoryService.findForHousehold(user.householdId);

    return categories;
  } catch (error) {
    console.error("[API] Error getting categories:", error);

    if ((error as any).statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: "Server error",
      cause: error,
    });
  }
});
