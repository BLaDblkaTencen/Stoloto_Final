// Ошибка предметной области: код, HTTP-статус и русский текст для человека.
// Формат ответа — { error: { code, message, fields? } }, см. docs/api/organizations.md.
// Временная заглушка до общего модуля ошибок каркаса (запрос участнику 3 в docs/REQUESTS.md):
// после его появления заменить импорты, сигнатура конструктора должна остаться той же.
export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'DomainError';
  }

  toBody(): { error: { code: string; message: string; fields?: Record<string, string> } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}
