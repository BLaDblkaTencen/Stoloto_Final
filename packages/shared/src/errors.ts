// Единый формат ошибок API: { error: { code, message, fields? } }.
// message — готовый текст для человека на русском. code — для логики интерфейса: общий из
// COMMON_ERROR_CODES или свой код модуля (ORG_NOT_APPROVED, INVALID_BBOX и т.п.).
// fields — только для 422: какое поле формы и что в нём не так.
import type { z } from 'zod';

export const COMMON_ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type CommonErrorCode = keyof typeof COMMON_ERROR_CODES;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    /** Ошибки по полям формы: { title: 'Слишком короткое название' }. */
    fields?: Record<string, string>;
  };
};

/**
 * Ошибки Zod по полям: { 'address.city': 'Обязательное поле' }, первая ошибка каждого поля.
 * Сервер так формирует fields для 422, форма — подсвечивает поля до отправки теми же текстами.
 */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    fields[path] ??= issue.message;
  }
  return fields;
}
