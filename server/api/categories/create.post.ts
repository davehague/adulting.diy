import { defineProtectedEventHandler } from "@/server/utils/auth";
import { CategoryService } from "@/server/services/CategoryService";
import { UserService } from "@/server/services/UserService";
import { HouseholdService } from "@/server/services/HouseholdService";
import { createError, readBody } from "h3";

export default defineProtectedEventHandler(async (event, authUser) => {
  try {
    const body = await readBody(event);

    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      throw createError({
        statusCode: 400,
        message: "Category name is required",
      });
    }

    // Get user's current household
    const userService = new UserService();
    const user = await userService.findByEmail(authUser.email);

    if (!user || !user.householdId) {
      throw createError({
        statusCode: 404,
        message: "You are not part of a household",
      });
    }

    // Check if user is an admin (only admins can create custom categories)
    const householdService = new HouseholdService();
    const isAdmin = await householdService.isUserAdmin(
      authUser.userId,
      user.householdId
    );

    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        message: "Only household admins can create custom categories",
      });
    }

    // Create the category
    const categoryService = new CategoryService();
    const category = await categoryService.create(
      body.name.trim(),
      user.householdId
    );

    return category;
  } catch (error) {
    console.error("[API] Error creating category:", error);

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
