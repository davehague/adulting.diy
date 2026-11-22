import { randomUUID } from 'node:crypto';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { ApiKeyService } from '@/server/services/ApiKeyService';
import { ProjectDocumentService, type DocumentUpdateInput } from '@/server/services/ProjectDocumentService';
import { ProjectPhotoService, type PhotoUpload } from '@/server/services/ProjectPhotoService';
import { findPrivateBlob, presignPrivatePut } from '@/server/utils/blob-storage';
import { toIngestDocument, toIngestPhoto } from '@/server/utils/ingest-project-dto';
import { displayNameFromStoredFile, documentBlobPath, safeDocumentFileName } from '@/utils/project-documents';
import {
  type DocumentUploadUrl,
  type IngestProjectDocumentDto,
  type IngestProjectPhotoDto,
  type IngestProjectSummary,
  type ProjectDocumentDto,
} from '@/types/project';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

export interface IngestDocumentRegisterInput {
  documentId: string;
  name?: string;
  note?: string | null;
}

// Files from a script holding the household API key. Only the steps a browser does not need live here (the server
// makes the path and a plain-HTTP PUT URL; the upload is found again by its id); every rule stays in the document and
// photo services.
export class ProjectFileIngestService {
  private apiKeys = new ApiKeyService();
  private documents = new ProjectDocumentService();
  private photos = new ProjectPhotoService();

  async listProjects(householdId: string): Promise<IngestProjectSummary[]> {
    return prisma.project.findMany({
      where: { householdId, metaStatus: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, location: true, status: true, path: true, createdAt: true },
    });
  }

  async documentUploadUrl(householdId: string, userId: string, projectId: string, fileName: string): Promise<DocumentUploadUrl> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    const safeName = safeDocumentFileName(fileName);
    if (!safeName) throw new HttpError('Only PDF, Word, Excel, JPEG or PNG files', 400);
    const documentId = randomUUID();
    const pathname = documentBlobPath(householdId, projectId, documentId, safeName);
    const grant = await this.documents.authorizeUpload(householdId, projectId, pathname);
    const put = await presignPrivatePut(pathname, grant);
    return {
      documentId,
      fileName: safeName,
      uploadUrl: put.url,
      method: 'PUT',
      headers: put.headers,
      maxBytes: grant.maxBytes,
      expiresAt: put.expiresAt,
    };
  }

  async registerDocument(householdId: string, userId: string, projectId: string, input: IngestDocumentRegisterInput): Promise<ProjectDocumentDto> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    if (!UUID.test(input.documentId)) throw new HttpError('Invalid document id', 400);
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);

    const blobPath = await findPrivateBlob(`households/${householdId}/projects/${projectId}/documents/${input.documentId}/`);
    if (!blobPath) throw new HttpError('Upload not found. Try again.', 400);
    const fileName = blobPath.slice(blobPath.lastIndexOf('/') + 1);
    return this.documents.register(householdId, projectId, userId, {
      id: input.documentId,
      blobPath,
      name: input.name?.trim() || displayNameFromStoredFile(fileName),
      note: input.note ?? null,
    });
  }

  async updateDocument(
    householdId: string,
    userId: string,
    projectId: string,
    documentId: string,
    input: DocumentUpdateInput,
  ): Promise<IngestProjectDocumentDto> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    return toIngestDocument(await this.documents.update(householdId, projectId, documentId, input));
  }

  async removeDocument(householdId: string, userId: string, projectId: string, documentId: string): Promise<void> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    await this.documents.remove(householdId, projectId, documentId);
  }

  async removePhoto(householdId: string, userId: string, projectId: string, photoId: string): Promise<void> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    // Photo ids are stored lowercase (photoId is lowercased on upload), so an uppercase copy, as macOS uuidgen prints,
    // must not answer a 404 that a retrying caller would read as "already deleted".
    await this.photos.remove(householdId, projectId, photoId.toLowerCase());
  }

  async reorderPhotos(householdId: string, userId: string, projectId: string, photoIds: string[]): Promise<IngestProjectPhotoDto[]> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    const ids = photoIds.map((id) => id.toLowerCase());
    return (await this.photos.reorder(householdId, projectId, ids)).map(toIngestPhoto);
  }

  // With a photoId a retry finds the photo again instead of adding a copy: a photoId already stored on this project
  // returns that photo (the first call passed the cap and JPEG checks); one stored elsewhere is a 409.
  async addPhoto(
    householdId: string,
    userId: string,
    projectId: string,
    upload: PhotoUpload,
    photoId?: string,
  ): Promise<IngestProjectPhotoDto> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    if (photoId === undefined) return toIngestPhoto(await this.photos.insert(householdId, projectId, userId, upload, {}));

    const existing = await this.findExistingPhoto(householdId, projectId, photoId);
    if (existing) return existing;
    try {
      return toIngestPhoto(await this.photos.insert(householdId, projectId, userId, upload, { id: photoId }));
    } catch (error) {
      // A concurrent request with the same photoId won the create (insert has removed its own blobs): answer from the winner.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findExistingPhoto(householdId, projectId, photoId);
      if (winner) return winner;
      // The winner was undone in between (it took the project over the photo cap); nothing is stored under this id.
      throw new HttpError('Another upload with this photoId was in progress. Try again.', 409);
    }
  }

  // The photo stored under photoId if it is this project's (active, in this household); null when the id is free.
  // Anywhere else the answer says nothing about where: 409 for another project, 404 when this project id is gone.
  private async findExistingPhoto(householdId: string, projectId: string, photoId: string): Promise<IngestProjectPhotoDto | null> {
    const photo = await prisma.projectPhoto.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        position: true,
        width: true,
        height: true,
        createdAt: true,
        projectId: true,
        project: { select: { householdId: true, metaStatus: true } },
      },
    });
    if (!photo) return null;
    if (photo.projectId !== projectId) throw new HttpError('That photoId is already used', 409);
    if (photo.project.householdId !== householdId || photo.project.metaStatus !== 'active') {
      throw new HttpError('Project not found', 404);
    }
    return toIngestPhoto(photo);
  }
}
