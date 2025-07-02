import type { User } from '~/types';
import prisma from '@/server/utils/prisma/client';

export interface DevUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  householdId?: string;
  isAdmin?: boolean;
}

export class DevAuthService {
  private isEnabled: boolean;

  constructor() {
    const config = useRuntimeConfig();
    this.isEnabled = !!config.devBypassEnabled;
  }

  isDevBypassEnabled(): boolean {
    return this.isEnabled;
  }

  async getUsers(): Promise<DevUser[]> {
    if (!this.isEnabled) {
      return [];
    }

    try {
      console.log('[DEV AUTH] Fetching all users for development bypass');
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          householdId: true,
          isAdmin: true,
        },
        orderBy: [
          { name: 'asc' },
          { email: 'asc' }
        ]
      });

      console.log(`[DEV AUTH] Found ${users.length} users for development bypass`);
      return users;
    } catch (error) {
      console.error('[DEV AUTH] Error fetching users:', error);
      return [];
    }
  }

  async getUserById(id: string): Promise<User | null> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      console.log(`[DEV AUTH] Fetching user by ID for development bypass: ${id}`);
      const user = await prisma.user.findUnique({
        where: { id }
      });

      if (user) {
        console.log(`[DEV AUTH] Found user: ${user.email}`);
      } else {
        console.log(`[DEV AUTH] User not found: ${id}`);
      }

      return user;
    } catch (error) {
      console.error('[DEV AUTH] Error fetching user by ID:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      console.log(`[DEV AUTH] Fetching user by email for development bypass: ${email}`);
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (user) {
        console.log(`[DEV AUTH] Found user: ${user.id}`);
      } else {
        console.log(`[DEV AUTH] User not found: ${email}`);
      }

      return user;
    } catch (error) {
      console.error('[DEV AUTH] Error fetching user by email:', error);
      return null;
    }
  }
}

export const devAuthService = new DevAuthService();