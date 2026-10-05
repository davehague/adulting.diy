import { DEFAULT_SUGGESTION_MODEL } from '@/types/suggestion';

// Read at call time, not through runtimeConfig, so a changed setting takes effect on the next deploy without a code change.
export const suggestionModel = (): string => process.env.AI_SUGGESTIONS_MODEL?.trim() || DEFAULT_SUGGESTION_MODEL;

// Suggestions send household data to an outside model, so a household has to be listed by hand.
export const suggestionsEnabledFor = (householdId: string): boolean => {
  if (!process.env.OLLAMA_API_KEY) return false;
  const allowed = (process.env.AI_SUGGESTIONS_HOUSEHOLD_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes(householdId);
};
