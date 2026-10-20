// «Мои мероприятия» (задача 1.7): куда я записан, со статусами и пояснениями, и что организую,
// со счётчиком новых заявок. Снятые события тоже здесь: человек видит «Публикация недоступна».
// Вкладка и период — в адресе страницы, чтобы «Назад» из карточки события возвращал туда же.
// В «Прошедших» здесь же оценивают встречу и отмечают участников (окна из reviews/).
import type { EventListItem, MyEventItem } from '@sport/shared/schemas/events';
import type { MyRegistrationItem } from '@sport/shared/schemas/registrations';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Badge,
  Button,
  ButtonLink,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  SkeletonList,
  StatusBadge,
} from '../../shared/ui';
import { RequireAuth } from '../auth/RequireAuth';
import { useMe } from '../auth/api';
import { useMyEvents, useMyRegistrations, type Scope } from './api';
import { MetaLine, SportTile } from './EventBits';
import { MISSED_LABEL, MISSED_TEXT } from './JoinPanel';
import { formatSeats, formatWhen, LOCAL_TIME_NOTE, plural } from './format';
import { AttendanceModal } from './reviews/AttendanceModal';
import { ReviewModal } from './reviews/ReviewModal';
import { Stars } from './reviews/Stars';

type Tab = 'join' | 'organize';

/** Пояснение к статусу записи: что происходит и чего ждать. */
const REGISTRATION_HINT = {
  confirmed: null,
  pending: 'Организатор ещё не ответил на заявку',
  rejected: 'Организатор отклонил заявку',
  cancelled: 'Вы отменили запись',
} as const;

export function MyEventsRoute() {
  return (
    <RequireAuth roles={['user', 'organization']}>
      <MyEventsPage />
    </RequireAuth>
  );
}

function MyEventsPage() {
  const me = useMe();
  const isParticipant = me.data?.role === 'user';
  const [search, setSearch] = useSearchParams();
  // У организации записей нет: только то, что она организует.
  const tab: Tab = isParticipant && search.get('tab') !== 'organize' ? 'join' : 'organize';
  const scope: Scope = search.get('scope') === 'past' ? 'past' : 'upcoming';

  const setParam = (key: string, value: string | null) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 mb-2">Мои мероприятия</h1>
          <p className="text-ink-muted">{LOCAL_TIME_NOTE}</p>
        </div>
        <ButtonLink to="/events/new">
          <Icon name="plus" />
          Создать встречу
        </ButtonLink>
      </div>

      <div className="flex flex-wrap gap-6">
        {isParticipant && (
          <div role="group" aria-label="Чьи мероприятия" className="flex flex-wrap gap-2.5">
            <Chip pressed={tab === 'join'} icon="people" onClick={() => setParam('tab', null)}>
              Я участвую
            </Chip>
            <Chip
              pressed={tab === 'organize'}
              icon="calendar"
              index={1}
              onClick={() => setParam('tab', 'organize')}
            >
              Я организую
            </Chip>
          </div>
        )}
        <div role="group" aria-label="Период" className="flex flex-wrap gap-2.5">
          <Chip pressed={scope === 'upcoming'} index={2} onClick={() => setParam('scope', null)}>
            Предстоящие
          </Chip>
          <Chip pressed={scope === 'past'} index={3} onClick={() => setParam('scope', 'past')}>
            Прошедшие
          </Chip>
        </div>
      </div>

      {tab === 'join' ? <Joined scope={scope} /> : <Organized scope={scope} />}
    </div>
  );
}

function Joined({ scope }: { scope: Scope }) {
  const list = useMyRegistrations(true, 50, scope);
  if (list.isPending) return <SkeletonList count={3} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  if (list.data.items.length === 0) {
    return (
      <EmptyState
        title={scope === 'past' ? 'Прошедших встреч нет' : 'Вы пока никуда не записаны'}
        text="Найдите встречу в ленте и запишитесь — она появится здесь со статусом."
        action={<ButtonLink to="/">Найти встречу</ButtonLink>}
      />
    );
  }
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {list.data.items.map((item) => {
        // Заявка, на которую не ответили до начала: «ждёт решения» у прошедшей встречи — неправда.
        const missed = scope === 'past' && item.myRegistration.status === 'pending';
        const hint = missed ? MISSED_TEXT : REGISTRATION_HINT[item.myRegistration.status];
        return (
          <EventRow key={item.id} event={item}>
            {item.status !== 'published' ? (
              <StatusBadge kind="event" status={item.status} />
            ) : missed ? (
              <Badge tone="neutral" icon="clock">
                {MISSED_LABEL}
              </Badge>
            ) : (
              <StatusBadge kind="registration" status={item.myRegistration.status} />
            )}
            <span className="text-sm text-ink-muted">
              {item.status !== 'published'
                ? `Публикация недоступна${item.moderationReason ? `: ${item.moderationReason}` : ''}`
                : hint}
            </span>
            {item.review && <ReviewAction item={item} />}
          </EventRow>
        );
      })}
    </ul>
  );
}

function Organized({ scope }: { scope: Scope }) {
  const list = useMyEvents(true, scope);
  if (list.isPending) return <SkeletonList count={3} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  if (list.data.items.length === 0) {
    return (
      <EmptyState
        title={scope === 'past' ? 'Прошедших встреч нет' : 'Вы пока ничего не организуете'}
        text="Создайте встречу: выберите вид спорта, время и место на карте."
        action={<ButtonLink to="/events/new">Создать встречу</ButtonLink>}
      />
    );
  }
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {list.data.items.map((item) => (
        <EventRow key={item.id} event={item}>
          {/* У прошедшей «Опубликовано» ничего не говорит. Снятое оставляем как есть: это причина. */}
          {scope === 'past' && item.status === 'published' ? (
            <Badge tone="neutral" icon="clock">
              Прошло
            </Badge>
          ) : (
            <StatusBadge kind="event" status={item.status} />
          )}
          {scope === 'upcoming' && item.registrationClosed && (
            <Badge tone="neutral" icon="lock">
              Запись закрыта
            </Badge>
          )}
          {item.pendingCount > 0 &&
            (scope === 'past' ? (
              <Badge tone="neutral" icon="clock">
                {plural(item.pendingCount, [
                  'заявка без ответа',
                  'заявки без ответа',
                  'заявок без ответа',
                ])}
              </Badge>
            ) : (
              <Badge tone="warning">
                {plural(item.pendingCount, ['новая заявка', 'новые заявки', 'новых заявок'])}
              </Badge>
            ))}
          {item.status !== 'published' && item.moderationReason && (
            <span className="text-sm text-ink-muted">Причина: {item.moderationReason}</span>
          )}
          {item.attendance && <AttendanceAction item={item} />}
        </EventRow>
      ))}
    </ul>
  );
}

/** Отзыв о прошедшей встрече: «Оценить», «Изменить» или уже оставленные звёзды. */
function ReviewAction({ item }: { item: MyRegistrationItem }) {
  const [open, setOpen] = useState(false);
  const review = item.review!;
  return (
    <>
      {review.mine ? (
        <Badge tone="success">
          Отзыв оставлен <Stars rating={review.mine.rating} size={16} />
        </Badge>
      ) : (
        !review.open && <span className="text-sm text-ink-muted">Время для отзыва вышло</span>
      )}
      {review.open && (
        <Button variant={review.mine ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
          {review.mine ? 'Изменить отзыв' : 'Оценить встречу'}
        </Button>
      )}
      <ReviewModal event={item} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Отметки организатора: кто пришёл на прошедшую встречу. */
function AttendanceAction({ item }: { item: MyEventItem }) {
  const [open, setOpen] = useState(false);
  const attendance = item.attendance!;
  if (item.participantsCount === 0) return null;
  return (
    <>
      {attendance.marked && <Badge tone="success">Участники отмечены</Badge>}
      {attendance.open ? (
        <Button variant={attendance.marked ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
          {attendance.marked ? 'Изменить отметки' : 'Отметить участников'}
        </Button>
      ) : (
        !attendance.marked && (
          <span className="text-sm text-ink-muted">Время для отметок вышло</span>
        )
      )}
      <AttendanceModal event={item} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function EventRow({ event, children }: { event: EventListItem; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-lg border-2 border-ink bg-surface p-4 shadow-sm">
      <SportTile sport={event.sport} size={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link to={`/events/${event.id}`} className="text-[19px] font-semibold leading-snug">
          {event.title}
        </Link>
        <MetaLine icon="calendar">{formatWhen(event.startsAt, event.endsAt)}</MetaLine>
        <MetaLine icon="pin">{event.address}</MetaLine>
        <MetaLine icon="people">{formatSeats(event.participantsCount, event.capacity)}</MetaLine>
        <div className="mt-1 flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </li>
  );
}
