import prisma from '@/server/utils/prisma/client';
import type { Household } from '@/types';

export class HouseholdService {
  /**
   * Generates a random 8-character invite code
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Find a household by ID
   */
  async findById(id: string): Promise<Household | null> {
    try {
      const household = await prisma.household.findUnique({
        where: { id }
      });

      return household;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in findById:`, error);
      throw error;
    }
  }

  /**
   * Find a household by invite code
   */
  async findByInviteCode(inviteCode: string): Promise<Household | null> {
    try {
      const household = await prisma.household.findUnique({
        where: { inviteCode }
      });

      return household;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in findByInviteCode:`, error);
      throw error;
    }
  }

  /**
   * Create a new household
   */
  async create(name: string): Promise<Household> {
    try {
      const inviteCode = this.generateInviteCode();

      const household = await prisma.household.create({
        data: {
          name,
          inviteCode
        }
      });

      return household;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in create:`, error);
      throw error;
    }
  }

  /**
   * Update a household
   */
  async update(id: string, updates: Partial<Household>): Promise<Household> {
    try {
      const household = await prisma.household.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      return household;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in update:`, error);
      throw error;
    }
  }

  /**
   * Add a user to a household
   */
  async addUser(householdId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          householdId,
          isAdmin,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in addUser:`, error);
      throw error;
    }
  }

  /**
   * Remove a user from a household
   */
  async removeUser(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          householdId: null,
          isAdmin: false,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in removeUser:`, error);
      throw error;
    }
  }

  /**
   * Get all users in a household
   */
  async getUsers(householdId: string) {
    try {
      const users = await prisma.user.findMany({
        where: {
          householdId
        }
      });

      return users;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in getUsers:`, error);
      throw error;
    }
  }

  /**
   * Check if user is admin of a household
   */
  async isUserAdmin(userId: string, householdId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          householdId
        },
        select: {
          isAdmin: true
        }
      });

      return user?.isAdmin || false;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in isUserAdmin:`, error);
      throw error;
    }
  }

  /**
   * Regenerate invite code for a household
   */
  async regenerateInviteCode(householdId: string): Promise<string> {
    try {
      const newInviteCode = this.generateInviteCode();
      
      await prisma.household.update({
        where: { id: householdId },
        data: {
          inviteCode: newInviteCode,
          updatedAt: new Date()
        }
      });

      return newInviteCode;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in regenerateInviteCode:`, error);
      throw error;
    }
  }

  /**
   * Update user admin status
   */
  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isAdmin,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in updateUserAdminStatus:`, error);
      throw error;
    }
  }

  /**
   * Get household member count
   */
  async getMemberCount(householdId: string): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: {
          householdId
        }
      });

      return count;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in getMemberCount:`, error);
      throw error;
    }
  }

  /**
   * Check if user is the only admin in household
   */
  async isOnlyAdmin(userId: string, householdId: string): Promise<boolean> {
    try {
      const adminCount = await prisma.user.count({
        where: {
          householdId,
          isAdmin: true
        }
      });

      const userIsAdmin = await this.isUserAdmin(userId, householdId);
      
      return userIsAdmin && adminCount === 1;
    } catch (error) {
      console.error(`[HouseholdService] Unexpected error in isOnlyAdmin:`, error);
      throw error;
    }
  }
}
