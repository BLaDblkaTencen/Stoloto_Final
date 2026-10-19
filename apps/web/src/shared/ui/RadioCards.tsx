// Выбор одного варианта крупными карточками: тип аккаунта, режим записи, уровень.
// Внутри — обычные radio-кнопки: работают стрелки клавиатуры и экранный диктор.
import { useId } from 'react';
import { FieldError } from './FieldError';

type Option<T extends string> = { value: T; title: string; text?: string };

type Props<T extends string> = {
  legend: string;
  options: readonly Option<T>[];
  value: T | '';
  onChange: (value: T) => void;
  error?: string;
  /** Варианты в строку на широком экране (для двух-трёх коротких вариантов). */
  inline?: boolean;
};

export function RadioCards<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  inline = false,
}: Props<T>) {
  const name = useId();
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-3">
      <legend className="mb-1.5 font-semibold">{legend}</legend>
      <div
        className={inline ? 'grid gap-3 sm:grid-flow-col sm:auto-cols-fr' : 'flex flex-col gap-3'}
      >
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-md border-2 p-4',
                checked ? 'border-ink bg-accent shadow-sm' : 'bg-surface',
                error && !checked ? 'border-danger' : 'border-ink',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="mt-1 size-5 shrink-0 accent-ink"
              />
              <span>
                <span className="block font-semibold">{option.title}</span>
                {option.text && <span className="text-sm text-ink-muted">{option.text}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}
