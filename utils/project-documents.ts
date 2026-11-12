import { DOCUMENT_TYPES, MAX_DOCUMENT_NAME_LENGTH, type DocumentExtension } from '@/types/project';

// Shared by the browser (which builds the upload path) and the server (which checks it).

const MAX_SAFE_BASE_LENGTH = 80;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH_PATTERN = new RegExp(`^households/(${UUID})/projects/(${UUID})/documents/(${UUID})/([A-Za-z0-9._-]+)$`);

const isDocumentExtension = (value: string): value is DocumentExtension => Object.hasOwn(DOCUMENT_TYPES, value);

const splitExtension = (fileName: string): { base: string; extension: string } => {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return { base: fileName, extension: '' };
  return { base: fileName.slice(0, dot), extension: fileName.slice(dot + 1).toLowerCase() };
};

export const documentExtension = (fileName: string): DocumentExtension | null => {
  const { extension } = splitExtension(fileName);
  return isDocumentExtension(extension) ? extension : null;
};

export const safeDocumentFileName = (original: string): string | null => {
  const extension = documentExtension(original);
  if (!extension) return null;
  const base = splitExtension(original).base
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/[-_.]{2,}/g, (run) => run[0])
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, MAX_SAFE_BASE_LENGTH)
    .replace(/[-_.]+$/, '');
  return `${base || 'document'}.${extension}`;
};

export const defaultDocumentName = (original: string): string => {
  const name = splitExtension(original).base.trim().slice(0, MAX_DOCUMENT_NAME_LENGTH).trim();
  return name || 'Document';
};

export const documentBlobPath = (householdId: string, projectId: string, documentId: string, fileName: string): string =>
  `households/${householdId}/projects/${projectId}/documents/${documentId}/${fileName}`;

export interface ParsedDocumentPath {
  householdId: string;
  projectId: string;
  documentId: string;
  fileName: string;
  extension: DocumentExtension;
}

export const parseDocumentBlobPath = (path: string): ParsedDocumentPath | null => {
  const match = PATH_PATTERN.exec(path);
  if (!match) return null;
  const [, householdId, projectId, documentId, fileName] = match;
  const extension = documentExtension(fileName);
  if (!extension || safeDocumentFileName(fileName) !== fileName) return null;
  return { householdId, projectId, documentId, fileName, extension };
};

export const formatDocumentSize = (bytes: number): string => {
  const mb = 1024 * 1024;
  if (bytes < mb) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / mb).toFixed(1)} MB`;
};
