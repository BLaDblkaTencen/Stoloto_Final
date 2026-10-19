// Запросы зоны «Пользователь»: виды спорта, мероприятия, запись, обсуждение, профиль.
// Контракт — docs/api/events.md. Ключи кэша начинаются с 'events' и 'registrations': после записи
// или отмены обновляем оба, чтобы лента, карточка и «Мои записи» сразу показывали новый статус.
import type { Comment, CommentBody } from '@sport/shared/schemas/comments';
import type {
  EventDetails,
  EventInput,
  EventListItem,
  ListResponse,
  MyEventItem,
  MyRegistration,
} from '@sport/shared/schemas/events';
import type { ProfileInput, UserProfile } from '@sport/shared/schemas/profiles';
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
import { meQueryKey } from '../auth/api';

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
    staleTime: 5 * 60_000,
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

export type Scope = 'upcoming' | 'past';

/** Мои записи: ближайшие для блока на главной или все на странице «Мои мероприятия». */
export function useMyRegistrations(enabled: boolean, limit = 3, scope: Scope = 'upcoming') {
  return useQuery({
    queryKey: ['registrations', 'mine', { limit, scope }],
    queryFn: () =>
      api<ListResponse<MyRegistrationItem>>(`/registrations/mine${toQuery({ limit, scope })}`),
    enabled,
  });
}

/** События, которые я организую, со счётчиком новых заявок. */
export function useMyEvents(enabled: boolean, scope: Scope = 'upcoming') {
  return useQuery({
    queryKey: ['events', 'mine', { scope }],
    queryFn: () => api<ListResponse<MyEventItem>>(`/events/mine${toQuery({ scope, limit: 50 })}`),
    enabled,
  });
}

/** Создание и правка события: после ответа сервера карточка уже в кэше, переход на неё мгновенный. */
export function useSaveEvent(id?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<EventInput>) =>
      api<EventDetails>(id ? `/events/${id}` : '/events', {
        method: id ? 'PATCH' : 'POST',
        json: body,
      }),
    onSuccess: (event) => {
      queryClient.setQueryData(['events', 'detail', event.id], event);
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      // Свой вид спорта мог появиться в каталоге.
      void queryClient.invalidateQueries({ queryKey: ['sports'] });
    },
  });
}

export function useComments(eventId: string) {
  return useQuery({
    queryKey: ['comments', eventId],
    queryFn: () => api<{ items: Comment[] }>(`/events/${eventId}/comments`),
    select: (data) => data.items,
  });
}

export function useAddComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CommentBody) =>
      api<Comment>(`/events/${eventId}/comments`, { method: 'POST', json: body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', eventId] }),
  });
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profiles', id],
    queryFn: () => api<UserProfile>(`/users/${id}`),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileInput) =>
      api<UserProfile>('/users/me', { method: 'PATCH', json: body }),
    onSuccess: (profile) => {
      queryClient.setQueryData(['profiles', profile.id], profile);
      // Имя в шапке берётся из /auth/me.
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
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
