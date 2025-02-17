import type {
  Organization,
  CreateOrganizationDTO,
  OrganizationMember,
  OrganizationInvite,
  User,
} from "~/types";
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
          organizations!inner (
            id,
            name,
            description,
            created_at,
            updated_at,
            created_by
          ),
          users!inner (
            email
          )
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

      const organization = data.organizations as any as Organization;
      if (!organization) return null;

      return {
        organization,
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
        .select(
          `
          id,
          users!inner (*)
        `
        )
        .eq("organization_id", orgId)
        .eq("users.email", userEmail)
        .limit(1);

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
        .select(
          `
          role,
          users!inner (*)
        `
        )
        .eq("organization_id", orgId)
        .eq("users.email", userEmail)
        .eq("role", "admin")
        .limit(1);

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error(`[OrganizationService] Error in verifyAdminAccess:`, error);
      throw error;
    }
  }

  async getOrganizationMembers(
    organizationId: string
  ): Promise<OrganizationMember[]> {
    try {
      const { data, error } = await serverSupabase
        .from("organization_members")
        .select(
          `
          id,
          organization_id,
          user_id,
          role,
          joined_at,
          user:users!inner (
            id,
            name,
            email,
            picture
          )
        `
        )
        .eq("organization_id", organizationId);

      if (error) {
        console.error("[OrganizationService] Error fetching members:", error);
        throw error;
      }

      // Transform the data to ensure user is a single object, not an array
      const members =
        data?.map((member) => ({
          ...member,
          user: Array.isArray(member.user) ? member.user[0] : member.user,
        })) ?? [];

      return members as OrganizationMember[];
    } catch (error) {
      console.error(
        "[OrganizationService] Error in getOrganizationMembers:",
        error
      );
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

  // New methods to add to OrganizationService class:

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: OrganizationMember["role"]
  ): Promise<OrganizationMember> {
    console.log(
      `[OrganizationService] Updating member ${memberId} role in org ${organizationId}`
    );
    try {
      const { data, error } = await serverSupabase
        .from("organization_members")
        .update({ role })
        .eq("id", memberId)
        .eq("organization_id", organizationId)
        .select(
          `
        *,
        user:users (
          id,
          name,
          email,
          picture
        )
      `
        )
        .single();

      if (error) {
        console.error(
          `[OrganizationService] Error updating member role:`,
          error
        );
        throw error;
      }

      return data as OrganizationMember;
    } catch (error) {
      console.error(`[OrganizationService] Error in updateMemberRole:`, error);
      throw error;
    }
  }

  async acceptInvite(
    token: string,
    userEmail: string
  ): Promise<{ success: boolean }> {
    console.log(`[OrganizationService] Accepting invite for user:`, userEmail);
    try {
      // Verify token and get invite
      const { data: invite, error: fetchError } = await serverSupabase
        .from("organization_invites")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .single();

      if (fetchError || !invite) {
        throw createError({
          statusCode: 404,
          message: "Invalid or expired invite",
        });
      }

      // Verify invite hasn't expired
      if (new Date(invite.expires_at) < new Date()) {
        throw createError({
          statusCode: 400,
          message: "Invite has expired",
        });
      }

      // Verify email matches
      if (invite.email !== userEmail) {
        throw createError({
          statusCode: 403,
          message: "This invite was sent to a different email address",
        });
      }

      // Get user ID
      const { data: userData, error: userError } = await serverSupabase
        .from("users")
        .select("id")
        .eq("email", userEmail)
        .single();

      if (userError) {
        throw createError({
          statusCode: 500,
          message: "Failed to find user",
        });
      }

      // Create member record
      const { error: memberError } = await serverSupabase
        .from("organization_members")
        .insert({
          organization_id: invite.organization_id,
          user_id: userData.id,
          role: invite.role,
        });

      if (memberError) {
        throw createError({
          statusCode: 500,
          message: "Failed to create member record",
        });
      }

      // Update invite status
      const { error: updateError } = await serverSupabase
        .from("organization_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      if (updateError) {
        throw createError({
          statusCode: 500,
          message: "Failed to update invite status",
        });
      }

      return { success: true };
    } catch (error) {
      console.error(`[OrganizationService] Error in acceptInvite:`, error);
      throw error;
    }
  }

  async cancelInvite(inviteId: string, userEmail: string): Promise<void> {
    console.log(`[OrganizationService] Canceling invite ${inviteId}`);
    try {
      // First verify the user has access to the organization this invite belongs to
      const { data: invite, error: fetchError } = await serverSupabase
        .from("organization_invites")
        .select("organization_id")
        .eq("id", inviteId)
        .single();

      if (fetchError) {
        throw createError({
          statusCode: 404,
          message: "Invite not found",
        });
      }

      const hasAccess = await this.verifyMemberAccess(
        invite.organization_id,
        userEmail
      );

      if (!hasAccess) {
        throw createError({
          statusCode: 403,
          message: "Forbidden: Unauthorized access",
        });
      }

      const { error: deleteError } = await serverSupabase
        .from("organization_invites")
        .delete()
        .eq("id", inviteId);

      if (deleteError) {
        throw createError({
          statusCode: 500,
          message: "Failed to delete invite",
        });
      }
    } catch (error) {
      console.error(`[OrganizationService] Error in cancelInvite:`, error);
      throw error;
    }
  }

  async getInvites(
    organizationId: string,
    status?: OrganizationInvite["status"]
  ): Promise<OrganizationInvite[]> {
    console.log(
      `[OrganizationService] Getting invites for org:`,
      organizationId
    );
    try {
      const query = serverSupabase
        .from("organization_invites")
        .select("*")
        .eq("organization_id", organizationId);

      if (status) {
        query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`[OrganizationService] Error fetching invites:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`[OrganizationService] Error in getInvites:`, error);
      throw error;
    }
  }

  async createInvite(
    organizationId: string,
    email: string,
    role: OrganizationInvite["role"],
    invitedByEmail: string
  ): Promise<OrganizationInvite> {
    console.log(
      `[OrganizationService] Creating invite for ${email} in org:`,
      organizationId
    );
    try {
      // Generate unique token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { data: invite, error } = await serverSupabase
        .from("organization_invites")
        .insert({
          organization_id: organizationId,
          email,
          role,
          invited_by: invitedByEmail,
          token,
          expires_at: expiresAt.toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.error(`[OrganizationService] Error creating invite:`, error);
        throw error;
      }

      // Send invite email
      await this.sendInviteEmail(email, role, token);

      return invite;
    } catch (error) {
      console.error(`[OrganizationService] Error in createInvite:`, error);
      throw error;
    }
  }

  private async sendInviteEmail(
    email: string,
    role: OrganizationInvite["role"],
    token: string
  ): Promise<void> {
    const config = useRuntimeConfig();
    const inviteUrl = `${config.public.appUrl}/organization/invite/${token}`;

    const htmlTemplate = `
      <h2>You've been invited to join an organization</h2>
      <p>You've been invited to join as a ${role}.</p>
      <p>Click the link below to accept the invitation:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>This invitation will expire in 7 days.</p>
    `;

    await $fetch("/api/sendEmail", {
      method: "POST",
      body: {
        toEmail: email,
        subject: "Organization Invitation",
        htmlTemplate,
      },
    });
  }
}
