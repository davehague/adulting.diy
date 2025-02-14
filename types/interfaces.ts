export interface User {
  id: string;
  organization_id: number;
  name: string;
  email: string;
  picture?: string;
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

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "admin" | "member" | "viewer";
  joined_at: string;
}

export interface CreateOrganizationDTO {
  name: string;
  description?: string;
}
