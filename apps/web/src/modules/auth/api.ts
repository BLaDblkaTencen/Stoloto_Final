// Запросы входа и текущий пользователь. Владелец: участник 3.
// useMe() — кто вошёл; им пользуются все зоны (шапка, RequireAuth, кнопки «Записаться»).
import type { AuthResponse, LoginBody, RegisterBody } from '@sport/shared/schemas/auth';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { meQueryKey } from '../../shared/api/queryClient';

// Ключ общий с queryClient: тот сбрасывает вход по ответу 401.
export { meQueryKey };

/** Вошедший пользователь: data — AuthUser или null. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api<AuthResponse>('/auth/me'),
    select: (data) => data.user,
    staleTime: Infinity,
  });
}

// После смены пользователя данные прошлого (его записи, его события) в кэше не нужны.
function switchUser(queryClient: QueryClient, data: AuthResponse) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
  queryClient.setQueryData(meQueryKey, data);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginBody) =>
      api<AuthResponse>('/auth/login', { method: 'POST', json: body }),
    onSuccess: (data) => switchUser(queryClient, data),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterBody) =>
      api<AuthResponse>('/auth/register', { method: 'POST', json: body }),
    onSuccess: (data) => switchUser(queryClient, data),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => switchUser(queryClient, { user: null }),
  });
}

/**
 * Куда вернуть после входа: только путь внутри сайта. Иначе ссылка вида
 * /login?next=https://чужой-сайт увела бы пользователя после ввода пароля.
 */
export function safeNext(next: string | null) {
  // «//сайт» и «/\сайт» браузер понимает как адрес другого сайта: после первого «/» не должно
  // идти ни «/», ни «\».
  return next && /^\/(?![/\\])/.test(next) ? next : '/';
}
