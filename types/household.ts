// types/household.ts
export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: Date;
  updated_at: Date;
}

export interface HouseholdMember {
  user_id: string;
  household_id: string;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}
