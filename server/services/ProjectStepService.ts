import { type Prisma } from '@prisma/client';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import {
  MAX_PROJECT_STEPS,
  type NextStepItem,
  type NextStepsResponse,
  type ProjectStepCreateInput,
  type ProjectStepDto,
  type ProjectStepUpdateInput,
} from '@/types/project';
import { nextStepOf } from '@/utils/project-steps';

// createdAt breaks the tie when two steps added at the same instant got the same position.
export const stepOrder = [{ position: 'asc' }, { createdAt: 'asc' }] satisfies Prisma.ProjectStepOrderByWithRelationInput[];

export const stepSelect = {
  id: true,
  text: true,
  position: true,
  doneAt: true,
  estimateMinutes: true,
} satisfies Prisma.ProjectStepSelect;

export class ProjectStepService {
  async add(householdId: string, userId: string, projectId: string, input: ProjectStepCreateInput): Promise<ProjectStepDto> {
    await this.requireProject(householdId, projectId);
    const existing = await prisma.projectStep.findMany({ where: { projectId }, select: { position: true } });
    if (existing.length >= MAX_PROJECT_STEPS) {
      throw new HttpError(`This project already has ${MAX_PROJECT_STEPS} steps`, 409);
    }
    const position = existing.reduce((highest, step) => Math.max(highest, step.position), -1) + 1;
    return prisma.projectStep.create({
      data: {
        projectId,
        createdById: userId,
        text: input.text,
        estimateMinutes: input.estimateMinutes ?? null,
        position,
      },
      select: stepSelect,
    });
  }

  async update(householdId: string, projectId: string, stepId: string, input: ProjectStepUpdateInput): Promise<ProjectStepDto> {
    await this.requireProject(householdId, projectId);
    const step = await this.requireStep(projectId, stepId);
    const data: Prisma.ProjectStepUpdateInput = {};
    if (input.text !== undefined) data.text = input.text;
    if (input.estimateMinutes !== undefined) data.estimateMinutes = input.estimateMinutes;
    // Checking a step that is already done keeps the time it was first checked.
    if (input.done === true && step.doneAt === null) data.doneAt = new Date();
    if (input.done === false) data.doneAt = null;
    return prisma.projectStep.update({ where: { id: stepId }, data, select: stepSelect });
  }

  async remove(householdId: string, projectId: string, stepId: string): Promise<void> {
    await this.requireProject(householdId, projectId);
    await this.requireStep(projectId, stepId);
    await prisma.projectStep.delete({ where: { id: stepId } });
  }

  async nextSteps(householdId: string): Promise<NextStepsResponse> {
    const [projectCount, activeProjects] = await Promise.all([
      prisma.project.count({ where: { householdId, metaStatus: 'active' } }),
      prisma.project.findMany({
        where: { householdId, metaStatus: 'active', status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, steps: { orderBy: stepOrder, select: stepSelect } },
      }),
    ]);

    const items: NextStepItem[] = activeProjects.map((project) => {
      const { kind, step } = nextStepOf(project.steps);
      return {
        projectId: project.id,
        projectTitle: project.title,
        kind,
        step: step ? { id: step.id, text: step.text, estimateMinutes: step.estimateMinutes } : null,
      };
    });

    return { hasProjects: projectCount > 0, items };
  }

  private async requireProject(householdId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);
  }

  private async requireStep(projectId: string, stepId: string): Promise<{ id: string; doneAt: Date | null }> {
    const step = await prisma.projectStep.findFirst({
      where: { id: stepId, projectId },
      select: { id: true, doneAt: true },
    });
    if (!step) throw new HttpError('Step not found', 404);
    return step;
  }
}
