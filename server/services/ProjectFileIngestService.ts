import { randomUUID } from 'node:crypto';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { ApiKeyService } from '@/server/services/ApiKeyService';
import { ProjectDocumentService } from '@/server/services/ProjectDocumentService';
import { ProjectPhotoService, type PhotoUpload } from '@/server/services/ProjectPhotoService';
import { findPrivateBlob, presignPrivatePut } from '@/server/utils/blob-storage';
import { displayNameFromStoredFile, documentBlobPath, safeDocumentFileName } from '@/utils/project-documents';
import {
  type DocumentUploadUrl,
  type IngestProjectSummary,
  type ProjectDocumentDto,
  type ProjectPhotoDto,
} from '@/types/project';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

  async addPhoto(householdId: string, userId: string, projectId: string, upload: PhotoUpload): Promise<ProjectPhotoDto> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    return this.photos.add(householdId, projectId, userId, upload);
  }
}
