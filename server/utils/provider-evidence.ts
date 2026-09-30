import { type EvidenceSummary } from '@/types/provider';

export const summarizeEvidence = (
  evidence: { kind: string; sourceDate: Date | null }[]
): EvidenceSummary => {
  let lastSightingAt: Date | null = null;
  for (const row of evidence) {
    if (row.sourceDate && (!lastSightingAt || row.sourceDate > lastSightingAt)) {
      lastSightingAt = row.sourceDate;
    }
  }
  return {
    mentionCount: evidence.length,
    neighborCount: evidence.filter((row) => row.kind === 'third_party').length,
    lastSightingAt,
  };
};
