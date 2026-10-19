// Список организаций: по умолчанию — заявки на рассмотрении (задача 3.4).
import type { OrgStatus } from '@sport/shared';
import { Link } from 'react-router';
import { formatDate } from '../../shared/format';
import { EmptyState, ErrorState, SkeletonList, StatusBadge } from '../../shared/ui';
import { useAdminOrganizations } from './api';
import { PAGE_SIZE, Pager, SearchForm, StatusFilter, useListParams } from './parts';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'На рассмотрении' },
  { value: 'approved', label: 'Допущены' },
  { value: 'rejected', label: 'Отклонены' },
  { value: 'all', label: 'Все' },
];

export function OrganizationsPage() {
  const { status, q, page, update } = useListParams('pending');
  const list = useAdminOrganizations({
    status: status === 'all' ? undefined : (status as OrgStatus),
    q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-5">
      <StatusFilter
        label="Статус заявки"
        options={STATUS_OPTIONS}
        value={status}
        onChange={(s) => update({ status: s })}
      />
      <SearchForm
        label="Название, имя или email представителя"
        value={q}
        onSearch={(text) => update({ q: text })}
      />

      {list.isPending ? (
        <SkeletonList count={3} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon="people"
          title={status === 'pending' && !q ? 'Новых заявок нет' : 'Ничего не найдено'}
          text={
            status === 'pending' && !q
              ? 'Когда организация подаст заявку, она появится здесь'
              : 'Измените фильтр или запрос'
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((org) => (
            <li key={org.id}>
              <Link
                to={`/admin/organizations/${org.id}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border-2 border-ink bg-surface p-5 no-underline shadow-sm hover:text-ink hover:shadow-md"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-h3 font-display font-bold">{org.name}</span>
                  <span className="text-ink-muted">
                    {[org.activity, org.city].filter(Boolean).join(' · ')} · подана{' '}
                    {formatDate(org.createdAt)}
                  </span>
                  <span>
                    {org.owner.name}, {org.owner.email}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge kind="organization" status={org.status} />
                  {org.eventsCount > 0 && (
                    <span className="text-sm">Мероприятий: {org.eventsCount}</span>
                  )}
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
