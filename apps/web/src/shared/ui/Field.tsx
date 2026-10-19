// Общая обвязка полей формы: подпись, подсказка, ошибка и их связь с полем для экранного диктора
// (aria-describedby, aria-invalid). TextField, SelectField и TextareaField отличаются только
// самим элементом ввода.
import { useId, type ReactNode } from 'react';
import { FieldError } from './FieldError';

export type FieldProps = { label: string; hint?: string; error?: string };

/** Атрибуты, которые нужно передать самому элементу ввода. */
export type ControlA11y = {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

export function FieldShell({
  id,
  label,
  hint,
  error,
  className = '',
  children,
}: FieldProps & { id?: string; className?: string; children: (a11y: ControlA11y) => ReactNode }) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={controlId} className="font-semibold">
        {label}
      </label>
      {children({
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

/** Внешний вид поля ввода: обводка, высота не меньше 48px, красная обводка при ошибке. */
export const controlClass = (error?: string) =>
  [
    'w-full rounded-md border-2 bg-surface px-4 text-base placeholder:text-ink-muted',
    'disabled:cursor-not-allowed disabled:bg-surface-muted',
    error ? 'border-danger' : 'border-ink',
  ].join(' ');
