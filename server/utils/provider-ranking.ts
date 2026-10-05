import { type ProviderStatusKind } from '@/types/provider';
import { MAX_FALLBACK_PROVIDERS } from '@/types/suggestion';

// The fields the fixed ranking reads. ProviderListItem satisfies this.
export interface Rankable {
  name: string;
  rating: number | null;
  neighborCount: number;
  lastSightingAt: Date | string | null;
  status: { kind: ProviderStatusKind };
}

const timeOf = (value: Date | string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const tierOf = (provider: Rankable): number => (provider.status.kind === 'positive' ? 0 : 1);

// The fixed rules ranking: the household's own positive statuses first, then rating, neighbor
// recommendations, recency and name. Negative statuses are excluded by kind, so renamed statuses keep working.
export const rankProviders = <T extends Rankable>(items: T[]): T[] =>
  items
    .filter((provider) => provider.status.kind !== 'negative')
    .sort(
      (a, b) =>
        tierOf(a) - tierOf(b) ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        b.neighborCount - a.neighborCount ||
        timeOf(b.lastSightingAt) - timeOf(a.lastSightingAt) ||
        a.name.localeCompare(b.name),
    );

// Shown when the model call fails. A provider nobody has vouched for is left out.
export const fallbackProviders = <T extends Rankable>(items: T[]): T[] =>
  rankProviders(items)
    .filter((provider) => provider.status.kind === 'positive' || provider.neighborCount > 0 || provider.rating !== null)
    .slice(0, MAX_FALLBACK_PROVIDERS);
