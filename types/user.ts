// types/user.ts
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
