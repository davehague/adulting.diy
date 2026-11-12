import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { headPrivate, presignPrivateGet, removeBlobs, type UploadGrant } from '@/server/utils/blob-storage';
import { parseDocumentBlobPath } from '@/utils/project-documents';
import {
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_PROJECT_DOCUMENTS,
  type ProjectDocumentDto,
} from '@/types/project';

const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;
const LINK_TTL_MS = 5 * 60 * 1000;
const CAP_MESSAGE = `This project can hold ${MAX_PROJECT_DOCUMENTS} documents`;
const TYPE_MESSAGE = 'Only PDF, Word, Excel, JPEG or PNG files';

export const documentSelect = {
  id: true,
  name: true,
  note: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  createdAt: true,
} satisfies Prisma.ProjectDocumentSelect;

export const documentOrder = { createdAt: 'desc' } satisfies Prisma.ProjectDocumentOrderByWithRelationInput;

const toDto = (row: Prisma.ProjectDocumentGetPayload<{ select: typeof documentSelect }>): ProjectDocumentDto => ({
  id: row.id,
  name: row.name,
  note: row.note,
  fileName: row.fileName,
  contentType: row.contentType,
  sizeBytes: row.sizeBytes,
  createdAt: row.createdAt,
});

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

export interface DocumentRegisterInput {
  id: string;
  blobPath: string;
  name: string;
  note: string | null;
}

export interface DocumentUpdateInput {
  name?: string;
  note?: string | null;
}

export class ProjectDocumentService {
  // Called while the browser asks for an upload URL: decides whether this exact path may be written, and with what.
  async authorizeUpload(householdId: string, projectId: string, pathname: string): Promise<UploadGrant> {
    await this.requireProject(householdId, projectId);
    const parsed = this.requirePath(householdId, projectId, pathname);
    if ((await prisma.projectDocument.count({ where: { projectId } })) >= MAX_PROJECT_DOCUMENTS) {
      throw new HttpError(CAP_MESSAGE, 409);
    }
    const existing = await prisma.projectDocument.findFirst({ where: { id: parsed.documentId }, select: { id: true } });
    if (existing) throw new HttpError('Document already exists', 409);
    return { contentType: DOCUMENT_TYPES[parsed.extension], maxBytes: MAX_DOCUMENT_BYTES, ttlMs: UPLOAD_URL_TTL_MS };
  }

  // Called after the browser's upload finished: checks what actually landed in storage before saving the row.
  async register(householdId: string, projectId: string, userId: string, input: DocumentRegisterInput): Promise<ProjectDocumentDto> {
    await this.requireProject(householdId, projectId);
    const parsed = this.requirePath(householdId, projectId, input.blobPath);
    if (parsed.documentId !== input.id) throw new HttpError('Invalid document path', 400);

    // A retry after a lost response: the first call already saved it.
    const existing = await prisma.projectDocument.findFirst({ where: { id: input.id, projectId }, select: documentSelect });
    if (existing) return toDto(existing);

    const stored = await headPrivate(input.blobPath);
    if (!stored) throw new HttpError('Upload not found. Try again.', 400);
    if (stored.contentType !== DOCUMENT_TYPES[parsed.extension]) {
      await this.cleanUp([input.blobPath]);
      throw new HttpError(TYPE_MESSAGE, 400);
    }
    if (stored.size > MAX_DOCUMENT_BYTES) {
      await this.cleanUp([input.blobPath]);
      throw new HttpError('Over 25 MB', 413);
    }
    if ((await prisma.projectDocument.count({ where: { projectId } })) >= MAX_PROJECT_DOCUMENTS) {
      await this.cleanUp([input.blobPath]);
      throw new HttpError(CAP_MESSAGE, 409);
    }

    const created = await prisma.projectDocument.create({
      data: {
        id: input.id,
        projectId,
        blobPath: input.blobPath,
        fileName: parsed.fileName,
        name: input.name.trim(),
        note: blankToNull(input.note),
        contentType: stored.contentType,
        sizeBytes: stored.size,
        uploadedById: userId,
      },
      select: documentSelect,
    });

    // Two uploads can both pass the check above before either's row exists; re-count now and undo this one if over.
    if ((await prisma.projectDocument.count({ where: { projectId } })) > MAX_PROJECT_DOCUMENTS) {
      await prisma.projectDocument.delete({ where: { id: created.id } });
      await this.cleanUp([input.blobPath]);
      throw new HttpError(CAP_MESSAGE, 409);
    }
    return toDto(created);
  }

  async link(householdId: string, projectId: string, documentId: string): Promise<{ url: string; expiresAt: string }> {
    const document = await this.requireDocument(householdId, projectId, documentId);
    const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();
    try {
      return { url: await presignPrivateGet(document.blobPath, LINK_TTL_MS), expiresAt };
    } catch (error) {
      console.error('[ProjectDocumentService] signing a link failed:', error);
      throw new HttpError('Document storage is unavailable. Try again.', 502);
    }
  }

  async update(householdId: string, projectId: string, documentId: string, input: DocumentUpdateInput): Promise<ProjectDocumentDto> {
    await this.requireDocument(householdId, projectId, documentId);
    const data: Prisma.ProjectDocumentUpdateInput = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name === '') throw new HttpError("Name can't be blank", 400);
      data.name = name;
    }
    if (input.note !== undefined) data.note = blankToNull(input.note);
    return toDto(await prisma.projectDocument.update({ where: { id: documentId }, data, select: documentSelect }));
  }

  async remove(householdId: string, projectId: string, documentId: string): Promise<void> {
    const document = await this.requireDocument(householdId, projectId, documentId);
    await prisma.projectDocument.delete({ where: { id: document.id } });
    await this.cleanUp([document.blobPath]);
  }

  // Best effort: an orphaned blob is unreachable (no row points at it), so a failure here must not fail the request.
  private async cleanUp(pathnames: string[]): Promise<void> {
    try {
      await removeBlobs(pathnames);
    } catch (error) {
      console.error('[ProjectDocumentService] removing blobs failed:', pathnames, error);
    }
  }

  private requirePath(householdId: string, projectId: string, pathname: string) {
    const parsed = parseDocumentBlobPath(pathname);
    if (!parsed || parsed.householdId !== householdId || parsed.projectId !== projectId) {
      throw new HttpError('Invalid document path', 400);
    }
    return parsed;
  }

  private async requireProject(householdId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);
  }

  private async requireDocument(householdId: string, projectId: string, documentId: string) {
    const document = await prisma.projectDocument.findFirst({
      where: { id: documentId, projectId, project: { householdId, metaStatus: 'active' } },
      select: { id: true, blobPath: true },
    });
    if (!document) throw new HttpError('Document not found', 404);
    return document;
  }
}
