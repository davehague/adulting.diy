import {
  type IngestProjectDocumentDto,
  type IngestProjectPhotoDto,
  type IngestProjectProviderDto,
  type IngestProjectStepDto,
  type ProjectDocumentDto,
  type ProjectPhotoDto,
  type ProjectProviderDto,
  type ProjectStepDto,
} from '@/types/project';

// Pure mappers from the browser DTOs to the ingest contract, shared by every ingest route that returns these shapes.
export const toIngestStep = (step: ProjectStepDto): IngestProjectStepDto => ({
  id: step.id,
  text: step.text,
  done: step.doneAt !== null,
  doneAt: step.doneAt,
  estimateMinutes: step.estimateMinutes,
  position: step.position,
});

export const toIngestDocument = (doc: ProjectDocumentDto): IngestProjectDocumentDto => ({
  id: doc.id,
  name: doc.name,
  note: doc.note,
  fileName: doc.fileName,
  contentType: doc.contentType,
  sizeBytes: doc.sizeBytes,
  createdAt: doc.createdAt,
});

export const toIngestPhoto = (photo: ProjectPhotoDto & { createdAt: Date | string }): IngestProjectPhotoDto => ({
  id: photo.id,
  position: photo.position,
  width: photo.width,
  height: photo.height,
  createdAt: photo.createdAt,
});

export const toIngestProvider = (link: ProjectProviderDto): IngestProjectProviderDto => ({
  id: link.provider.id,
  name: link.provider.name,
  status: link.status,
});
