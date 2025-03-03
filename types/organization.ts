import type { User } from "./user";

export type OrganizationRole = "admin" | "member" | "viewer";

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  description: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  invited_by: string;
  token: string;
  expires_at: string;
  status: "pending" | "accepted" | "expired";
  created_at: string;
}

// DTOs
export interface CreateOrganizationDTO {
  name: string;
  description?: string;
}

export interface CreateInviteDTO {
  email: string;
  role: OrganizationRole;
}
