// Запросы зоны «Организация». Владелец: участник 2. Контракт — docs/api/organizations.md.
import type { EventListItem } from '@sport/shared/schemas/events';
import type {
  CreateOrganizationBody,
  OrganizationOwner,
  OrganizationPublic,
  OrganizationView,
  UpdateOrganizationBody,
} from '@sport/shared/schemas/organizations';
import type { Sport } from '@sport/shared/schemas/sports';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../shared/api/client';

export const orgKeys = {
  all: ['org'] as const,
  mine: ['org', 'mine'] as const,
  list: (params: OrganizationsParams) => ['org', 'list', params] as const,
  one: (id: string) => ['org', 'one', id] as const,
  events: (id: string) => ['org', 'events', id] as const,
};

export type OrganizationsParams = { q?: string; sportId?: string; offset?: number };

/** Строка запроса без пустых значений. */
function toSearch(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Своя организация. null — заявка ещё не подана (сервер отвечает 404 ORG_NOT_FOUND). */
export function useMyOrganization() {
  return useQuery({
    queryKey: orgKeys.mine,
    queryFn: async () => {
      try {
        return await api<OrganizationOwner>('/organizations/me');
      } catch (error) {
        if (error instanceof ApiError && error.code === 'ORG_NOT_FOUND') return null;
        throw error;
      }
    },
  });
}

// После изменения своей организации обновляем её в кэше и сбрасываем списки и страницы.
function storeMine(queryClient: QueryClient, org: OrganizationOwner) {
  queryClient.setQueryData(orgKeys.mine, org);
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) => queryKey[0] === 'org' && queryKey[1] !== 'mine',
  });
  // Свой вид спорта из заявки уже в каталоге: он появится среди чипов формы и фильтров.
  void queryClient.invalidateQueries({ queryKey: ['sports'] });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationBody) =>
      api<OrganizationOwner>('/organizations', { method: 'POST', json: body }),
    onSuccess: (org) => storeMine(queryClient, org),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationBody) =>
      api<OrganizationOwner>('/organizations/me', { method: 'PATCH', json: body }),
    onSuccess: (org) => storeMine(queryClient, org),
  });
}

export function useResubmitOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<OrganizationOwner>('/organizations/me/resubmit', { method: 'POST' }),
    onSuccess: (org) => storeMine(queryClient, org),
  });
}

export function useOrganizations(params: OrganizationsParams) {
  return useQuery({
    queryKey: orgKeys.list(params),
    queryFn: () =>
      api<{ items: OrganizationPublic[]; total: number }>(`/organizations${toSearch(params)}`),
    // При смене фильтра старый список остаётся на экране, пока грузится новый.
    placeholderData: keepPreviousData,
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: orgKeys.one(id),
    queryFn: () => api<OrganizationView>(`/organizations/${encodeURIComponent(id)}`),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

/** Опубликованные события организации (API участника 1). */
export function useOrganizationEvents(id: string, enabled: boolean) {
  return useQuery({
    queryKey: orgKeys.events(id),
    queryFn: () =>
      api<{ items: EventListItem[]; total: number }>(`/events${toSearch({ organizationId: id })}`),
    enabled,
  });
}

/** Каталог видов спорта для выбора интересов. Меняется редко. */
export function useSports() {
  return useQuery({
    queryKey: ['sports', 'all'],
    queryFn: () => api<{ items: Sport[] }>('/sports'),
    select: (data) => data.items,
    staleTime: 5 * 60_000,
  });
}
