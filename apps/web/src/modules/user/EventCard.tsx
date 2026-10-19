// Карточка мероприятия в ленте: всё, чтобы решить, открывать ли подробности.
// Записываться — на странице события: там человек читает условия (сценарий 3 ТЗ).
import { EVENT_LEVEL_LABELS } from '@sport/shared';
import type { EventListItem } from '@sport/shared/schemas/events';
import { Link } from 'react-router';
import { ButtonLink, JoinModeBadge, StatusBadge } from '../../shared/ui';
import { MetaLine, OrganizerLink, SportTile } from './EventBits';
import { formatSeats, formatWhen } from './format';

export function EventCard({ event }: { event: EventListItem }) {
  const href = `/events/${event.id}`;
  return (
    <article className="flex gap-4 rounded-lg border-2 border-ink bg-surface p-4 shadow-sm">
      <SportTile sport={event.sport} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-[19px] leading-snug">
            <Link to={href} className="no-underline hover:underline">
              {event.title}
            </Link>
          </h3>
          <JoinModeBadge mode={event.joinMode} />
        </div>
        <p className="text-sm font-semibold">
          {event.sport.name} · {EVENT_LEVEL_LABELS[event.level]}
        </p>
        <MetaLine icon="calendar">{formatWhen(event.startsAt, event.endsAt)}</MetaLine>
        <MetaLine icon="pin">{event.address}</MetaLine>
        <MetaLine icon="people">{formatSeats(event.participantsCount, event.capacity)}</MetaLine>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm">
            Организатор: <OrganizerLink organizer={event.organizer} />
          </span>
          {event.myRegistration ? (
            <StatusBadge kind="registration" status={event.myRegistration.status} />
          ) : (
            <ButtonLink to={href} variant="secondary" aria-label={`Подробнее: ${event.title}`}>
              Подробнее
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  );
}
