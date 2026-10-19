// Запросы зоны «Пользователь»: виды спорта, мероприятия, запись. Контракт — docs/api/events.md.
// Ключи кэша начинаются с 'events' и 'registrations': после записи или отмены обновляем оба,
// чтобы лента, карточка и «Мои записи» сразу показывали новый статус.
import type {
  EventDetails,
  EventInput,
  EventListItem,
  ListResponse,
  MyRegistration,
} from '@sport/shared/schemas/events';
import type { MyRegistrationItem } from '@sport/shared/schemas/registrations';
import type { Sport } from '@sport/shared/schemas/sports';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../shared/api/client';

/** Параметры ленты, как в адресе страницы и в запросе к API. */
export type FeedParams = {
  q?: string;
  sportId?: string;
  dateFrom?: string;
  dateTo?: string;
  joinMode?: 'free' | 'request';
  level?: 'any' | 'beginner' | 'amateur' | 'pro';
};

const PAGE_SIZE = 12;

/** '?a=1&b=2' без пустых значений. */
function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useSports(options: { withEvents?: boolean } = {}) {
  return useQuery({
    queryKey: ['sports', options],
    queryFn: () =>
      api<{ items: Sport[] }>(
        `/sports${toQuery({ withEvents: options.withEvents ? 'true' : undefined })}`,
      ),
    select: (data) => data.items,
    staleTime: 60_000,
  });
}

/** Лента с подгрузкой «Показать ещё». */
export function useFeed(params: FeedParams) {
  return useInfiniteQuery({
    queryKey: ['events', 'feed', params],
    queryFn: ({ pageParam }) =>
      api<ListResponse<EventListItem>>(
        `/events${toQuery({ ...params, limit: PAGE_SIZE, offset: pageParam })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    // Пока грузится новый фильтр, старый список остаётся на экране, а не мигает скелетоном.
    placeholderData: keepPreviousData,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['events', 'detail', id],
    queryFn: () => api<EventDetails>(`/events/${id}`),
  });
}

/** Ближайшие записи для блока «Мои записи» на главной. */
export function useMyRegistrations(enabled: boolean, limit = 3) {
  return useQuery({
    queryKey: ['registrations', 'mine', { limit }],
    queryFn: () =>
      api<ListResponse<MyRegistrationItem>>(`/registrations/mine${toQuery({ limit })}`),
    enabled,
  });
}

function useRegistrationMutation<TVariables>(
  request: (variables: TVariables) => Promise<NonNullable<MyRegistration>>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSettled: () => {
      // И при успехе, и при отказе (например, место заняли секундой раньше) данные устарели.
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['registrations'] });
    },
  });
}

export function useJoinEvent(eventId: string) {
  return useRegistrationMutation((message: string | null) =>
    api<NonNullable<MyRegistration>>(`/events/${eventId}/registration`, {
      method: 'POST',
      json: { message },
    }),
  );
}

export function useCancelRegistration(eventId: string) {
  return useRegistrationMutation(() =>
    api<NonNullable<MyRegistration>>(`/events/${eventId}/registration`, { method: 'DELETE' }),
  );
}

/** Создать событие; после успеха лента и «Мои мероприятия» перечитываются. */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EventInput) => api<EventDetails>('/events', { method: 'POST', json: body }),
    onSuccess: (event) => {
      queryClient.setQueryData(['events', 'detail', event.id], event);
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['sports'] });
    },
  });
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<EventInput>) =>
      api<EventDetails>(`/events/${eventId}`, { method: 'PATCH', json: body }),
    onSuccess: (event) => {
      queryClient.setQueryData(['events', 'detail', event.id], event);
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['sports'] });
    },
  });
}
