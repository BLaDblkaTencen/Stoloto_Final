// Список мероприятий для модерации: все статусы, поиск по названию и организатору (задача 3.5).
import type { EventStatus } from '@sport/shared';
import { Link } from 'react-router';
import { formatDateTime } from '../../shared/format';
import { EmptyState, ErrorState, JoinModeBadge, SkeletonList, StatusBadge } from '../../shared/ui';
import { useAdminEvents } from './api';
import { PAGE_SIZE, Pager, SearchForm, StatusFilter, useListParams } from './parts';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'published', label: 'Опубликованные' },
  { value: 'unpublished', label: 'Снятые' },
  { value: 'deleted', label: 'Удалённые' },
];

export function EventsPage() {
  const { status, q, page, update } = useListParams('all');
  const list = useAdminEvents({
    status: status === 'all' ? undefined : (status as EventStatus),
    q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-5">
      <StatusFilter
        label="Статус мероприятия"
        options={STATUS_OPTIONS}
        value={status}
        onChange={(s) => update({ status: s })}
      />
      <SearchForm
        label="Название, организатор или организация"
        value={q}
        onSearch={(text) => update({ q: text })}
      />

      {list.isPending ? (
        <SkeletonList count={4} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon="calendar" title="Ничего не найдено" text="Измените фильтр или запрос" />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((event) => (
            <li key={event.id}>
              <Link
                to={`/admin/events/${event.id}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border-2 border-ink bg-surface p-5 no-underline shadow-sm hover:text-ink hover:shadow-md"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-h3 font-display font-bold">{event.title}</span>
                  <span className="text-ink-muted">
                    {event.sport.name} · {formatDateTime(event.startsAt)}
                  </span>
                  <span>
                    {event.organizer.type === 'organization' ? 'Организация' : 'Организатор'}:{' '}
                    {event.organizer.name}
                  </span>
                  <span className="text-sm">
                    Участников: {event.participantsCount} · Сообщений: {event.commentsCount}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <JoinModeBadge mode={event.joinMode} />
                  <StatusBadge kind="event" status={event.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {list.data && (
        <Pager page={page} total={list.data.total} onPage={(p) => update({ page: String(p) })} />
      )}
    </div>
  );
}
