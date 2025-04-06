// types/category.ts

export interface Category {
  id: string;
  name: string;
  householdId: string | null; // Corresponds to String? in Prisma schema
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Note: The 'tasks' relation is omitted here to avoid potential circular dependencies
  // It can be added if needed where the relation is explicitly included in queries.
}
