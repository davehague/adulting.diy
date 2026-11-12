import { useAuthStore } from '@/stores/auth';
import { documentExtension } from '@/utils/project-documents';
import {
  DOCUMENT_TYPES,
  type NextStepsResponse,
  type PhotoVariant,
  type ProjectCreateInput,
  type ProjectDetail,
  type ProjectDocumentDto,
  type ProjectListFilters,
  type ProjectListItem,
  type ProjectPhotoDto,
  type ProjectProviderDto,
  type ProjectProviderStatus,
  type ProjectStepCreateInput,
  type ProjectStepDto,
  type ProjectStepUpdateInput,
  type ProjectUpdateInput,
} from '@/types/project';
import { CHAT_DEADLINE_MS, type ChatSendInput, type ChatSendResponse, type ChatStateResponse } from '@/types/chat';
import { type PlanRunResponse, type PlanStateResponse, type StepBatchResponse } from '@/types/plan';
import { type SuggestionRunResponse, type SuggestionStateResponse } from '@/types/suggestion';
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

  // The file goes from the browser straight to Blob; our route only signs the one path. `path` comes from documentBlobPath.
  const uploadDocumentFile = async (
    projectId: string,
    path: string,
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<void> => {
    const extension = documentExtension(path);
    if (!extension) throw new Error('Only PDF, Word, Excel, JPEG or PNG files');
    const token = useAuthStore().accessToken;
    // Loaded on the first upload only: the Blob client is about 100 KB and most visits never upload a document.
    const { uploadPresigned } = await import('@vercel/blob/client');
    await uploadPresigned(path, file, {
      access: 'private',
      handleUploadUrl: `/api/projects/${projectId}/documents/upload`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      contentType: DOCUMENT_TYPES[extension],
      onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
    });
  };

  const registerDocument = (projectId: string, input: { id: string; blobPath: string; name: string; note: string | null }) =>
    api.post<ProjectDocumentDto>(`/api/projects/${projectId}/documents`, input);
  const getDocumentLink = (projectId: string, documentId: string) =>
    api.post<{ url: string; expiresAt: string }>(`/api/projects/${projectId}/documents/${documentId}/link`, {});
  const updateDocument = (projectId: string, documentId: string, input: { name?: string; note?: string | null }) =>
    api.patch<ProjectDocumentDto>(`/api/projects/${projectId}/documents/${documentId}`, input);
  const deleteDocument = (projectId: string, documentId: string) =>
    api.delete(`/api/projects/${projectId}/documents/${documentId}`);

  const listNextSteps = () => api.get<NextStepsResponse>('/api/projects/next-steps');
  const addStep = (projectId: string, input: ProjectStepCreateInput) =>
    api.post<ProjectStepDto>(`/api/projects/${projectId}/steps`, input);
  const updateStep = (projectId: string, stepId: string, input: ProjectStepUpdateInput) =>
    api.put<ProjectStepDto>(`/api/projects/${projectId}/steps/${stepId}`, input);
  const deleteStep = (projectId: string, stepId: string) =>
    api.delete(`/api/projects/${projectId}/steps/${stepId}`);

  const listProjectProviders = (projectId: string) =>
    api.get<ProjectProviderDto[]>(`/api/projects/${projectId}/providers`);
  const linkProvider = (projectId: string, providerId: string) =>
    api.post<ProjectProviderDto[]>(`/api/projects/${projectId}/providers`, { providerId });
  const setProviderLinkStatus = (projectId: string, providerId: string, status: ProjectProviderStatus) =>
    api.put<ProjectProviderDto[]>(`/api/projects/${projectId}/providers/${providerId}`, { status });
  const unlinkProvider = (projectId: string, providerId: string) =>
    api.delete(`/api/projects/${projectId}/providers/${providerId}`);

  const getSuggestions = (projectId: string) =>
    api.get<SuggestionStateResponse>(`/api/projects/${projectId}/suggestions`);
  // Takes around 15 seconds: the server makes two model calls before it answers.
  const runSuggestions = (projectId: string, extraText: string) =>
    api.post<SuggestionRunResponse>(`/api/projects/${projectId}/suggestions`, { extraText });

  const getPlan = (projectId: string) => api.get<PlanStateResponse>(`/api/projects/${projectId}/plan`);
  // Takes around 20 seconds: one model call that writes the whole plan.
  const runPlan = (projectId: string, extraText: string) =>
    api.post<PlanRunResponse>(`/api/projects/${projectId}/plan`, { extraText });
  const addSteps = (projectId: string, steps: ProjectStepCreateInput[]) =>
    api.post<StepBatchResponse>(`/api/projects/${projectId}/steps/batch`, { steps });

  const getChat = (projectId: string) => api.get<ChatStateResponse>(`/api/projects/${projectId}/chat`);
  // Takes 5 to 60 seconds: one or more model calls, plus the searches the model asks for. The timeout sits past the server's own deadline, so a dropped connection ends instead of hanging.
  const sendChat = (projectId: string, input: ChatSendInput) =>
    api.post<ChatSendResponse>(`/api/projects/${projectId}/chat`, input, { signal: AbortSignal.timeout(CHAT_DEADLINE_MS + 30_000) });

  return {
    listProjects, getProject, createProject, updateProject, deleteProject, listLocations,
    uploadPhoto, deletePhoto, fetchPhotoBlob,
    uploadDocumentFile, registerDocument, getDocumentLink, updateDocument, deleteDocument,
    listNextSteps, addStep, updateStep, deleteStep,
    listProjectProviders, linkProvider, setProviderLinkStatus, unlinkProvider,
    getSuggestions, runSuggestions,
    getPlan, runPlan, addSteps,
    getChat, sendChat,
  };
};
