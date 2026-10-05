import { type PickingReply, type RoutingReply } from '@/server/utils/suggestion-schemas';
import { MAX_PICKS_PER_PART, MAX_SUGGESTION_PARTS, type SavedSuggestionPick } from '@/types/suggestion';
import { withNearMe } from '@/utils/google-search';

export interface CleanPart {
  name: string;
  why: string;
  categoryId: string | null;
  searchPhrase: string;
}

// The limits on routing that the model cannot be trusted to keep: known categories only, one part per category, at most four parts.
export const cleanParts = (parts: RoutingReply['parts'], categoryIdByLabel: Map<string, string>): CleanPart[] => {
  const used = new Set<string>();
  const cleaned: CleanPart[] = [];
  for (const part of parts) {
    const categoryId = part.categoryId ? categoryIdByLabel.get(part.categoryId) ?? null : null;
    if (categoryId) {
      if (used.has(categoryId)) continue;
      used.add(categoryId);
    }
    cleaned.push({ name: part.name, why: part.why, categoryId, searchPhrase: withNearMe(part.searchPhrase) });
    if (cleaned.length === MAX_SUGGESTION_PARTS) break;
  }
  return cleaned;
};

// The limits on picking: only providers from that part's own pool, no repeats, at most three. Anything else is dropped without comment.
export const checkPicks = (
  parts: PickingReply['parts'],
  providerIdByLabel: Map<string, string>,
  labelsByPart: Map<number, Set<string>>,
): Map<number, SavedSuggestionPick[]> => {
  const checked = new Map<number, SavedSuggestionPick[]>();
  for (const part of parts) {
    const allowed = labelsByPart.get(part.partIndex);
    if (!allowed || checked.has(part.partIndex)) continue;
    const seen = new Set<string>();
    const picks: SavedSuggestionPick[] = [];
    for (const pick of part.picks) {
      const providerId = allowed.has(pick.providerId) ? providerIdByLabel.get(pick.providerId) : undefined;
      if (!providerId || seen.has(providerId)) continue;
      seen.add(providerId);
      picks.push({ providerId, reason: pick.reason });
      if (picks.length === MAX_PICKS_PER_PART) break;
    }
    checked.set(part.partIndex, picks);
  }
  return checked;
};
