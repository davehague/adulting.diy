import { type ProjectProviderStatus } from '@/types/project';

export const PROVIDER_LINK_STATUS_LABELS: Record<ProjectProviderStatus, string> = {
  considering: 'Considering',
  contacted: 'Contacted',
  chosen: 'Chosen',
  passed: 'Passed',
};

const LINK_STATUS_ORDER: Record<ProjectProviderStatus, number> = { chosen: 0, contacted: 1, considering: 2, passed: 3 };

// A status this build does not know (written by a later one) sorts after the known ones.
const orderOf = (status: string): number => LINK_STATUS_ORDER[status as ProjectProviderStatus] ?? 99;

// Array.prototype.sort is stable, so links given oldest-first stay oldest-first within a status.
export const sortProviderLinks = <T extends { status: string }>(links: T[]): T[] =>
  [...links].sort((a, b) => orderOf(a.status) - orderOf(b.status));

// The line on a project card. `names` may be missing in a response from an older server build.
export const chosenLine = (names: string[] | undefined): string | null => {
  if (!names || names.length === 0) return null;
  return names.length === 1 ? `Chosen: ${names[0]}` : `Chosen: ${names[0]} +${names.length - 1}`;
};

export const neighborLabel = (count: number): string | null =>
  count > 0 ? `${count} neighbor${count === 1 ? '' : 's'}` : null;

// A tap-to-call link. Everything from the first letter on is dropped, so "x12" is never dialed as
// part of the number; a value with fewer than 7 digits is not treated as a phone number.
export const telHref = (phone: string | null): string | null => {
  if (!phone) return null;
  const dialable = phone.split(/[a-z]/i)[0].replace(/[^\d+]/g, '');
  return dialable.replace(/\D/g, '').length >= 7 ? `tel:${dialable}` : null;
};

export const linkStatusBadgeClass = (status: ProjectProviderStatus): string => {
  if (status === 'chosen') return 'bg-green-100 text-green-800';
  if (status === 'contacted') return 'bg-amber-100 text-amber-800';
  return 'bg-stone-100 text-stone-700';
};
