// Разбор ошибок PostgreSQL, которые сервис превращает в понятный ответ (409 вместо 500).

/** Имя нарушенного уникального ограничения или null, если ошибка другая. */
export function uniqueViolation(err: unknown): string | null {
  // Drizzle оборачивает ошибку драйвера: исходная лежит в cause.
  const cause = err instanceof Error && 'cause' in err ? err.cause : err;
  if (typeof cause !== 'object' || cause === null) return null;
  const { code, constraint_name: constraint } = cause as {
    code?: string;
    constraint_name?: string;
  };
  return code === '23505' ? (constraint ?? '') : null;
}

/** Идентификатор из адреса: не UUID — значит такого объекта нет (404, а не 500 от базы). */
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
