export const PROJECT_STATUSES = ['planning', 'active', 'future', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PATHS = ['diy', 'hire', 'unsure'] as const;
export type ProjectPath = (typeof PROJECT_PATHS)[number];
// 'none' selects projects whose path is not set yet
export type ProjectPathFilter = ProjectPath | 'none';

export const DEFAULT_LIST_STATUSES: ProjectStatus[] = ['planning', 'active'];

export const UNTITLED_PROJECT_TITLE = 'Untitled project';

export const MAX_PROJECT_PHOTOS = 10;
export const MAX_FULL_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_THUMB_PHOTO_BYTES = 200 * 1024;

export const MAX_PROJECT_STEPS = 100;
export const MAX_STEP_TEXT_LENGTH = 200;
export const MAX_STEP_ESTIMATE_MINUTES = 9999;

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
}

export interface ProjectDetail {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  notes: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  photos: ProjectPhotoDto[];
  steps: ProjectStepDto[];
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
}

export interface ProjectListFilters {
  statuses?: ProjectStatus[];
  path?: ProjectPathFilter;
}
