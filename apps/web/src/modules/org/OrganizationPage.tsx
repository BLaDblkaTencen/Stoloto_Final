// Публичная страница организации (задача 2.5): описание, интересы, контакты, её мероприятия.
// Чужая недопущенная организация — 404; владелец и админ видят страницу с предупреждением.
import type { EventListItem } from '@sport/shared/schemas/events';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Alert,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  JoinModeBadge,
  SkeletonList,
  StatusBadge,
} from '../../shared/ui';
import { OrganizationReviewsSection } from '../user/reviews/ReviewList';
import { useOrganization, useOrganizationEvents } from './api';
import { SportTag } from './SportTag';

const dateFormat = new Intl.DateTimeFormat('ru', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function OrganizationPage() {
  const { id = '' } = useParams();
  const org = useOrganization(id);
  const isPublic = org.data ? org.data.view === 'public' || org.data.status === 'approved' : false;
  const events = useOrganizationEvents(id, isPublic);

  if (org.isPending) return <SkeletonList count={2} />;
  if (org.isError) {
    if (org.error instanceof ApiError && org.error.status === 404) {
      return (
        <EmptyState
          icon="people"
          title="Организация не найдена"
          text="Возможно, её страница ещё не одобрена администратором"
          action={
            <ButtonLink to="/organizations" variant="secondary">
              Все организации
            </ButtonLink>
          }
        />
      );
    }
    return <ErrorState error={org.error} onRetry={() => org.refetch()} />;
  }

  const data = org.data;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {data.view === 'owner' && data.status !== 'approved' && (
        <Alert tone="warning">
          Страницу видите только вы и администратор: она откроется для всех после допуска.
        </Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h2">{data.name}</h1>
          {data.view === 'owner' && <StatusBadge kind="organization" status={data.status} />}
        </div>
        <p className="text-ink-muted">{[data.activity, data.city].filter(Boolean).join(' · ')}</p>
        <p className="whitespace-pre-line">{data.description}</p>
        <div className="flex flex-wrap gap-2">
          {data.sports.map((sport) => (
            <SportTag key={sport.id} sport={sport} />
          ))}
        </div>
        {data.contacts && (
          <p className="break-words">
            <span className="font-semibold">Контакты: </span>
            {data.contacts}
          </p>
        )}
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-h3">Ближайшие встречи</h2>
        {!isPublic ? (
          <p className="text-ink-muted">События появятся после допуска организации.</p>
        ) : events.isPending ? (
          <SkeletonList count={2} />
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : events.data.items.length === 0 ? (
          <EmptyState title="Пока нет встреч" text="Загляните позже — организация их добавит" />
        ) : (
          <ul className="flex flex-col gap-3">
            {events.data.items.map((event) => (
              <li key={event.id}>
                <EventRow event={event} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Отзывы участников о встречах клуба (модуль отзывов участника 1). */}
      {isPublic && <OrganizationReviewsSection orgId={data.id} />}
    </div>
  );
}

function EventRow({ event }: { event: EventListItem }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SportTag sport={event.sport} />
        <JoinModeBadge mode={event.joinMode} />
      </div>
      <h3 className="text-h3">
        <Link to={`/events/${event.id}`}>{event.title}</Link>
      </h3>
      <p className="flex items-center gap-2">
        <Icon name="calendar" size={18} />
        {dateFormat.format(new Date(event.startsAt))}
      </p>
      <p className="flex items-center gap-2">
        <Icon name="pin" size={18} />
        {event.address}
      </p>
      <p className="flex items-center gap-2">
        <Icon name="people" size={18} />
        {event.capacity === null
          ? `Участников: ${event.participantsCount}`
          : `Участников: ${event.participantsCount} из ${event.capacity}`}
      </p>
    </Card>
  );
}
