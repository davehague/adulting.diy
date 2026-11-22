import { Prisma } from '@prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { ApiKeyService } from '@/server/services/ApiKeyService';
import { ProjectStepService } from '@/server/services/ProjectStepService';
import { stepCreateSchema } from '@/server/utils/project-schemas';
import { toIngestStep } from '@/server/utils/ingest-project-dto';
import {
  MAX_PROJECT_STEPS,
  type IngestProjectStepDto,
  type IngestStepBatchResult,
  type ProjectStepCreateInput,
  type ProjectStepUpdateInput,
} from '@/types/project';

// Step text, case and surrounding space ignored: the identity a retried batch is checked against.
const matchKey = (text: string): string => text.trim().toLowerCase();

// A retry that overlaps the first call can pass the step check and then find the row gone (P2025); answer the documented 404, not a 500.
const stepGoneAs404 = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new HttpError('Step not found', 404);
  }
  throw error;
};

const OVER_CAP = `This project already has ${MAX_PROJECT_STEPS} steps`;

interface Pending {
  index: number;
  text: string;
  input: ProjectStepCreateInput;
  // later items in the batch with the same text
  repeats: { index: number; text: string }[];
}

// Ingest-only glue (owner check, dedupe, envelope, DTO mapping); every rule lives in ProjectStepService.
export class ProjectStepIngestService {
  private apiKeys = new ApiKeyService();
  private steps = new ProjectStepService();

  async addBatch(householdId: string, userId: string, projectId: string, rawItems: unknown[]): Promise<IngestStepBatchResult> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);

    const existing = await this.steps.list(householdId, projectId);
    // Done steps do not count, so a finished "Clean the gutters" can be filed again next year.
    const undone = new Map<string, string>();
    for (const step of existing) {
      if (step.doneAt === null && !undone.has(matchKey(step.text))) undone.set(matchKey(step.text), step.id);
    }

    const result: IngestStepBatchResult = { created: [], skipped: [], errors: [] };
    const pending: Pending[] = [];
    const firstInBatch = new Map<string, Pending>();

    for (let index = 0; index < rawItems.length; index++) {
      const raw = rawItems[index];
      const parsed = stepCreateSchema.safeParse(raw);
      if (!parsed.success) {
        const text = typeof (raw as { text?: unknown })?.text === 'string' ? (raw as { text: string }).text : '';
        result.errors.push({ index, text, message: parsed.error.issues[0]?.message ?? 'Invalid item' });
        continue;
      }
      const { text } = parsed.data;
      const key = matchKey(text);
      const duplicateId = undone.get(key);
      if (duplicateId) {
        result.skipped.push({ index, id: duplicateId, text, reason: 'An undone step with this text already exists' });
        continue;
      }
      const earlier = firstInBatch.get(key);
      if (earlier) {
        earlier.repeats.push({ index, text });
        continue;
      }
      const item: Pending = { index, text, input: parsed.data, repeats: [] };
      firstInBatch.set(key, item);
      pending.push(item);
    }

    if (pending.length > 0) {
      const { created } = await this.steps.append(householdId, userId, projectId, pending.map((p) => p.input));
      pending.forEach((item, i) => {
        const step = created[i];
        if (!step) {
          // Past the cap: nothing was saved, so this is an error, not a skip with an id to rely on.
          result.errors.push({ index: item.index, text: item.text, message: OVER_CAP });
          for (const repeat of item.repeats) result.errors.push({ index: repeat.index, text: repeat.text, message: OVER_CAP });
          return;
        }
        result.created.push({ index: item.index, id: step.id, text: item.text });
        for (const repeat of item.repeats) {
          result.skipped.push({ index: repeat.index, id: step.id, text: repeat.text, reason: 'Repeats an earlier step in this batch' });
        }
      });
    }

    result.created.sort((a, b) => a.index - b.index);
    result.skipped.sort((a, b) => a.index - b.index);
    result.errors.sort((a, b) => a.index - b.index);
    return result;
  }

  async update(householdId: string, userId: string, projectId: string, stepId: string, input: ProjectStepUpdateInput): Promise<IngestProjectStepDto> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    const step = await this.steps.update(householdId, projectId, stepId, input).catch(stepGoneAs404);
    return toIngestStep(step);
  }

  async remove(householdId: string, userId: string, projectId: string, stepId: string): Promise<void> {
    await this.apiKeys.requireOwnerInHousehold(householdId, userId);
    await this.steps.remove(householdId, projectId, stepId).catch(stepGoneAs404);
  }
}
