import { HttpError } from '@/server/utils/api-errors';
import { HouseholdService } from '@/server/services/HouseholdService';

export const assertHouseholdAdmin = async (
  userId: string,
  householdId: string,
  isAdmin: (userId: string, householdId: string) => Promise<boolean> = (u, h) =>
    new HouseholdService().isUserAdmin(u, h)
): Promise<void> => {
  if (!(await isAdmin(userId, householdId))) {
    throw new HttpError('Only household admins can do this', 403);
  }
};
