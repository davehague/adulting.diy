// types/household.ts
export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdMember {
  userId: string;
  householdId: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}
