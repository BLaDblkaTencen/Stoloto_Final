// Единый формат ошибок API: { error: { code, message, details? } }.
// message — готовый текст для пользователя на русском, code — для логики интерфейса.

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    /** Для VALIDATION_ERROR: какие поля и почему не прошли проверку. */
    details?: { path: string; message: string }[];
  };
};
