// Текст ошибки под полем: красный цвет плюс значок, чтобы состояние не передавалось одним цветом.
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
      <Icon name="alert" size={18} strokeWidth={2.6} className="mt-0.5" />
      {children}
    </p>
  );
}
