export type ProviderStatusKind = 'neutral' | 'positive' | 'negative';
export type EvidenceKind = 'third_party' | 'self_promo' | 'lead';

export interface ProviderCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ProviderStatusDto {
  id: string;
  name: string;
  kind: ProviderStatusKind;
  hiddenByDefault: boolean;
  sortOrder: number;
}

export interface EvidenceSummary {
  mentionCount: number;
  neighborCount: number;
  lastSightingAt: Date | null;
}

export interface ProviderListItem extends EvidenceSummary {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  rating: number | null;
  category: ProviderCategoryDto;
  status: ProviderStatusDto;
}

export type ProviderSort = 'name' | 'mentions' | 'lastSighting' | 'rating';

export interface ProviderListFilters {
  search?: string;
  categoryId?: string;
  statusId?: string;
  includeHidden?: boolean;
  sort?: ProviderSort;
}

export interface ProviderInput {
  name: string;
  categoryId: string;
  statusId?: string;
  company?: string | null;
  primaryContactName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  licenseNumber?: string | null;
  googlePlaceId?: string | null;
  rating?: number | null;
  hiredAt?: Date | null;
  notes?: string | null;
}

export interface IngestEvidence {
  sourceUrl: string;
  sourceGroup?: string;
  sourceDate?: string;
  snippet?: string;
  kind: EvidenceKind;
}

export interface IngestItem {
  name: string;
  category: string;
  status?: string;
  company?: string;
  primaryContactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  licenseNumber?: string;
  googlePlaceId?: string;
  evidence: IngestEvidence[];
}

export interface IngestResult {
  created: number;
  updated: number;
  skippedDeleted: number;
  evidenceAdded: number;
  errors: { index: number; name: string; message: string }[];
}
