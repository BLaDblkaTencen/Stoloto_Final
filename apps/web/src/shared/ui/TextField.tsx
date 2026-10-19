// Однострочное поле: <TextField label="Email" type="email" value={…} onChange={…} error={fields.email} />.
import type { InputHTMLAttributes } from 'react';
import { controlClass, FieldShell, type FieldProps } from './Field';

type Props = InputHTMLAttributes<HTMLInputElement> & FieldProps;

export function TextField({ label, hint, error, id, className, ...props }: Props) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <input
          {...a11y}
          className={`min-h-[var(--control-height)] ${controlClass(error)}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}
