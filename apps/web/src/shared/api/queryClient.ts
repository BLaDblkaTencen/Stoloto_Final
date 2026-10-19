import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/** Ключ «кто вошёл» (useMe в modules/auth). Здесь — чтобы сбросить вход по ответу 401. */
export const meQueryKey = ['auth', 'me'] as const;

// Сессия истекла или удалена, а интерфейс ещё думает, что человек вошёл: любой ответ
// 401 UNAUTHORIZED сбрасывает вход, и шапка с RequireAuth сразу ведут на экран входа.
// Неверный пароль — другой код (INVALID_CREDENTIALS), его не трогаем.
const onError = (error: unknown) => {
  if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
    queryClient.setQueryData(meQueryKey, { user: null });
  }
};

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Ошибки 4xx (нет прав, не найдено) повтором не исправить; сетевые и 5xx — пробуем ещё раз.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});
