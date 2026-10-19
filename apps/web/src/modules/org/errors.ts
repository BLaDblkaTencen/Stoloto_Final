// Разбор ошибки запроса для формы: общий текст над формой и ошибки по полям.
import { useState } from 'react';
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

/**
 * Ошибка поля пропадает, как только человек начал его править, и проверяется заново при
 * следующей отправке: иначе под исправленным полем висит устаревшее «Укажите название».
 */
export function useFreshErrors(fields: Record<string, string>) {
  const [edited, setEdited] = useState<ReadonlySet<string>>(() => new Set());
  const visible = Object.keys(fields).filter((key) => !edited.has(key));
  return {
    /** Первая ошибка из перечисленных полей, если их ещё не правили. */
    errorOf: (...keys: string[]) =>
      keys.map((key) => (edited.has(key) ? undefined : fields[key])).find(Boolean),
    /** Есть ли на экране хоть одна ошибка поля. */
    hasErrors: visible.length > 0,
    /** Поле правят: его ошибку больше не показываем. */
    edit: (...keys: string[]) =>
      setEdited((prev) =>
        keys.every((key) => prev.has(key)) ? prev : new Set([...prev, ...keys]),
      ),
    /** Отправка формы: показываем ошибки новой проверки. */
    reset: () => setEdited(new Set()),
  };
}
