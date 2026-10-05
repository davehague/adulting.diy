import { type ProviderStatusKind } from '@/types/provider';
import {
  MAX_COMMENTS_PER_PROVIDER,
  MAX_EVIDENCE_PER_PROVIDER,
  MAX_PROVIDER_NOTES_LENGTH,
  MAX_SNIPPET_LENGTH,
} from '@/types/suggestion';

export interface ProjectText {
  title: string;
  location: string | null;
  notes: string | null;
  // what was typed in "Anything to add?"
  extra: string | null;
}

// Everything about a provider that may be sent to the model. It has no contact details and no source links by construction.
export interface PoolProvider {
  id: string;
  name: string;
  statusName: string;
  statusKind: ProviderStatusKind;
  rating: number | null;
  notes: string | null;
  // newest first, text only
  comments: string[];
  evidence: { kind: string; sourceDate: Date | null; snippet: string | null }[];
}

export interface PickingPart {
  // index into the full list of parts, so the reply can be matched back
  partIndex: number;
  name: string;
  categoryName: string;
  pool: PoolProvider[];
}

const routingSystem = (today: string): string => `You help a household plan a home project by working out which kinds of contractor it needs.
Split the project into parts, one per trade, in the order the work would happen. Use at most 4 parts. A simple problem is one part.
Each part must use a categoryId from the household's category list, or null if no listed category fits. Never invent a category.
For each part give: a short name (under 40 characters), one sentence on why that trade is needed for this specific project, and a short Google search phrase for finding that kind of contractor for this specific problem, ending in "near me".
If the project text is too vague to tell what work is needed, set tooVague to true and return no parts.
Today is ${today}.

Reply with one JSON object and nothing else: no prose before or after, no markdown, no code fences. Use exactly these keys:
{"tooVague": false, "parts": [{"name": "...", "categoryId": "c1", "why": "...", "searchPhrase": "... near me"}]}
categoryId is one of the listed category ids, or null.`;

const pickingSystem = (today: string): string => `You help a household shortlist contractors for a home project. For each part of the project you are given a pool of providers from the household's own directory. Pick up to 3 providers per part, best first, and give a reason for each.

Rules:
- Only pick providers from that part's pool, by their id. Never pick anyone else.
- The household's own record (their status, their rating, their notes, their comments) outweighs neighbor posts.
- Evidence kinds: "third_party" is a neighbor's own words about the provider and may be positive or negative, so read it. "self_promo" is the business advertising itself and is never a reason to pick it. "lead" is an unverified mention or a question and is not a recommendation.
- Prefer evidence that matches this specific problem over general praise.
- Do not pad. If fewer than 3 providers have real grounds, pick fewer. If none do, pick none.
- Each reason is one or two plain sentences, written to the household ("You rated them 4..."). State only what the record says. If the evidence is thin or old, say so in the reason. Do not use the provider id in the reason.
Today is ${today}.

Reply with one JSON object and nothing else: no prose before or after, no markdown, no code fences, no list of providers you skipped. Use exactly these keys:
{"parts": [{"partIndex": 0, "picks": [{"providerId": "p1", "reason": "..."}]}]}
Include every part, in order. A part with no picks has "picks": [].`;

const projectPayload = (project: ProjectText) => ({
  title: project.title,
  location: project.location ?? '',
  notes: project.notes ?? '',
  extra: project.extra ?? '',
});

export const buildRoutingPrompt = (
  project: ProjectText,
  categories: { id: string; name: string }[],
  today: string,
): { system: string; user: string; categoryIdByLabel: Map<string, string> } => {
  const categoryIdByLabel = new Map<string, string>();
  const listed = categories.map((category, index) => {
    const label = `c${index + 1}`;
    categoryIdByLabel.set(label, category.id);
    return { id: label, name: category.name };
  });
  return {
    system: routingSystem(today),
    user: JSON.stringify({ project: projectPayload(project), categories: listed }, null, 1),
    categoryIdByLabel,
  };
};

const timeOf = (date: Date | null): number => (date ? date.getTime() : 0);

const evidencePayload = (evidence: PoolProvider['evidence']) =>
  [...evidence]
    .sort((a, b) => timeOf(b.sourceDate) - timeOf(a.sourceDate))
    .slice(0, MAX_EVIDENCE_PER_PROVIDER)
    .map((row) => ({
      kind: row.kind,
      date: row.sourceDate ? row.sourceDate.toISOString().slice(0, 10) : null,
      snippet: (row.snippet ?? '').slice(0, MAX_SNIPPET_LENGTH),
    }));

export const buildPickingPrompt = (
  project: ProjectText,
  parts: PickingPart[],
  today: string,
): { system: string; user: string; providerIdByLabel: Map<string, string>; labelsByPart: Map<number, Set<string>> } => {
  const providerIdByLabel = new Map<string, string>();
  const labelsByPart = new Map<number, Set<string>>();
  let next = 1;

  const listed = parts.map((part) => {
    const labels = new Set<string>();
    labelsByPart.set(part.partIndex, labels);
    return {
      partIndex: part.partIndex,
      name: part.name,
      category: part.categoryName,
      pool: part.pool.map((provider) => {
        const label = `p${next++}`;
        providerIdByLabel.set(label, provider.id);
        labels.add(label);
        return {
          id: label,
          name: provider.name,
          status: provider.statusName,
          statusKind: provider.statusKind,
          rating: provider.rating,
          notes: provider.notes ? provider.notes.slice(0, MAX_PROVIDER_NOTES_LENGTH) : null,
          comments: provider.comments.slice(0, MAX_COMMENTS_PER_PROVIDER).map((body) => body.slice(0, MAX_SNIPPET_LENGTH)),
          evidence: evidencePayload(provider.evidence),
        };
      }),
    };
  });

  return {
    system: pickingSystem(today),
    user: JSON.stringify({ project: projectPayload(project), parts: listed }, null, 1),
    providerIdByLabel,
    labelsByPart,
  };
};
