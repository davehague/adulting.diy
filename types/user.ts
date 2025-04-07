// types/user.ts
import {
  type NotificationPreferences,
  defaultNotificationPreferences,
} from "./notification";

export interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  householdId?: string; // Match DB schema/Prisma model
  isAdmin?: boolean; // Match DB schema/Prisma model
  notificationPreferences: NotificationPreferences; // Keep snake_case keys inside JSON
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
}

export interface UserRegistrationData {
  // Renamed from GoogleUser
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  givenName: string;
  familyName: string;
  locale: string;
}
