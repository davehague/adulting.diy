import type { Organization, CreateOrganizationDTO } from "@/types/interfaces";
import { serverSupabase } from "@/server/utils/supabaseServerClient";

export class OrganizationService {
  async findById(id: string): Promise<Organization | null> {
    console.log(`[OrganizationService] Finding organization by id:`, id);
    try {
      const { data, error } = await serverSupabase
        .from("organizations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error(
          `[OrganizationService] Error finding organization:`,
          error
        );
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        `[OrganizationService] Unexpected error in findById:`,
        error
      );
      throw error;
    }
  }

  async findByUserEmail(
    email: string
  ): Promise<{ organization: Organization; role: string } | null> {
    console.log(`[OrganizationService] Finding organization for user:`, email);
    try {
      const { data, error } = await serverSupabase
        .from("organization_members")
        .select(
          `
          role,
          organizations (*),
          users!inner (email)
        `
        )
        .eq("users.email", email)
        .maybeSingle();

      if (error) {
        console.error(
          `[OrganizationService] Error finding organization:`,
          error
        );
        throw error;
      }

      if (!data) return null;

      return {
        organization: data.organizations[0] as Organization,
        role: data.role,
      };
    } catch (error) {
      console.error(`[OrganizationService] Error in findByUserEmail:`, error);
      throw error;
    }
  }

  async verifyMemberAccess(orgId: string, userEmail: string): Promise<boolean> {
    try {
      const { data, error } = await serverSupabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("users.email", userEmail)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error(
        `[OrganizationService] Error in verifyMemberAccess:`,
        error
      );
      throw error;
    }
  }

  async verifyAdminAccess(orgId: string, userEmail: string): Promise<boolean> {
    try {
      const { data, error } = await serverSupabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("users.email", userEmail)
        .eq("role", "admin")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error(`[OrganizationService] Error in verifyAdminAccess:`, error);
      throw error;
    }
  }

  async create(
    orgData: CreateOrganizationDTO,
    userEmail: string
  ): Promise<Organization> {
    console.log(
      `[OrganizationService] Creating organization for user:`,
      userEmail
    );
    try {
      // First get the user id from the email
      const { data: userData, error: userError } = await serverSupabase
        .from("users")
        .select("id")
        .eq("email", userEmail)
        .single();

      if (userError) {
        console.error(`[OrganizationService] Error finding user:`, userError);
        throw userError;
      }

      const { data: org, error: orgError } = await serverSupabase
        .from("organizations")
        .insert({
          name: orgData.name,
          description: orgData.description || null,
          created_by: userData.id,
        })
        .select()
        .single();

      if (orgError) {
        console.error(
          `[OrganizationService] Error creating organization:`,
          orgError
        );
        throw orgError;
      }

      // Create the organization_members entry
      const { error: memberError } = await serverSupabase
        .from("organization_members")
        .insert({
          organization_id: org.id,
          user_id: userData.id,
          role: "admin",
        });

      if (memberError) {
        console.error(
          `[OrganizationService] Error creating member:`,
          memberError
        );
        // Cleanup the organization if member creation fails
        await serverSupabase.from("organizations").delete().eq("id", org.id);
        throw memberError;
      }

      return org;
    } catch (error) {
      console.error(`[OrganizationService] Error in create:`, error);
      throw error;
    }
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    console.log(`[OrganizationService] Updating organization:`, id);
    try {
      const updateData = {
        ...data,
        updated_at: new Date(),
      };

      const { data: updated, error } = await serverSupabase
        .from("organizations")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error(
          `[OrganizationService] Error updating organization:`,
          error
        );
        throw error;
      }

      return updated;
    } catch (error) {
      console.error(`[OrganizationService] Error in update:`, error);
      throw error;
    }
  }
}
