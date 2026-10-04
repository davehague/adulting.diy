import {
  type NextStepsResponse,
  type PhotoVariant,
  type ProjectCreateInput,
  type ProjectDetail,
  type ProjectListFilters,
  type ProjectListItem,
  type ProjectPhotoDto,
  type ProjectStepCreateInput,
  type ProjectStepDto,
  type ProjectStepUpdateInput,
  type ProjectUpdateInput,
} from '@/types/project';
import { type ResizedPhoto } from '@/utils/image-resize';

export const useProjects = () => {
  const api = useApi();

  const listProjects = (filters: ProjectListFilters = {}) => {
    const params: Record<string, string> = {};
    if (filters.statuses?.length) params.status = filters.statuses.join(',');
    if (filters.path) params.path = filters.path;
    return api.get<ProjectListItem[]>('/api/projects', { params });
  };

  const getProject = (id: string) => api.get<ProjectDetail>(`/api/projects/${id}`);
  const createProject = (input: ProjectCreateInput) => api.post<{ id: string }>('/api/projects', input);
  const updateProject = (id: string, input: ProjectUpdateInput) =>
    api.put<ProjectDetail>(`/api/projects/${id}`, input);
  const deleteProject = (id: string) => api.delete(`/api/projects/${id}`);
  const listLocations = () => api.get<string[]>('/api/projects/locations');

  const uploadPhoto = (projectId: string, photo: ResizedPhoto) => {
    const form = new FormData();
    form.append('full', photo.full, 'full.jpg');
    form.append('thumb', photo.thumb, 'thumb.jpg');
    form.append('width', String(photo.width));
    form.append('height', String(photo.height));
    return api.upload<ProjectPhotoDto>(`/api/projects/${projectId}/photos`, form);
  };

  const deletePhoto = (projectId: string, photoId: string) =>
    api.delete(`/api/projects/${projectId}/photos/${photoId}`);

  // Photos are private, so they are fetched with the auth header and shown from an object URL.
  const fetchPhotoBlob = async (projectId: string, photoId: string, variant: PhotoVariant): Promise<Blob> => {
    const response = await api.get<Response>(`/api/projects/${projectId}/photos/${photoId}`, { params: { variant } });
    return response.blob();
  };

  const listNextSteps = () => api.get<NextStepsResponse>('/api/projects/next-steps');
  const addStep = (projectId: string, input: ProjectStepCreateInput) =>
    api.post<ProjectStepDto>(`/api/projects/${projectId}/steps`, input);
  const updateStep = (projectId: string, stepId: string, input: ProjectStepUpdateInput) =>
    api.put<ProjectStepDto>(`/api/projects/${projectId}/steps/${stepId}`, input);
  const deleteStep = (projectId: string, stepId: string) =>
    api.delete(`/api/projects/${projectId}/steps/${stepId}`);

  return {
    listProjects, getProject, createProject, updateProject, deleteProject, listLocations,
    uploadPhoto, deletePhoto, fetchPhotoBlob,
    listNextSteps, addStep, updateStep, deleteStep,
  };
};
