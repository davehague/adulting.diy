import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';

export class ProviderCommentService {
  async add(householdId: string, providerId: string, authorId: string, body: string) {
    const text = this.cleanBody(body);
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, householdId, metaStatus: 'active' },
    });
    if (!provider) throw new HttpError('Provider not found', 404);
    return prisma.providerComment.create({
      data: { providerId, authorId, body: text },
      include: { author: { select: { id: true, name: true, picture: true } } },
    });
  }

  async update(householdId: string, commentId: string, authorId: string, body: string) {
    const text = this.cleanBody(body);
    const comment = await this.requireInHousehold(householdId, commentId);
    if (comment.authorId !== authorId) throw new HttpError('You can only edit your own comments', 403);
    return prisma.providerComment.update({ where: { id: commentId }, data: { body: text } });
  }

  async remove(householdId: string, commentId: string, authorId: string) {
    const comment = await this.requireInHousehold(householdId, commentId);
    if (comment.authorId !== authorId) throw new HttpError('You can only delete your own comments', 403);
    await prisma.providerComment.delete({ where: { id: commentId } });
  }

  private cleanBody(body: string) {
    const text = body?.trim();
    if (!text) throw new HttpError('A non-empty comment is required', 400);
    return text;
  }

  private async requireInHousehold(householdId: string, commentId: string) {
    const comment = await prisma.providerComment.findFirst({
      where: { id: commentId, provider: { householdId } },
    });
    if (!comment) throw new HttpError('Comment not found', 404);
    return comment;
  }
}
