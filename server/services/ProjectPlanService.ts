import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { suggestionModel, suggestionsEnabledFor } from '@/server/utils/ai-config';
import { askJson, asksInLastDay, describeError, LIMIT_MESSAGE, promptChars, type AskUsage } from '@/server/utils/ai-ask';
import { callOllama, type ModelCall } from '@/server/utils/ollama';
import { buildPlanPrompt, type PlanTrade } from '@/server/utils/plan-prompts';
import { clampPlan, planReplySchema, savedPlanSchema } from '@/server/utils/plan-schemas';
import { type ProjectText } from '@/server/utils/suggestion-prompts';
import { savedResultSchema } from '@/server/utils/suggestion-schemas';
import { DIY_PLAN_FEATURE, type PlanRunResponse, type PlanRunStatus, type PlanStateResponse, type ProjectPlanDto, type SavedPlanResult } from '@/types/plan';
import { DAILY_SUGGESTION_LIMIT, SUGGESTION_DEADLINE_MS } from '@/types/suggestion';

const projectSelect = { id: true, title: true, location: true, notes: true, status: true } satisfies Prisma.ProjectSelect;
type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

export class ProjectPlanService {
  constructor(
    private readonly callModel: ModelCall = callOllama,
    private readonly now: () => number = Date.now,
  ) {}

  async getState(householdId: string, projectId: string): Promise<PlanStateResponse> {
    await this.requireProject(householdId, projectId);
    if (!suggestionsEnabledFor(householdId)) return { enabled: false, limitReached: false, hasSuggestions: false, plan: null };
    const [used, trades, plan] = await Promise.all([asksInLastDay(householdId, this.now), this.trades(projectId), this.readPlan(projectId)]);
    return { enabled: true, limitReached: used >= DAILY_SUGGESTION_LIMIT, hasSuggestions: trades.length > 0, plan };
  }

  async run(householdId: string, userId: string, projectId: string, extraText: string | null): Promise<PlanRunResponse> {
    const project = await this.requireProject(householdId, projectId);
    // The same switch as provider suggestions; the message is shared so the screen shows one thing for both.
    if (!suggestionsEnabledFor(householdId)) throw new HttpError('Suggestions are not available', 403);
    const used = await asksInLastDay(householdId, this.now);
    if (used >= DAILY_SUGGESTION_LIMIT) throw new HttpError(LIMIT_MESSAGE, 429);

    const model = suggestionModel();
    const startedAt = this.now();
    // Written before the model call, so an ask the platform kills mid-call still counts toward the cap.
    const log = await prisma.aiRequestLog.create({
      data: { householdId, userId, feature: DIY_PLAN_FEATURE, model, outcome: 'started' },
      select: { id: true },
    });

    const usage: AskUsage = { promptTokens: 0, outputTokens: 0, reported: false };
    let chars = 0;
    let status: PlanRunStatus;
    const trades = await this.trades(projectId);
    try {
      const text: ProjectText = { title: project.title, location: project.location, notes: project.notes, extra: extraText };
      const prompt = buildPlanPrompt(text, trades, new Date(this.now()).toISOString().slice(0, 10));
      chars = promptChars(prompt);
      const reply = await askJson(this.callModel, this.now, prompt, planReplySchema, model, startedAt + SUGGESTION_DEADLINE_MS, usage);
      const result: SavedPlanResult = clampPlan(reply);
      const data = { extraText, result: result as unknown as Prisma.InputJsonObject, model, createdById: userId };
      await prisma.projectPlan.upsert({
        where: { projectId },
        create: { projectId, ...data },
        update: { ...data, createdAt: new Date(this.now()) },
      });
      status = result.tooVague ? 'too_vague' : 'ok';
    } catch (error) {
      console.error(`[plan] ask failed: ${describeError(error)}`);
      status = 'failed';
    }

    const durationMs = this.now() - startedAt;
    // Numbers and the status word only.
    console.info(`[plan] ${status} in ${durationMs} ms; prompt ${chars} chars; trades ${trades.length}`);
    await this.finishLog(log.id, status, durationMs, usage);
    return {
      status,
      limitReached: used + 1 >= DAILY_SUGGESTION_LIMIT,
      hasSuggestions: trades.length > 0,
      // On a failure nothing was saved, so this is the previous plan, if there was one.
      plan: await this.readPlan(projectId),
    };
  }

  // The outline for the plan: the trades from the project's saved provider suggestion, as name and why only. Never the providers.
  private async trades(projectId: string): Promise<PlanTrade[]> {
    const row = await prisma.projectSuggestion.findUnique({ where: { projectId }, select: { result: true } });
    if (!row) return [];
    const saved = savedResultSchema.safeParse(row.result);
    if (!saved.success || saved.data.tooVague) return [];
    return saved.data.parts.map((part) => ({ name: part.name, why: part.why }));
  }

  private async readPlan(projectId: string): Promise<ProjectPlanDto | null> {
    const row = await prisma.projectPlan.findUnique({ where: { projectId }, select: { extraText: true, result: true, createdAt: true } });
    if (!row) return null;
    const saved = savedPlanSchema.safeParse(row.result);
    if (!saved.success) return null;
    return { ...saved.data, extraText: row.extraText, createdAt: row.createdAt };
  }

  private async finishLog(id: string, outcome: PlanRunStatus, durationMs: number, usage: AskUsage): Promise<void> {
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
      // The row stays "started" and still counts toward the cap.
      console.error('[plan] could not update the request log');
    }
  }

  private async requireProject(householdId: string, projectId: string): Promise<ProjectRow> {
    const project = await prisma.project.findFirst({ where: { id: projectId, householdId, metaStatus: 'active' }, select: projectSelect });
    if (!project) throw new HttpError('Project not found', 404);
    return project;
  }
}
