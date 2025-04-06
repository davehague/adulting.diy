import prisma from '@/server/utils/prisma/client';
import type { Category } from '@/types';

export class CategoryService {
  /**
   * Find categories for a household
   */
  async findForHousehold(householdId: string): Promise<Category[]> {
    try {
      // Get both default categories (where household_id is null) and household-specific categories
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { householdId },
            { householdId: null, isDefault: true }
          ]
        },
        orderBy: {
          name: 'asc'
        }
      });

      return categories;
    } catch (error) {
      console.error(`[CategoryService] Unexpected error in findForHousehold:`, error);
      throw error;
    }
  }

  /**
   * Find a category by ID
   */
  async findById(id: string): Promise<Category | null> {
    try {
      const category = await prisma.category.findUnique({
        where: { id }
      });

      return category;
    } catch (error) {
      console.error(`[CategoryService] Unexpected error in findById:`, error);
      throw error;
    }
  }

  /**
   * Create a custom category for a household
   */
  async create(name: string, householdId: string): Promise<Category> {
    try {
      const category = await prisma.category.create({
        data: {
          name,
          householdId,
          isDefault: false
        }
      });

      return category;
    } catch (error) {
      console.error(`[CategoryService] Unexpected error in create:`, error);
      throw error;
    }
  }

  /**
   * Update a custom category
   */
  async update(id: string, name: string): Promise<Category> {
    try {
      // Get the category first to ensure it's not a default category
      const existingCategory = await prisma.category.findUnique({
        where: { id }
      });

      if (!existingCategory || existingCategory.isDefault) {
        throw new Error('Cannot update a default category');
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          name,
          updatedAt: new Date()
        }
      });

      return category;
    } catch (error) {
      console.error(`[CategoryService] Unexpected error in update:`, error);
      throw error;
    }
  }

  /**
   * Delete a custom category
   */
  async delete(id: string): Promise<void> {
    try {
      // First, check if there are any tasks using this category
      const tasksCount = await prisma.taskDefinition.count({
        where: {
          categoryId: id
        }
      });

      if (tasksCount > 0) {
        throw new Error(`Cannot delete category that is being used by ${tasksCount} tasks`);
      }

      // Get the category to ensure it's not a default category
      const existingCategory = await prisma.category.findUnique({
        where: { id }
      });

      if (!existingCategory || existingCategory.isDefault) {
        throw new Error('Cannot delete a default category');
      }

      // Delete the category
      await prisma.category.delete({
        where: { id }
      });
    } catch (error) {
      console.error(`[CategoryService] Unexpected error in delete:`, error);
      throw error;
    }
  }
}
