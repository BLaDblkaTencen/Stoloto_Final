// Клиент API: все запросы к серверу идут через api(). Сессия живёт в HttpOnly-cookie,
// браузер отправляет её сам. Ошибки сервера превращаются в ApiError с текстом для пользователя.
import type { ApiErrorBody, ErrorCode } from '@sport/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ApiErrorBody['error']['details'];

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

type Options = Omit<RequestInit, 'body'> & { json?: unknown };

/** Запрос к /api/<path>. Пример: api<Event[]>('/events?sport=football'). */
export async function api<T>(path: string, { json, headers, ...init }: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: json === undefined ? headers : { 'content-type': 'application/json', ...headers },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    throw new ApiError(0, {
      code: 'INTERNAL',
      message: 'Нет связи с сервером. Проверьте интернет',
    });
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error ?? { code: 'INTERNAL', message: 'Что-то пошло не так. Попробуйте ещё раз' },
    );
  }
  return data as T;
}
