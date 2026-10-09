import { type Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { chatModel, suggestionsEnabledFor } from '@/server/utils/ai-config';
import { askChat, describeError, type AskUsage } from '@/server/utils/ai-ask';
import { callOllamaChat, searchOllama, type ChatCall, type WebSearch } from '@/server/utils/ollama';
import { buildChatPrompt, type ChatContext, type ChatHistoryRow, type ChatPhotos } from '@/server/utils/chat-prompts';
import { readPrivateBytes } from '@/server/utils/blob-storage';
import { savedPlanSchema } from '@/server/utils/plan-schemas';
import { savedResultSchema } from '@/server/utils/suggestion-schemas';
import { visibleLinkWhere } from '@/server/services/ProjectProviderService';
import {
  CHAT_BUSY_MESSAGE,
  CHAT_DEADLINE_MS,
  CHAT_FAILED_MESSAGE,
  CHAT_FEATURE,
  CHAT_NOTHING_TO_RETRY_MESSAGE,
  CHAT_PENDING_MS,
  MAX_CHAT_HISTORY,
  MAX_CHAT_REPLY_CHARS,
  MAX_CHAT_SCREEN_MESSAGES,
  type ChatMessageDto,
  type ChatRole,
  type ChatSendInput,
  type ChatSendResponse,
  type ChatStateResponse,
} from '@/types/chat';

const projectSelect = { id: true, title: true, location: true, notes: true, status: true, path: true } satisfies Prisma.ProjectSelect;
type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

const messageSelect = { id: true, role: true, content: true, createdById: true, searches: true, photoIds: true, failedAt: true, createdAt: true } satisfies Prisma.ProjectChatMessageSelect;
type MessageRow = Prisma.ProjectChatMessageGetPayload<{ select: typeof messageSelect }>;

const searchesSchema = z.array(z.string());

// [] when the column is unreadable, the same as for searches.
const parsedPhotoIds = (value: unknown): string[] => {
  const parsed = searchesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

interface PhotoRow {
  id: string;
  fullPath: string;
  thumbPath: string;
}

const toDto = (row: MessageRow, userId: string): ChatMessageDto => {
  const searches = searchesSchema.safeParse(row.searches);
  return {
    id: row.id,
    role: row.role as ChatRole,
    content: row.content,
    mine: row.role === 'user' && row.createdById === userId,
    failed: row.failedAt !== null,
    searches: searches.success ? searches.data : [],
    photoIds: parsedPhotoIds(row.photoIds),
    createdAt: row.createdAt.toISOString(),
  };
};

export class ProjectChatService {
  constructor(
    private readonly callChat: ChatCall = callOllamaChat,
    private readonly search: WebSearch = searchOllama,
    private readonly now: () => number = Date.now,
  ) {}

  async getState(householdId: string, userId: string, projectId: string): Promise<ChatStateResponse> {
    await this.requireProject(householdId, projectId);
    if (!suggestionsEnabledFor(householdId)) return { enabled: false, messages: [], pending: false };
    const newestFirst = await prisma.projectChatMessage.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: MAX_CHAT_SCREEN_MESSAGES, select: messageSelect });
    const rows = [...newestFirst].reverse();
    const last = rows[rows.length - 1];
    return { enabled: true, messages: rows.map((row) => toDto(row, userId)), pending: last !== undefined && this.isFresh(last) };
  }

  async send(householdId: string, userId: string, projectId: string, input: ChatSendInput): Promise<ChatSendResponse> {
    const project = await this.requireProject(householdId, projectId);
    // The same switch as provider suggestions; the message is shared so the screen shows one thing for every AI feature.
    if (!suggestionsEnabledFor(householdId)) throw new HttpError('Suggestions are not available', 403);

    const photoRows: PhotoRow[] = await prisma.projectPhoto.findMany({ where: { projectId }, orderBy: { position: 'asc' }, select: { id: true, fullPath: true, thumbPath: true } });
    // A repeated id attaches once. Every id must be one of this project's photos, checked before anything is saved.
    const requestedIds = 'retry' in input ? [] : [...new Set(input.photoIds)];
    if (requestedIds.some((id) => !photoRows.some((row) => row.id === id))) throw new HttpError('Photo not found', 404);

    const last = await prisma.projectChatMessage.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' }, select: messageSelect });
    // One reply at a time per project: a fresh unanswered question means a request is still running.
    if (last && this.isFresh(last)) throw new HttpError(CHAT_BUSY_MESSAGE, 409);

    let userRow: MessageRow;
    let attachedIds = requestedIds;
    if ('retry' in input) {
      if (!last || last.role !== 'user') throw new HttpError(CHAT_NOTHING_TO_RETRY_MESSAGE, 400);
      // The same row is asked again; refreshing it makes the lock and the pending window work as for a new message.
      userRow = await prisma.projectChatMessage.update({ where: { id: last.id }, data: { failedAt: null, createdAt: new Date(this.now()) }, select: messageSelect });
      // A retry resends the photos saved on the row; ids that no longer exist are skipped.
      attachedIds = parsedPhotoIds(userRow.photoIds);
    } else {
      // Saved before the model is called, so a reply the platform kills still leaves the question in the thread. Rows are stamped with the app clock, the same one that ages them, so one clock orders every row.
      userRow = await prisma.projectChatMessage.create({ data: { projectId, role: 'user', content: input.text, createdById: userId, photoIds: attachedIds, createdAt: new Date(this.now()) }, select: messageSelect });
    }

    const model = chatModel();
    const startedAt = this.now();
    const log = await prisma.aiRequestLog.create({
      data: { householdId, userId, feature: CHAT_FEATURE, model, outcome: 'started' },
      select: { id: true },
    });

    const usage: AskUsage = { promptTokens: 0, outputTokens: 0, reported: false };
    let assistantRow: MessageRow | null = null;
    let chars = 0;
    let historyLength = 0;
    let searches: string[] = [];
    let photoCounts = { attached: 0, total: 0, unreadable: 0 };
    try {
      const [context, history, loaded] = await Promise.all([this.context(project), this.history(projectId), this.photos(photoRows, attachedIds)]);
      historyLength = history.length;
      photoCounts = { attached: loaded.photos.attached.length, total: loaded.photos.attached.length + loaded.photos.others.length, unreadable: loaded.unreadable };
      const prompt = buildChatPrompt(context, history, userId, new Date(this.now()).toISOString().slice(0, 10), loaded.photos);
      chars = prompt.messages.reduce((sum, message) => sum + message.content.length, 0);
      const reply = await askChat(this.callChat, this.search, this.now, prompt, model, startedAt + CHAT_DEADLINE_MS, usage);
      searches = reply.searches;
      const durationMs = this.now() - startedAt;
      assistantRow = await prisma.projectChatMessage.create({
        data: {
          projectId,
          role: 'assistant',
          content: reply.text.slice(0, MAX_CHAT_REPLY_CHARS),
          createdById: userRow.createdById,
          searches: reply.searches,
          model,
          durationMs,
          promptTokens: usage.reported ? usage.promptTokens : null,
          outputTokens: usage.reported ? usage.outputTokens : null,
          createdAt: new Date(this.now()),
        },
        select: messageSelect,
      });
    } catch (error) {
      console.error(`[chat] ask failed: ${describeError(error)}`);
    }

    const durationMs = this.now() - startedAt;
    await this.finishLog(log.id, assistantRow ? 'ok' : 'failed', durationMs, usage);
    if (!assistantRow) {
      await this.markFailed(userRow.id);
      throw new HttpError(CHAT_FAILED_MESSAGE, 502);
    }
    // Numbers only.
    const unreadable = photoCounts.unreadable > 0 ? ` (${photoCounts.unreadable} unreadable)` : '';
    console.info(`[chat] ok in ${durationMs} ms; prompt ${chars} chars; history ${historyLength}; searches ${searches.length}; photos ${photoCounts.attached}/${photoCounts.total}${unreadable}`);
    return { userMessage: toDto(userRow, userId), assistantMessage: toDto(assistantRow, userId) };
  }

  private isFresh(row: MessageRow): boolean {
    return row.role === 'user' && row.failedAt === null && this.now() - row.createdAt.getTime() < CHAT_PENDING_MS;
  }

  // Everything the prompt may know, read fresh for every message.
  private async context(project: ProjectRow): Promise<ChatContext> {
    const [steps, links, suggestion, plan] = await Promise.all([
      prisma.projectStep.findMany({ where: { projectId: project.id }, orderBy: { position: 'asc' }, select: { text: true, doneAt: true, estimateMinutes: true } }),
      prisma.projectProvider.findMany({
        where: { projectId: project.id, ...visibleLinkWhere },
        orderBy: { createdAt: 'asc' },
        select: { status: true, provider: { select: { name: true, category: { select: { name: true } } } } },
      }),
      prisma.projectSuggestion.findUnique({ where: { projectId: project.id }, select: { result: true } }),
      prisma.projectPlan.findUnique({ where: { projectId: project.id }, select: { result: true } }),
    ]);
    const savedSuggestion = suggestion ? savedResultSchema.safeParse(suggestion.result) : null;
    const savedPlan = plan ? savedPlanSchema.safeParse(plan.result) : null;
    return {
      project: { title: project.title, location: project.location, notes: project.notes, status: project.status, path: project.path },
      steps,
      plan: savedPlan?.success ? savedPlan.data : null,
      trades: savedSuggestion?.success && !savedSuggestion.data.tooVague ? savedSuggestion.data.parts.map((part) => part.name) : [],
      links: links.map((link) => ({ name: link.provider.name, categoryName: link.provider.category.name, status: link.status })),
    };
  }

  // The project's thumbnails (every photo not attached) in position order, then the attached photos at full size in attachment order. A blob that cannot be read is skipped and counted.
  private async photos(photoRows: PhotoRow[], attachedIds: string[]): Promise<{ photos: ChatPhotos; unreadable: number }> {
    const others = photoRows.filter((row) => !attachedIds.includes(row.id)).map((row) => ({ path: row.thumbPath, attached: false }));
    const attached = attachedIds.flatMap((id) => {
      const row = photoRows.find((candidate) => candidate.id === id);
      return row ? [{ path: row.fullPath, attached: true }] : [];
    });
    const wanted = [...others, ...attached];
    const results = await Promise.all(
      wanted.map(async (item) => {
        try {
          return await readPrivateBytes(item.path);
        } catch {
          return null;
        }
      }),
    );
    const photos: ChatPhotos = { attached: [], others: [] };
    results.forEach((bytes, index) => {
      if (bytes) (wanted[index].attached ? photos.attached : photos.others).push(bytes);
    });
    return { photos, unreadable: results.filter((bytes) => bytes === null).length };
  }

  // The newest rows, returned oldest first. Read after the user row is saved so it is the last turn.
  private async history(projectId: string): Promise<ChatHistoryRow[]> {
    const rows = await prisma.projectChatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: MAX_CHAT_HISTORY,
      select: { role: true, content: true, createdById: true, photoIds: true },
    });
    return [...rows].reverse().map((row) => ({ role: row.role as ChatRole, content: row.content, createdById: row.createdById, photoCount: parsedPhotoIds(row.photoIds).length }));
  }

  private async markFailed(id: string): Promise<void> {
    try {
      await prisma.projectChatMessage.update({ where: { id }, data: { failedAt: new Date(this.now()) } });
    } catch {
      // The row stays unanswered; the screen offers Retry once the pending window passes.
      console.error('[chat] could not mark the message failed');
    }
  }

  private async finishLog(id: string, outcome: 'ok' | 'failed', durationMs: number, usage: AskUsage): Promise<void> {
    try {
      await prisma.aiRequestLog.update({
        where: { id },
        data: { outcome, durationMs, promptTokens: usage.reported ? usage.promptTokens : null, outputTokens: usage.reported ? usage.outputTokens : null },
      });
    } catch {
      console.error('[chat] could not update the request log');
    }
  }

  private async requireProject(householdId: string, projectId: string): Promise<ProjectRow> {
    const project = await prisma.project.findFirst({ where: { id: projectId, householdId, metaStatus: 'active' }, select: projectSelect });
    if (!project) throw new HttpError('Project not found', 404);
    return project;
  }
}
