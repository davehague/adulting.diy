import type { User, GoogleUser } from '~/types';
import prisma from '@/server/utils/prisma/client';
import { hashPassword, verifyPassword, validatePassword } from '@/server/utils/password';

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

  async createWithEmail(email: string, password: string, name: string): Promise<User> {
    console.log(`[UserService] Creating user with email:`, email);

    try {
      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.error);
      }

      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);

      // Create the user
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          authProvider: 'email',
          name,
          lastLogin: new Date(),
        }
      });

      console.log(`[UserService] Successfully created new user with email:`, newUser.id);
      return newUser;
    } catch (error) {
      console.error(`[UserService] Error in createWithEmail:`, error);
      throw error;
    }
  }

  async authenticateWithEmail(email: string, password: string): Promise<User | null> {
    console.log(`[UserService] Authenticating user with email:`, email);

    try {
      // Find user by email
      const user = await this.findByEmail(email);

      if (!user) {
        console.log(`[UserService] User not found:`, email);
        return null;
      }

      // Check if user uses email authentication
      if (user.authProvider !== 'email') {
        console.log(`[UserService] User does not use email authentication:`, email);
        throw new Error('This account uses a different authentication method');
      }

      // Verify password
      if (!user.password) {
        console.log(`[UserService] User has no password set:`, email);
        return null;
      }

      const isPasswordValid = await verifyPassword(password, user.password);

      if (!isPasswordValid) {
        console.log(`[UserService] Invalid password for user:`, email);
        return null;
      }

      // Update last login
      await this.update(user.id, { lastLogin: new Date() });

      console.log(`[UserService] Successfully authenticated user:`, user.id);
      return user;
    } catch (error) {
      console.error(`[UserService] Error in authenticateWithEmail:`, error);
      throw error;
    }
  }
}
