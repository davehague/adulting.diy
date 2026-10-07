import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { suggestionModel, suggestionsEnabledFor } from '@/server/utils/ai-config';
import { askJson, asksInLastDay, describeError, LIMIT_MESSAGE, promptChars, type AskUsage } from '@/server/utils/ai-ask';
import { callOllama, type ModelCall } from '@/server/utils/ollama';
import { fallbackProviders, rankProviders } from '@/server/utils/provider-ranking';
import { checkPicks, cleanParts } from '@/server/utils/suggestion-checks';
import {
  buildPickingPrompt,
  buildRoutingPrompt,
  type PickingPart,
  type PoolProvider,
  type ProjectText,
} from '@/server/utils/suggestion-prompts';
import {
  pickingReplySchema,
  routingReplySchema,
  savedResultSchema,
} from '@/server/utils/suggestion-schemas';
import { toProviderListItem } from '@/server/services/ProviderService';
import { type ProviderListItem, type ProviderStatusKind } from '@/types/provider';
import {
  DAILY_SUGGESTION_LIMIT,
  MAX_POOL_SIZE,
  PROVIDER_SUGGESTIONS_FEATURE,
  SUGGESTION_DEADLINE_MS,
  type ProjectSuggestionDto,
  type SavedSuggestionPick,
  type SavedSuggestionResult,
  type SuggestionFallbackDto,
  type SuggestionRunResponse,
  type SuggestionRunStatus,
  type SuggestionStateResponse,
} from '@/types/suggestion';
import { googleSearchUrl, withNearMe } from '@/utils/google-search';

const projectSelect = {
  id: true,
  title: true,
  location: true,
  notes: true,
  providerCategoryId: true,
} satisfies Prisma.ProjectSelect;
type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

const listInclude = {
  category: true,
  status: true,
  evidence: { select: { kind: true, sourceDate: true } },
} satisfies Prisma.ProviderInclude;

// The only provider fields that may reach the model are read here: no phone, email, address or source links.
const poolInclude = {
  category: true,
  status: true,
  evidence: { select: { kind: true, sourceDate: true, snippet: true } },
  comments: { select: { body: true }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.ProviderInclude;
type PoolRow = Prisma.ProviderGetPayload<{ include: typeof poolInclude }>;

// A provider that may be suggested at all: in the household, not removed, not in a negative status.
const eligibleWhere = (householdId: string) =>
  ({ householdId, metaStatus: 'active', status: { kind: { not: 'negative' } } }) satisfies Prisma.ProviderWhereInput;

interface Usage extends AskUsage {
  // Sizes only, for the one numbers-only log line per ask. 0 until that prompt is built.
  routingChars: number;
  pickingChars: number;
  // pool size of each part, in order
  poolSizes: number[];
}

const toPoolProvider = (row: PoolRow): PoolProvider => ({
  id: row.id,
  name: row.name,
  statusName: row.status.name,
  statusKind: row.status.kind as ProviderStatusKind,
  rating: row.rating,
  notes: row.notes,
  comments: row.comments.map((comment) => comment.body),
  evidence: row.evidence,
});

export class ProviderSuggestionService {
  constructor(
    private readonly callModel: ModelCall = callOllama,
    private readonly now: () => number = Date.now,
  ) {}

  async getState(householdId: string, projectId: string): Promise<SuggestionStateResponse> {
    await this.requireProject(householdId, projectId);
    if (!suggestionsEnabledFor(householdId)) return { enabled: false, limitReached: false, suggestion: null };
    const used = await this.usedInLastDay(householdId);
    return {
      enabled: true,
      limitReached: used >= DAILY_SUGGESTION_LIMIT,
      suggestion: await this.readSuggestion(householdId, projectId),
    };
  }

  async run(householdId: string, userId: string, projectId: string, extraText: string | null): Promise<SuggestionRunResponse> {
    const project = await this.requireProject(householdId, projectId);
    if (!suggestionsEnabledFor(householdId)) throw new HttpError('Suggestions are not available', 403);
    const used = await this.usedInLastDay(householdId);
    if (used >= DAILY_SUGGESTION_LIMIT) throw new HttpError(LIMIT_MESSAGE, 429);

    const model = suggestionModel();
    const startedAt = this.now();
    // Written before any model call, so an ask the platform kills mid-call still counts toward the cap.
    const log = await prisma.aiRequestLog.create({
      data: { householdId, userId, feature: PROVIDER_SUGGESTIONS_FEATURE, model, outcome: 'started' },
      select: { id: true },
    });

    const usage: Usage = { promptTokens: 0, outputTokens: 0, reported: false, routingChars: 0, pickingChars: 0, poolSizes: [] };
    let status: SuggestionRunStatus;
    try {
      const result = await this.generate(householdId, project, extraText, model, startedAt + SUGGESTION_DEADLINE_MS, usage);
      const data = { extraText, result: result as unknown as Prisma.InputJsonObject, model, createdById: userId };
      await prisma.projectSuggestion.upsert({
        where: { projectId },
        create: { projectId, ...data },
        update: { ...data, createdAt: new Date(this.now()) },
      });
      status = result.tooVague ? 'too_vague' : 'ok';
    } catch (error) {
      console.error(`[suggestions] ask failed: ${describeError(error)}`);
      status = 'failed';
    }

    const durationMs = this.now() - startedAt;
    // Numbers and the status word only, so a first failure (a slow, oversized prompt, say) can be read from the platform logs.
    console.info(
      `[suggestions] ${status} in ${durationMs} ms; routing ${usage.routingChars} chars; picking ${usage.pickingChars} chars; pools ${usage.poolSizes.join(',') || '-'}`,
    );
    await this.finishLog(log.id, status, durationMs, usage);
    return {
      status,
      limitReached: used + 1 >= DAILY_SUGGESTION_LIMIT,
      // On a failure nothing was saved, so this is the previous result, if there was one.
      suggestion: await this.readSuggestion(householdId, projectId),
      fallback: status === 'failed' ? await this.fallback(householdId, project) : null,
    };
  }

  private async generate(
    householdId: string,
    project: ProjectRow,
    extraText: string | null,
    model: string,
    deadline: number,
    usage: Usage,
  ): Promise<SavedSuggestionResult> {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    const text: ProjectText = { title: project.title, location: project.location, notes: project.notes, extra: extraText };
    const categories = await prisma.providerCategory.findMany({
      where: { householdId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });

    const routingPrompt = buildRoutingPrompt(text, categories, today);
    usage.routingChars = promptChars(routingPrompt);
    const routing = await askJson(this.callModel, this.now, routingPrompt, routingReplySchema, model, deadline, usage);
    const parts = cleanParts(routing.parts, routingPrompt.categoryIdByLabel);
    if (routing.tooVague || parts.length === 0) return { tooVague: true, parts: [] };

    const categoryIds = parts.flatMap((part) => (part.categoryId ? [part.categoryId] : []));
    const pools = await this.loadPools(householdId, project.id, categoryIds);
    const nameOf = new Map(categories.map((category) => [category.id, category.name]));
    const poolOf = (categoryId: string | null): PoolProvider[] => (categoryId ? pools.get(categoryId) ?? [] : []);
    usage.poolSizes = parts.map((part) => poolOf(part.categoryId).length);

    const pickingParts: PickingPart[] = parts.flatMap((part, partIndex) => {
      const pool = poolOf(part.categoryId);
      if (pool.length === 0 || !part.categoryId) return [];
      return [{ partIndex, name: part.name, categoryName: nameOf.get(part.categoryId) ?? '', pool }];
    });

    let picks = new Map<number, SavedSuggestionPick[]>();
    if (pickingParts.length > 0) {
      const pickingPrompt = buildPickingPrompt(text, pickingParts, today);
      usage.pickingChars = promptChars(pickingPrompt);
      const picking = await askJson(this.callModel, this.now, pickingPrompt, pickingReplySchema, model, deadline, usage);
      picks = checkPicks(picking.parts, pickingPrompt.providerIdByLabel, pickingPrompt.labelsByPart);
    }

    return {
      tooVague: false,
      parts: parts.map((part, partIndex) => ({
        ...part,
        poolSize: poolOf(part.categoryId).length,
        picks: picks.get(partIndex) ?? [],
      })),
    };
  }

  private async loadPools(householdId: string, projectId: string, categoryIds: string[]): Promise<Map<string, PoolProvider[]>> {
    const pools = new Map<string, PoolProvider[]>();
    if (categoryIds.length === 0) return pools;
    const rows = await prisma.provider.findMany({
      where: { ...eligibleWhere(householdId), categoryId: { in: categoryIds }, projects: { none: { projectId } } },
      include: poolInclude,
    });

    const byCategory = new Map<string, (ProviderListItem & { row: PoolRow })[]>();
    for (const row of rows) {
      const list = byCategory.get(row.categoryId) ?? [];
      list.push({ ...toProviderListItem(row), row });
      byCategory.set(row.categoryId, list);
    }
    for (const [categoryId, list] of byCategory) {
      pools.set(categoryId, rankProviders(list).slice(0, MAX_POOL_SIZE).map((entry) => toPoolProvider(entry.row)));
    }
    return pools;
  }

  // The saved result, refreshed against the directory as it is now.
  private async readSuggestion(householdId: string, projectId: string): Promise<ProjectSuggestionDto | null> {
    const row = await prisma.projectSuggestion.findUnique({
      where: { projectId },
      select: { extraText: true, result: true, createdAt: true },
    });
    if (!row) return null;
    const saved = savedResultSchema.safeParse(row.result);
    if (!saved.success) return null;

    const providerIds = [...new Set(saved.data.parts.flatMap((part) => part.picks.map((pick) => pick.providerId)))];
    const categoryIds = [...new Set(saved.data.parts.flatMap((part) => (part.categoryId ? [part.categoryId] : [])))];
    const [providers, categories] = await Promise.all([
      providerIds.length > 0
        ? prisma.provider.findMany({ where: { ...eligibleWhere(householdId), id: { in: providerIds } }, include: listInclude })
        : [],
      categoryIds.length > 0
        ? prisma.providerCategory.findMany({ where: { householdId, id: { in: categoryIds } }, select: { id: true, name: true } })
        : [],
    ]);
    const providerOf = new Map(providers.map((provider) => [provider.id, toProviderListItem(provider)]));
    const categoryOf = new Map(categories.map((category) => [category.id, category]));

    return {
      tooVague: saved.data.tooVague,
      extraText: row.extraText,
      createdAt: row.createdAt,
      parts: saved.data.parts.map((part) => ({
        name: part.name,
        why: part.why,
        category: (part.categoryId && categoryOf.get(part.categoryId)) || null,
        searchUrl: googleSearchUrl(part.searchPhrase),
        poolSize: part.poolSize,
        // A provider that was removed, or moved to a negative status, since the result was saved is left out.
        picks: part.picks.flatMap((pick) => {
          const provider = providerOf.get(pick.providerId);
          return provider ? [{ provider, reason: pick.reason }] : [];
        }),
      })),
    };
  }

  // What to show when the model could not answer: the fixed ranking for the project's own category.
  private async fallback(householdId: string, project: ProjectRow): Promise<SuggestionFallbackDto | null> {
    if (!project.providerCategoryId) return null;
    const category = await prisma.providerCategory.findFirst({
      where: { id: project.providerCategoryId, householdId },
      select: { id: true, name: true },
    });
    if (!category) return null;
    const rows = await prisma.provider.findMany({
      where: { ...eligibleWhere(householdId), categoryId: category.id, projects: { none: { projectId: project.id } } },
      include: listInclude,
    });
    return {
      category,
      providers: fallbackProviders(rows.map(toProviderListItem)),
      searchUrl: googleSearchUrl(withNearMe(category.name)),
    };
  }

  private usedInLastDay(householdId: string): Promise<number> {
    return asksInLastDay(householdId, this.now);
  }

  private async finishLog(id: string, outcome: SuggestionRunStatus, durationMs: number, usage: Usage): Promise<void> {
    try {
      await prisma.aiRequestLog.update({
        where: { id },
        data: {
          outcome,
          durationMs,
          promptTokens: usage.reported ? usage.promptTokens : null,
          outputTokens: usage.reported ? usage.outputTokens : null,
        },
      });
    } catch {
      // The row stays "started" and still counts toward the cap; the ask itself is not failed over bookkeeping.
      console.error('[suggestions] could not update the request log');
    }
  }

  private async requireProject(householdId: string, projectId: string): Promise<ProjectRow> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: projectSelect,
    });
    if (!project) throw new HttpError('Project not found', 404);
    return project;
  }
}
