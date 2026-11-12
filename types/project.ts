export const PROJECT_STATUSES = ['planning', 'active', 'future', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PATHS = ['diy', 'hire', 'unsure'] as const;
export type ProjectPath = (typeof PROJECT_PATHS)[number];
// 'none' selects projects whose path is not set yet
export type ProjectPathFilter = ProjectPath | 'none';

export const DEFAULT_LIST_STATUSES: ProjectStatus[] = ['planning', 'active'];

export const UNTITLED_PROJECT_TITLE = 'Untitled project';

export const MAX_PROJECT_PHOTOS = 25;
export const MAX_FULL_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_THUMB_PHOTO_BYTES = 200 * 1024;

export const MAX_PROJECT_STEPS = 100;
export const MAX_STEP_TEXT_LENGTH = 200;
export const MAX_STEP_ESTIMATE_MINUTES = 9999;

export const PROJECT_PROVIDER_STATUSES = ['considering', 'contacted', 'chosen', 'passed'] as const;
export type ProjectProviderStatus = (typeof PROJECT_PROVIDER_STATUSES)[number];

export const MAX_PROJECT_PROVIDERS = 25;

export const MAX_PROJECT_DOCUMENTS = 30;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_NAME_LENGTH = 120;
export const MAX_DOCUMENT_NOTE_LENGTH = 200;

export type DocumentExtension = 'pdf' | 'docx' | 'xlsx' | 'jpg' | 'jpeg' | 'png';

// The only files a project document can be. The extension decides the type: Blob checks the upload against it.
export const DOCUMENT_TYPES: Record<DocumentExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export interface ProjectDocumentDto {
  id: string;
  name: string;
  note: string | null;
  // the safe file name stored in Blob, which is what a download is called
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date | string;
}

export type PhotoVariant = 'full' | 'thumb';

export interface ProjectPhotoDto {
  id: string;
  width: number;
  height: number;
  position: number;
}

export interface ProjectStepDto {
  id: string;
  text: string;
  position: number;
  // set when the step is checked off; null means not done
  doneAt: Date | string | null;
  estimateMinutes: number | null;
}

export interface ProjectStepCreateInput {
  text: string;
  estimateMinutes?: number | null;
}

export interface ProjectStepUpdateInput {
  text?: string;
  estimateMinutes?: number | null;
  done?: boolean;
}

// A provider linked to a project. `status` is the link's own status, not the provider's household status.
export interface ProjectProviderDto {
  providerId: string;
  status: ProjectProviderStatus;
  provider: { id: string; name: string; phone: string | null; neighborCount: number };
}

export type NextStepKind = 'step' | 'noSteps' | 'allDone';

export interface NextStepSummary {
  id: string;
  text: string;
  estimateMinutes: number | null;
}

export interface NextStepItem {
  projectId: string;
  projectTitle: string;
  kind: NextStepKind;
  // set only when kind is 'step'
  step: NextStepSummary | null;
}

export interface NextStepsResponse {
  // the household has at least one non-deleted project, in any status
  hasProjects: boolean;
  items: NextStepItem[];
}

export interface ProjectListItem {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  photoCount: number;
  coverPhotoId: string | null;
  photoIds: string[];
  // names of the providers marked chosen on this project, in the order they were linked
  chosenProviderNames: string[];
}

export interface ProjectDetail {
  id: string;
  // the browser builds document upload paths from it (the upload is signed over the exact path it sends)
  householdId: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  notes: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  // the kind of provider this project needs; null means not chosen yet
  providerCategoryId: string | null;
  photos: ProjectPhotoDto[];
  steps: ProjectStepDto[];
  providers: ProjectProviderDto[];
  // newest first
  documents: ProjectDocumentDto[];
}

export interface ProjectCreateInput {
  title: string;
  location?: string | null;
  notes?: string | null;
}

export interface ProjectUpdateInput {
  title?: string;
  location?: string | null;
  status?: ProjectStatus;
  path?: ProjectPath | null;
  notes?: string | null;
  providerCategoryId?: string | null;
}

export interface ProjectListFilters {
  statuses?: ProjectStatus[];
  path?: ProjectPathFilter;
}

// Result of POST /api/ingest/projects. Index is the item's position in the request.
export interface ProjectIngestResult {
  created: { index: number; id: string; title: string; steps: number }[];
  skipped: { index: number; id: string; title: string; reason: string }[];
  errors: { index: number; title: string; message: string }[];
}

// A project as GET /api/ingest/projects lists it, so a script can find the id to attach files to.
export interface IngestProjectSummary {
  id: string;
  title: string;
  location: string | null;
  status: string;
  path: string | null;
  createdAt: Date | string;
}

// What a script needs to PUT a document straight to storage (POST /api/ingest/projects/:id/documents/upload-url).
export interface DocumentUploadUrl {
  documentId: string;
  fileName: string;
  uploadUrl: string;
  method: 'PUT';
  // send these with the PUT
  headers: Record<string, string>;
  maxBytes: number;
  expiresAt: string;
}
