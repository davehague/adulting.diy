import { type ProjectPath, type ProjectStatus } from '@/types/project';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  future: 'Future',
  done: 'Done',
};

export const PATH_LABELS: Record<ProjectPath, string> = {
  diy: 'DIY',
  hire: 'Hire',
  unsure: 'Not sure',
};

export const statusBadgeClass = (status: ProjectStatus): string => {
  if (status === 'active') return 'bg-amber-100 text-amber-800';
  if (status === 'done') return 'bg-green-100 text-green-800';
  return 'bg-stone-100 text-stone-700';
};
