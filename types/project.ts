export const PROJECT_STATUSES = ['planning', 'active', 'future', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PATHS = ['diy', 'hire', 'unsure'] as const;
export type ProjectPath = (typeof PROJECT_PATHS)[number];
// 'none' selects projects whose path is not set yet
export type ProjectPathFilter = ProjectPath | 'none';

export const DEFAULT_LIST_STATUSES: ProjectStatus[] = ['planning', 'active'];

export const MAX_PROJECT_PHOTOS = 10;
export const MAX_FULL_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_THUMB_PHOTO_BYTES = 200 * 1024;

export type PhotoVariant = 'full' | 'thumb';

export interface ProjectPhotoDto {
  id: string;
  width: number;
  height: number;
  position: number;
}

export interface ProjectListItem {
  id: string;
  title: string;
  location: string | null;
  status: ProjectStatus;
  path: ProjectPath | null;
  photoCount: number;
  coverPhotoId: string | null;
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
}

export interface ProjectCreateInput {
  title: string;
  location?: string | null;
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
