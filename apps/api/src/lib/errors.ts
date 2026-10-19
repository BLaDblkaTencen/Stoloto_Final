// Ошибки API и их перевод в единый ответ { error: { code, message, fields? } }.
// В сервисах бросаем AppError (свой код модуля) или errors.* (общие случаи); ZodError из parse()
// превращается в 422 с ошибками по полям. Формат описан в docs/api.md.
import { zodFieldErrors, type ApiErrorBody } from '@sport/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { z } from 'zod';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

export const errors = {
  badRequest: (message = 'Некорректный запрос') => new AppError(400, 'BAD_REQUEST', message),
  unauthorized: (message = 'Войдите в аккаунт') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Недостаточно прав для этого действия') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Не найдено') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  validation: (fields: Record<string, string>, message = 'Проверьте заполнение полей') =>
    new AppError(422, 'VALIDATION_ERROR', message, fields),
};

/** Проверить входные данные Zod-схемой; при ошибке — ответ 422 с ошибками по полям. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send(err.toBody());
    }
    if (err instanceof z.ZodError) {
      return reply.status(422).send(errors.validation(zodFieldErrors(err)).toBody());
    }
    const status = 'statusCode' in err ? (err.statusCode ?? 500) : 500;
    if (status === 429) {
      const error = new AppError(
        429,
        'RATE_LIMITED',
        'Слишком много попыток. Подождите минуту и попробуйте снова',
      );
      return reply.status(429).send(error.toBody());
    }
    // Ошибки самого Fastify: битый JSON, слишком большое тело и т.п.
    if (status >= 400 && status < 500) {
      return reply.status(400).send(errors.badRequest().toBody());
    }
    request.log.error(err);
    const error = new AppError(500, 'INTERNAL', 'Что-то пошло не так. Попробуйте ещё раз');
    return reply.status(500).send(error.toBody());
  });
}
