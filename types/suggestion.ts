import { type ProviderListItem } from '@/types/provider';

export const MAX_SUGGESTION_PARTS = 4;
export const MAX_PICKS_PER_PART = 3;
export const MAX_POOL_SIZE = 40;
export const MAX_EVIDENCE_PER_PROVIDER = 8;
export const MAX_COMMENTS_PER_PROVIDER = 10;
export const MAX_SNIPPET_LENGTH = 600;
export const MAX_PROVIDER_NOTES_LENGTH = 1000;
export const MAX_EXTRA_TEXT_LENGTH = 500;
export const MAX_FALLBACK_PROVIDERS = 5;
export const DAILY_SUGGESTION_LIMIT = 20;
export const SUGGESTION_DEADLINE_MS = 45_000;
export const DEFAULT_SUGGESTION_MODEL = 'glm-5.3-flash';
export const PROVIDER_SUGGESTIONS_FEATURE = 'provider_suggestions';

// What is stored in project_suggestions.result. Ids are real database ids.
export interface SavedSuggestionPick {
  providerId: string;
  reason: string;
}

export interface SavedSuggestionPart {
  name: string;
  why: string;
  // null when no household category fits this part
  categoryId: string | null;
  searchPhrase: string;
  // how many providers were offered to the model for this part; 0 means there was nobody to choose from
  poolSize: number;
  picks: SavedSuggestionPick[];
}

export interface SavedSuggestionResult {
  tooVague: boolean;
  parts: SavedSuggestionPart[];
}

// What the routes return. Provider fields are today's values; only the reason is from when it was written.
export interface SuggestionPickDto {
  provider: ProviderListItem;
  reason: string;
}

export interface SuggestionPartDto {
  name: string;
  why: string;
  // null when no category fit, or the category has since been deleted
  category: { id: string; name: string } | null;
  searchUrl: string;
  poolSize: number;
  picks: SuggestionPickDto[];
}

export interface ProjectSuggestionDto {
  tooVague: boolean;
  extraText: string | null;
  createdAt: Date | string;
  parts: SuggestionPartDto[];
}

export interface SuggestionFallbackDto {
  category: { id: string; name: string };
  providers: ProviderListItem[];
  searchUrl: string;
}

export interface SuggestionStateResponse {
  enabled: boolean;
  limitReached: boolean;
  suggestion: ProjectSuggestionDto | null;
}

export type SuggestionRunStatus = 'ok' | 'too_vague' | 'failed';

export interface SuggestionRunResponse {
  status: SuggestionRunStatus;
  limitReached: boolean;
  // on 'failed' this is the previously saved result, or null
  suggestion: ProjectSuggestionDto | null;
  // set only on 'failed', and only when the project has a saved provider category
  fallback: SuggestionFallbackDto | null;
}
