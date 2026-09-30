import {
  type ProviderCategoryDto,
  type ProviderInput,
  type ProviderListFilters,
  type ProviderListItem,
  type ProviderStatusDto,
} from '@/types/provider';

export interface ProviderDetail {
  id: string;
  name: string;
  [key: string]: unknown;
}

export const useProviders = () => {
  const api = useApi();

  const listProviders = (filters: ProviderListFilters = {}) => {
    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.statusId) params.statusId = filters.statusId;
    if (filters.includeHidden) params.includeHidden = 'true';
    if (filters.sort) params.sort = filters.sort;
    return api.get<ProviderListItem[]>('/api/providers', { params });
  };

  const getProvider = (id: string) => api.get<ProviderDetail>(`/api/providers/${id}`);
  const createProvider = (input: ProviderInput) => api.post<{ id: string }>('/api/providers', input);
  const updateProvider = (id: string, input: Partial<ProviderInput>) => api.put(`/api/providers/${id}`, input);
  const deleteProvider = (id: string) => api.delete(`/api/providers/${id}`);

  const listCategories = () => api.get<ProviderCategoryDto[]>('/api/provider-categories');
  const listStatuses = () => api.get<ProviderStatusDto[]>('/api/provider-statuses');

  const addComment = (providerId: string, body: string) =>
    api.post(`/api/providers/${providerId}/comments`, { body });
  const updateComment = (providerId: string, commentId: string, body: string) =>
    api.put(`/api/providers/${providerId}/comments/${commentId}`, { body });
  const deleteComment = (providerId: string, commentId: string) =>
    api.delete(`/api/providers/${providerId}/comments/${commentId}`);

  const addContact = (providerId: string, contact: { name: string; role?: string; phone?: string; email?: string }) =>
    api.post(`/api/providers/${providerId}/contacts`, contact);
  const updateContact = (providerId: string, contactId: string, contact: Record<string, unknown>) =>
    api.put(`/api/providers/${providerId}/contacts/${contactId}`, contact);
  const deleteContact = (providerId: string, contactId: string) =>
    api.delete(`/api/providers/${providerId}/contacts/${contactId}`);

  return {
    listProviders, getProvider, createProvider, updateProvider, deleteProvider,
    listCategories, listStatuses,
    addComment, updateComment, deleteComment,
    addContact, updateContact, deleteContact,
  };
};
