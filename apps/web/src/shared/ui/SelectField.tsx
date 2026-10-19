// Поле-список с подписью, подсказкой и ошибкой. Раскрытый список — свой (Listbox), в стиле сайта:
// системный <select> браузер раскрывает по-своему, и его не оформить.
// onChange получает { target: { value } }, как от <select>: вызовы вида e.target.value не меняются.
import { useState } from 'react';
import { controlClass, FieldShell, type FieldProps } from './Field';
import { Listbox } from './Listbox';

type Option = { value: string; label: string };

type Props = FieldProps & {
  id?: string;
  className?: string;
  options: readonly Option[];
  /** Пустой первый пункт, пока ничего не выбрано: «Выберите вид спорта». */
  placeholder?: string;
  /** Без value поле хранит выбор само (витрина /ui). */
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
};

export function SelectField({
  label,
  hint,
  error,
  id,
  className,
  options,
  placeholder,
  value,
  defaultValue = '',
  disabled,
  onChange,
}: Props) {
  const [own, setOwn] = useState(defaultValue);
  const all = placeholder !== undefined ? [{ value: '', label: placeholder }, ...options] : options;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <Listbox
          id={a11y.id}
          aria-labelledby={`${a11y.id}-label`}
          aria-describedby={a11y['aria-describedby']}
          invalid={Boolean(a11y['aria-invalid'])}
          value={value ?? own}
          options={all}
          disabled={disabled}
          onChange={(next) => {
            setOwn(next);
            onChange?.({ target: { value: next } });
          }}
          triggerClassName={`min-h-[var(--control-height)] ${controlClass(error)}`}
        />
      )}
    </FieldShell>
  );
}
