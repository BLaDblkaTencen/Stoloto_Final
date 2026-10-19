// Разбор ошибки запроса для формы: общий текст над формой и ошибки по полям.
import { ApiError } from '../../shared/api/client';

export function formErrors(error: unknown, fallback: string) {
  if (!error) return { message: null, fields: {} };
  if (error instanceof ApiError) {
    // Если сервер указал поля, текст уже стоит под ними; общий текст только дублировал бы его.
    const hasFields = Object.keys(error.fields).length > 0;
    return { message: hasFields ? null : error.message, fields: error.fields };
  }
  return { message: fallback, fields: {} };
}
