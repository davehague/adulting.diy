import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export interface ContactInput {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}

export class ProviderContactService {
  async add(householdId: string, providerId: string, input: ContactInput) {
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return prisma.providerContact.create({ data: { ...input, providerId } });
  }

  async update(householdId: string, contactId: string, input: Partial<ContactInput>) {
    await this.requireInHousehold(householdId, contactId);
    return prisma.providerContact.update({ where: { id: contactId }, data: input });
  }

  async remove(householdId: string, contactId: string) {
    await this.requireInHousehold(householdId, contactId);
    await prisma.providerContact.delete({ where: { id: contactId } });
  }

  private async requireInHousehold(householdId: string, contactId: string) {
    const contact = await prisma.providerContact.findFirst({
      where: { id: contactId, provider: { householdId } },
    });
    if (!contact) throw new HttpError('Contact not found', 404);
    return contact;
  }
}
