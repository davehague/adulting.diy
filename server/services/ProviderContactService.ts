import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export interface ContactInput {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}

const pickContact = (input: Partial<ContactInput>): Partial<ContactInput> => {
  const picked: Partial<ContactInput> = {};
  if (input.name !== undefined) picked.name = input.name;
  if (input.role !== undefined) picked.role = input.role;
  if (input.phone !== undefined) picked.phone = input.phone;
  if (input.email !== undefined) picked.email = input.email;
  return picked;
};

export class ProviderContactService {
  async add(householdId: string, providerId: string, input: ContactInput) {
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return prisma.providerContact.create({ data: { ...pickContact(input), name: input.name, providerId } });
  }

  async update(householdId: string, contactId: string, input: Partial<ContactInput>) {
    await this.requireInHousehold(householdId, contactId);
    return prisma.providerContact.update({ where: { id: contactId }, data: pickContact(input) });
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
