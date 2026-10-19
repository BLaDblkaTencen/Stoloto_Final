// Состояния блока с данными: пусто, загрузка, ошибка. В дизайне — скелетоны, а не спиннеры.
//
//   if (query.isPending) return <SkeletonList count={3} />;
//   if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
//   if (!query.data.items.length) return <EmptyState title="Пока нет событий" … />;
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon = 'calendar',
  title,
  text,
  action,
}: {
  icon?: IconName;
  title: string;
  text?: string;
  /** Что сделать дальше: обычно кнопка «Создать встречу» или «Сбросить фильтры». */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-soft bg-surface px-6 py-10 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full border-2 border-ink bg-accent">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="text-h3">{title}</h3>
      {text && <p className="max-w-md text-ink-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Не удалось загрузить данные. Попробуйте ещё раз';
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border-2 border-ink bg-status-danger px-6 py-8 text-center"
    >
      <Icon name="alert" size={30} />
      <p className="font-semibold">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}

/** Серый блок-заглушка на месте загружаемого содержимого. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-status-neutral motion-reduce:animate-none ${className}`}
    />
  );
}

/** Заглушка списка карточек, пока идёт загрузка. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-lg border-2 border-line-soft bg-surface p-5">
          <Skeleton className="size-16 shrink-0" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
