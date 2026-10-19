// Сообщение над формой или блоком: ошибка запроса, предупреждение, успех.
// role="alert" — экранный диктор зачитывает сообщение, как только оно появилось.
import type { ReactNode } from 'react';

type Tone = 'danger' | 'warning' | 'success';

const TONES: Record<Tone, { className: string; icon: ReactNode }> = {
  danger: {
    className: 'bg-status-danger',
    icon: <path d="M7 7l10 10M17 7L7 17" />,
  },
  warning: {
    className: 'bg-status-warning',
    icon: <path d="M12 7v6M12 16.5v.01" />,
  },
  success: {
    className: 'bg-status-success',
    icon: <path d="M5 12l5 5L20 7" />,
  },
};

export function Alert({ tone = 'danger', children }: { tone?: Tone; children: ReactNode }) {
  const { className, icon } = TONES[tone];
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-md border-2 border-ink p-4 font-semibold ${className}`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        {icon}
      </svg>
      <div>{children}</div>
    </div>
  );
}
