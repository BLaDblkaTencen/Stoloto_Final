// Многострочное поле: описание события, условия участия, комментарий.
import type { TextareaHTMLAttributes } from 'react';
import { controlClass, FieldShell, type FieldProps } from './Field';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps;

export function TextareaField({ label, hint, error, id, className, rows = 4, ...props }: Props) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <textarea
          {...a11y}
          rows={rows}
          className={`min-h-[var(--control-height)] py-3 leading-normal ${controlClass(error)}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}
