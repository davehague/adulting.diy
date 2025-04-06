import type { User, GoogleUser } from '~/types';
import prisma from '@/server/utils/prisma/client';

export class UserService {
  async findByEmail(email: string): Promise<User | null> {
    console.log(`[UserService] Finding user by email:`, email);
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });

      console.log(
        `[UserService] Find result:`,
        user ? "User found" : "User not found"
      );
      return user;
    } catch (error) {
      console.error(`[UserService] Unexpected error in findByEmail:`, error);
      throw error;
    }
  }

  async createFromGoogle(googleUser: GoogleUser): Promise<User> {
    console.log(
      `[UserService] Creating/updating user from Google:`,
      googleUser.email
    );
    try {
      const existingUser = await this.findByEmail(googleUser.email);

      if (existingUser) {
        console.log(`[UserService] Updating existing user:`, existingUser.id);
        return this.update(existingUser.id, {
          lastLogin: new Date(),
        });
      }

      console.log(`[UserService] No existing user found, creating new user`);
      const newUser = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          lastLogin: new Date(),
          // Default notification preferences will be set by the schema
        }
      });

      console.log(`[UserService] Successfully created new user:`, newUser.id);
      return newUser;
    } catch (error) {
      console.error(`[UserService] Error in createFromGoogle:`, error);
      throw error;
    }
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const updated = await prisma.user.update({
      where: { id },
      data: updateData
    });

    return updated;
  }
}
