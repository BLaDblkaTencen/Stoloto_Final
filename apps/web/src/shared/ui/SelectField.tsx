// Выпадающий список на основе системного <select>: удобен на телефоне и для экранного диктора.
import type { SelectHTMLAttributes } from 'react';
import { controlClass, FieldShell, type FieldProps } from './Field';
import { Icon } from './Icon';

type Option = { value: string; label: string };

type Props = SelectHTMLAttributes<HTMLSelectElement> &
  FieldProps & {
    options: readonly Option[];
    /** Пустой первый пункт, пока ничего не выбрано: «Выберите вид спорта». */
    placeholder?: string;
  };

export function SelectField({
  label,
  hint,
  error,
  id,
  className,
  options,
  placeholder,
  ...props
}: Props) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <div className="relative">
          <select
            {...a11y}
            className={`min-h-[var(--control-height)] cursor-pointer appearance-none pr-11 ${controlClass(error)}`}
            {...props}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
            <Icon name="chevronDown" size={18} strokeWidth={2.6} />
          </span>
        </div>
      )}
    </FieldShell>
  );
}
