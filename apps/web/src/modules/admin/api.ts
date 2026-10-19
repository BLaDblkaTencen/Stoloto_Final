// Запросы админки. Владелец: участник 3. Контракт — docs/api/core.md.
import type {
  AdminEventDetails,
  AdminEventItem,
  AdminEventsQuery,
  AdminList,
  AdminOrganizationDetails,
  AdminOrganizationItem,
  AdminOrganizationsQuery,
} from '@sport/shared/schemas/admin';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '../../shared/api/client';

/** ?status=pending&q=… без пустых параметров. */
const query = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  return search.size ? `?${search}` : '';
};

export function useAdminOrganizations(params: AdminOrganizationsQuery) {
  return useQuery({
    queryKey: ['admin', 'organizations', params],
    queryFn: () => api<AdminList<AdminOrganizationItem>>(`/admin/organizations${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrganization(id: string) {
  return useQuery({
    queryKey: ['admin', 'organization', id],
    queryFn: () => api<AdminOrganizationDetails>(`/admin/organizations/${id}`),
  });
}

export function useAdminEvents(params: AdminEventsQuery) {
  return useQuery({
    queryKey: ['admin', 'events', params],
    queryFn: () => api<AdminList<AdminEventItem>>(`/admin/events${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminEvent(id: string) {
  return useQuery({
    queryKey: ['admin', 'event', id],
    queryFn: () => api<AdminEventDetails>(`/admin/events/${id}`),
  });
}

// После решения сервер возвращает обновлённую карточку: кладём её в кэш, а списки
// (и ленту участников, где событие могло пропасть) перезапрашиваем.
function refresh(queryClient: QueryClient, key: readonly unknown[], data: unknown) {
  queryClient.setQueryData(key, data);
  const sameKey = JSON.stringify(key);
  void queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] !== 'auth' && JSON.stringify(q.queryKey) !== sameKey,
  });
}

const post = <T>(path: string, json?: object) => api<T>(path, { method: 'POST', json });

export function useOrganizationDecision(id: string) {
  const queryClient = useQueryClient();
  const onSuccess = (data: AdminOrganizationDetails) =>
    refresh(queryClient, ['admin', 'organization', id], data);
  return {
    approve: useMutation({
      mutationFn: () => post<AdminOrganizationDetails>(`/admin/organizations/${id}/approve`),
      onSuccess,
    }),
    reject: useMutation({
      mutationFn: (reason: string) =>
        post<AdminOrganizationDetails>(`/admin/organizations/${id}/reject`, { reason }),
      onSuccess,
    }),
  };
}

export function useEventModeration(id: string) {
  const queryClient = useQueryClient();
  const onSuccess = (data: AdminEventDetails) => refresh(queryClient, ['admin', 'event', id], data);
  return {
    unpublish: useMutation({
      mutationFn: (reason: string) =>
        post<AdminEventDetails>(`/admin/events/${id}/unpublish`, { reason }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (reason: string) =>
        post<AdminEventDetails>(`/admin/events/${id}/delete`, { reason }),
      onSuccess,
    }),
    hideComment: useMutation({
      mutationFn: ({ commentId, reason }: { commentId: string; reason: string }) =>
        post<AdminEventDetails>(`/admin/comments/${commentId}/hide`, { reason }),
      onSuccess,
    }),
  };
}
