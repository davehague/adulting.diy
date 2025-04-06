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
  notification_preferences: NotificationPreferences;
  created_at: Date;
  updated_at: Date;
  last_login: Date;
}

export interface GoogleUser {
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name: string;
  family_name: string;
  locale: string;
}
