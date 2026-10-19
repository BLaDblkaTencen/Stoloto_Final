// Поле ввода с подписью, подсказкой и ошибкой. Ошибка связана с полем через aria-describedby,
// поэтому экранный диктор зачитывает её вместе с подписью.
import { useId, type InputHTMLAttributes } from 'react';
import { FieldError } from './FieldError';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, id, className = '', ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'min-h-[var(--control-height)] w-full rounded-md border-2 bg-surface px-4 text-base',
          'placeholder:text-ink-muted',
          error ? 'border-danger' : 'border-ink',
        ].join(' ')}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
