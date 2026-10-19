// Карточка организации: сведения для решения, одобрить или отклонить с причиной (задача 3.4).
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import { formatDate, formatDateTime } from '../../shared/format';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  SkeletonList,
  StatusBadge,
} from '../../shared/ui';
import { useAdminOrganization, useOrganizationDecision } from './api';
import { History } from './parts';
import { ReasonModal } from './ReasonModal';

export function OrganizationPage() {
  const { id = '' } = useParams();
  const org = useAdminOrganization(id);
  const { approve, reject } = useOrganizationDecision(id);
  const [rejecting, setRejecting] = useState(false);

  if (org.isPending) return <SkeletonList count={2} />;
  if (org.isError) return <ErrorState error={org.error} onRetry={() => org.refetch()} />;
  const data = org.data;

  const closeReject = () => {
    setRejecting(false);
    reject.reset();
  };

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/organizations" className="font-semibold">
        ← Все организации
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-h2">{data.name}</h2>
            <p className="text-ink-muted">
              {[data.activity, data.city].filter(Boolean).join(' · ')}
            </p>
          </div>
          <StatusBadge kind="organization" status={data.status} />
        </div>

        {data.status === 'rejected' && data.rejectionReason && (
          <Alert tone="warning">Причина отказа: {data.rejectionReason}</Alert>
        )}
        {approve.error && (
          <Alert>
            {approve.error instanceof ApiError
              ? approve.error.message
              : 'Не удалось одобрить заявку'}
          </Alert>
        )}

        <p className="whitespace-pre-line">{data.description}</p>

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Представитель</dt>
          <dd>
            {data.owner.name}, {data.owner.email}
          </dd>
          <dt className="font-semibold">Контакты</dt>
          <dd>{data.contacts || 'не указаны'}</dd>
          <dt className="font-semibold">Заявка подана</dt>
          <dd>{formatDateTime(data.createdAt)}</dd>
          {data.reviewedAt && (
            <>
              <dt className="font-semibold">Решение</dt>
              <dd>{formatDateTime(data.reviewedAt)}</dd>
            </>
          )}
          <dt className="font-semibold">Спортивные интересы</dt>
          <dd className="flex flex-wrap gap-2">
            {data.sports.length
              ? data.sports.map((s) => (
                  <Badge key={s.id} icon={null}>
                    {s.name}
                  </Badge>
                ))
              : 'не указаны'}
          </dd>
        </dl>

        <div className="flex flex-wrap gap-3">
          {data.status === 'pending' && (
            <>
              <Button loading={approve.isPending} onClick={() => approve.mutate()}>
                Одобрить
              </Button>
              <Button variant="danger" onClick={() => setRejecting(true)}>
                Отклонить
              </Button>
            </>
          )}
          {data.status === 'approved' && (
            <ButtonLink to={`/organizations/${data.id}`} variant="secondary">
              Публичная страница
            </ButtonLink>
          )}
        </div>
      </Card>

      {data.events.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">Мероприятия организации</h2>
          <ul className="flex flex-col gap-2">
            {data.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-line-soft bg-surface p-3"
              >
                <Link to={`/admin/events/${event.id}`} className="font-semibold">
                  {event.title}
                </Link>
                <span className="flex flex-wrap items-center gap-3">
                  {formatDate(event.startsAt)}
                  <StatusBadge kind="event" status={event.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <History entries={data.history} />

      <ReasonModal
        open={rejecting}
        onClose={closeReject}
        title="Отклонить заявку"
        hint="Её увидит организация и сможет исправить заявку"
        confirmLabel="Отклонить"
        pending={reject.isPending}
        error={reject.error}
        onSubmit={(reason) => reject.mutate(reason, { onSuccess: closeReject })}
      />
    </div>
  );
}
