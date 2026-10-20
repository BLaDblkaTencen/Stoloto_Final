// Страница мероприятия (задача 1.5): всё для решения об участии — что, когда, где, условия,
// организатор, участники — и блок записи. Снятое событие видят только организатор и записавшиеся.
import { EVENT_LEVEL_LABELS } from '@sport/shared';
import type { EventDetails } from '@sport/shared/schemas/events';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Alert,
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  JoinModeBadge,
  Skeleton,
  SkeletonList,
  VenueCard,
} from '../../shared/ui';
import { PlaceMap, venueCardData } from '../org/map';
import { OrganizerPanel } from '../org/panel/OrganizerPanel';
import { useEvent } from './api';
import { MetaLine, OrganizerLink, SportTile } from './EventBits';
import { formatSeats, formatWhen, LOCAL_TIME_NOTE } from './format';
import { OrganizerRating } from './reviews/ReviewList';
import { Plate, SportSurface, surfaceFor } from './surface/SportSurface';
import { Discussion } from './Discussion';
import { JoinPanel } from './JoinPanel';

export function EventPage() {
  const { id = '' } = useParams();
  const event = useEvent(id);

  if (event.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-2/3" />
        <SkeletonList count={2} />
      </div>
    );
  }
  if (event.isError) {
    if (event.error instanceof ApiError && event.error.status === 404) {
      return (
        <EmptyState
          icon="eyeOff"
          title={event.error.message}
          text="Возможно, его сняли с публикации или ссылка неверная."
          action={<ButtonLink to="/">Все встречи</ButtonLink>}
        />
      );
    }
    return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  }
  return <EventView event={event.data} />;
}

function EventView({ event }: { event: EventDetails }) {
  return (
    <div className="flex flex-col gap-6">
      <Link to="/" className="tap-area self-start font-semibold">
        ← Все встречи
      </Link>

      {event.status !== 'published' && (
        <Alert tone="warning">
          Публикация недоступна: событие{' '}
          {event.status === 'deleted' ? 'удалено' : 'снято с публикации'} администратором.
          Записаться на него нельзя.
          {event.moderationReason && <> Причина: {event.moderationReason}</>}
        </Alert>
      )}

      {/* На телефоне: описание → запись → обсуждение; на широком экране запись справа на всю высоту.
          Организатору справа вместо записи и участников — панель организатора (участник 2): на
          телефоне она первой, чтобы до заявок не листать всё описание. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            {/* Шапка — покрытие вида спорта встречи: поле, паркет, бассейн, дорожка… */}
            <SportSurface
              kind={surfaceFor(event.sport.slug)}
              className="-mx-6 -mt-6 mb-1 flex min-h-40 flex-col justify-between gap-6 rounded-t-[22px] border-b-2 border-ink p-5"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <SportTile sport={event.sport} size={44} />
                <Plate className="font-semibold">{event.sport.name}</Plate>
                <JoinModeBadge mode={event.joinMode} />
                <Badge icon={null}>{EVENT_LEVEL_LABELS[event.level]}</Badge>
              </div>
              <h1 className="text-h2 leading-[1.35]">
                <Plate>{event.title}</Plate>
              </h1>
            </SportSurface>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Организатор: <OrganizerLink organizer={event.organizer} />
              </span>
              <OrganizerRating summary={event.organizerRating} />
            </p>
          </header>

          <section className="flex flex-col gap-2">
            <h2 className="text-h3">Когда и где</h2>
            <MetaLine icon="calendar">
              {formatWhen(event.startsAt, event.endsAt)}
              <span className="block">{LOCAL_TIME_NOTE}</span>
            </MetaLine>
            <MetaLine icon="pin">
              {event.address}
              {event.placeNotes && <span className="block">{event.placeNotes}</span>}
            </MetaLine>
            {/* «Место встречи» (1.10): площадка с контактом администратора и метка на карте. */}
            {event.venue && (
              <div className="mt-2">
                <VenueCard venue={venueCardData(event.venue)} />
              </div>
            )}
            {event.lat !== null && event.lng !== null && (
              <div className="mt-2">
                <PlaceMap
                  lat={event.lat}
                  lng={event.lng}
                  title={event.venue?.name ?? event.address}
                  venueType={event.venue?.type}
                  sportSlug={event.sport.slug}
                  joinMode={event.joinMode}
                />
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-h3">Что будет</h2>
            <p className="whitespace-pre-line">{event.description}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-h3">Условия участия</h2>
            <p>
              <span className="font-semibold">Уровень:</span> {EVENT_LEVEL_LABELS[event.level]}
            </p>
            <p className="whitespace-pre-line">
              {event.requirements ?? 'Особых требований нет: приходите в удобной одежде.'}
            </p>
          </section>
        </Card>

        {event.permissions.isOrganizer ? (
          <div className="flex flex-col gap-6 max-lg:order-first lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <OrganizerPanel event={event} />
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <JoinPanel event={event} />
            <Participants event={event} />
          </div>
        )}

        <div className="lg:col-start-1">
          <Discussion event={event} />
        </div>
      </div>
    </div>
  );
}

function Participants({ event }: { event: EventDetails }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-h3">Участники</h2>
      <MetaLine icon="people">{formatSeats(event.participantsCount, event.capacity)}</MetaLine>
      {event.participants === null ? (
        <p className="text-sm text-ink-muted">
          Имена видны организатору и подтверждённым участникам.
        </p>
      ) : event.participants.length === 0 ? (
        <p className="text-ink-muted">Пока никто не записался — будьте первым!</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {event.participants.map((person) => (
            <li key={person.id}>
              {/* Ссылка — вся строка с аватаром: нажать проще, чем на одно имя. */}
              <Link to={`/users/${person.id}`} className="flex min-h-11 items-center gap-3">
                <Avatar name={person.name} size={36} />
                {person.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
