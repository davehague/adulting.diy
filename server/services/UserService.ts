import type { User, GoogleUser } from "~/types";
import { serverSupabase } from "@/server/utils/supabaseServerClient";

export class UserService {
  async findByEmail(email: string): Promise<User | null> {
    console.log(`[UserService] Finding user by email:`, email);
    try {
      const { data, error } = await serverSupabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.error(`[UserService] Error finding user:`, error);
        throw error;
      }

      console.log(
        `[UserService] Find result:`,
        data ? "User found" : "User not found"
      );
      return data;
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
          last_login: new Date(),
        });
      }

      // Default organization_id - you might want to handle this differently
      const DEFAULT_ORG_ID = 1;

      console.log(`[UserService] No existing user found, creating new user`);
      const { data, error } = await serverSupabase
        .from("users")
        .insert({
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          organization_id: DEFAULT_ORG_ID,
          last_login: new Date(),
          // created_at and updated_at will be handled by Supabase
        })
        .select()
        .single();

      if (error) {
        console.error(`[UserService] Error creating user:`, error);
        throw error;
      }

      console.log(`[UserService] Successfully created new user:`, data.id);
      return data;
    } catch (error) {
      console.error(`[UserService] Error in createFromGoogle:`, error);
      throw error;
    }
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    const { data: updated, error } = await serverSupabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(`[UserService] Error updating user:`, error);
      throw error;
    }

    return updated;
  }
}
