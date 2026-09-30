/**
 * Normalize a provider name so watcher input matches an existing provider
 * regardless of case, punctuation, or a trailing "(Owner Name)" parenthetical.
 */
export const normalizeProviderName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
