// Ошибки API и их перевод в единый ответ { error: { code, message, details? } }.
// В сервисах бросаем AppError (или ZodError из parse) — обработчик ниже сам выберет код ответа.
import type { ApiErrorBody, ErrorCode } from '@sport/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { z } from 'zod';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
  }
}

export const errors = {
  validation: (message: string) => new AppError('VALIDATION_ERROR', message),
  unauthorized: (message = 'Войдите в аккаунт') => new AppError('UNAUTHORIZED', message),
  forbidden: (message = 'Недостаточно прав для этого действия') =>
    new AppError('FORBIDDEN', message),
  notFound: (message = 'Не найдено') => new AppError('NOT_FOUND', message),
  conflict: (message: string) => new AppError('CONFLICT', message),
};

/** Проверить входные данные Zod-схемой; при ошибке ответ 400 с перечнем полей. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

const body = (code: ErrorCode, message: string, details?: ApiErrorBody['error']['details']) =>
  ({ error: { code, message, ...(details ? { details } : {}) } }) satisfies ApiErrorBody;

export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send(body(err.code, err.message));
    }
    if (err instanceof z.ZodError) {
      const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return reply
        .status(400)
        .send(body('VALIDATION_ERROR', 'Проверьте заполнение полей', details));
    }
    const status = 'statusCode' in err ? (err.statusCode ?? 500) : 500;
    if (status === 429) {
      return reply
        .status(429)
        .send(body('RATE_LIMITED', 'Слишком много попыток. Подождите минуту и попробуйте снова'));
    }
    if (status === 400) {
      return reply.status(400).send(body('VALIDATION_ERROR', 'Некорректный запрос'));
    }
    if (status === 404) return reply.status(404).send(body('NOT_FOUND', 'Не найдено'));
    request.log.error(err);
    return reply.status(500).send(body('INTERNAL', 'Что-то пошло не так. Попробуйте ещё раз'));
  });
}
