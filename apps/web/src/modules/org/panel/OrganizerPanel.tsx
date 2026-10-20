// Панель организатора (задача 2.7, сценарии 3 и 4 ТЗ): входящие заявки, участники, решения.
// Работает и для участника-организатора, и для организации. Видна только автору события
// (permissions.isOrganizer): в карточке события участника 1 она стоит в правой колонке
// вместо карточки «Участники» — участники здесь же, в списке по статусам (макет П3).
//
//   {event.permissions.isOrganizer ? <OrganizerPanel event={event} /> : <Participants … />}
import type { RegistrationStatus } from '@sport/shared';
import type { EventDetails } from '@sport/shared/schemas/events';
import type { OrganizerRegistration } from '@sport/shared/schemas/registrations';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { formatDateTime } from '../../../shared/format';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  Modal,
  SkeletonList,
  type IconName,
} from '../../../shared/ui';
import { plural } from '../../user/format';
import { isWithdrawn, WITHDRAWN_LABEL } from '../../user/JoinPanel';
import { Reliability } from '../../user/reviews/ReviewList';
import { useDecideRegistration, useEventRegistrations, useSetRegistrationClosed } from './api';

/** Строки списка по статусам: подпись и иконка. Выбранная строка показывает записи под списком. */
const ROWS: Record<RegistrationStatus, { label: string; icon: IconName }> = {
  pending: { label: 'Ждут решения', icon: 'clock' },
  confirmed: { label: 'Участники', icon: 'people' },
  rejected: { label: 'Отклонённые', icon: 'cross' },
  cancelled: { label: 'Отменили', icon: 'close' },
};

/** Сначала то, что ждёт решения организатора. */
const ROW_ORDER: RegistrationStatus[] = ['pending', 'confirmed', 'rejected', 'cancelled'];

const LIST_TITLE: Record<RegistrationStatus, string> = {
  pending: 'Заявки',
  confirmed: 'Участники',
  rejected: 'Отклонённые заявки',
  cancelled: 'Отменили запись',
};

const DECIDED: Partial<Record<RegistrationStatus, string>> = {
  confirmed: 'принята',
  rejected: 'отклонена',
};

const EMPTY_TEXT: Record<RegistrationStatus, string> = {
  pending: 'Новых заявок нет.',
  confirmed: 'Пока никто не записался.',
  rejected: 'Отклонённых заявок нет.',
  cancelled: 'Никто не отменял запись.',
};

export function OrganizerPanel({ event }: { event: EventDetails }) {
  const registrations = useEventRegistrations(event.id);
  const decide = useDecideRegistration(event.id);
  const [chosenTab, setTab] = useState<RegistrationStatus | null>(null);
  const [rejecting, setRejecting] = useState<OrganizerRegistration | null>(null);
  const counts = registrations.data?.counts;
  // Пока организатор сам не выбрал строку: есть заявки — показываем их, иначе участников.
  const tab = chosenTab ?? (counts && counts.pending > 0 ? 'pending' : 'confirmed');
  const canDecide = event.status === 'published' && !event.isPast;
  const full = event.capacity !== null && event.participantsCount >= event.capacity;
  // Заявки, на которые не ответили до начала: решить по ним сервер уже не даст.
  const missed = event.isPast && counts ? counts.pending : 0;
  // При свободной записи заявок и отказов не бывает: эти строки — только если такие записи
  // остались с тех пор, как встреча была по заявке.
  const rows = ROW_ORDER.filter(
    (status) =>
      event.joinMode === 'request' ||
      (status !== 'pending' && status !== 'rejected') ||
      (counts?.[status] ?? 0) > 0,
  );

  const items = registrations.data?.items.filter((item) => item.status === tab) ?? [];

  return (
    <Card className="flex flex-col gap-4 p-5" aria-labelledby="organizer-panel-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="organizer-panel-title" className="text-h3">
          Вы организатор
        </h2>
        {event.permissions.canEdit && (
          // Ссылкой, как «Закрыть запись»: кнопка с рамкой не встаёт рядом с заголовком в колонке 24rem.
          <Link
            to={`/events/${event.id}/edit`}
            aria-label="Изменить событие"
            className="tap-area font-semibold underline underline-offset-4"
          >
            Изменить
          </Link>
        )}
      </div>

      {canDecide && <RegistrationSwitch event={event} />}
      {missed > 0 && (
        <Alert tone="warning">
          Встреча уже прошла. Без ответа: {plural(missed, ['заявка', 'заявки', 'заявок'])} — люди
          видят пометку «Заявка не рассмотрена».
        </Alert>
      )}
      {decide.error && (
        <Alert>
          {decide.error instanceof ApiError
            ? decide.error.message
            : 'Не получилось сохранить решение. Попробуйте ещё раз'}
        </Alert>
      )}
      {full && counts && counts.pending > 0 && canDecide && (
        <Alert tone="warning">
          Свободных мест нет: чтобы принять новую заявку, увеличьте лимит мест.
        </Alert>
      )}

      {/* Вместо вкладок — список со счётчиками: нажатие показывает эти записи ниже. */}
      <div role="group" aria-label="Записи по статусу" className="flex flex-col">
        {rows.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={tab === status}
            onClick={() => setTab(status)}
            className="flex min-h-12 cursor-pointer items-center justify-between gap-3 border-b-2 border-dashed border-line-soft px-2 text-left font-semibold last:border-b-0 hover:bg-surface-muted aria-pressed:rounded-md aria-pressed:border-transparent aria-pressed:bg-surface-muted"
          >
            <span className="flex items-center gap-2">
              <Icon name={ROWS[status].icon} size={18} />
              {ROWS[status].label}
            </span>
            <RowCount status={status} event={event} count={counts?.[status]} />
          </button>
        ))}
      </div>

      <section aria-label={LIST_TITLE[tab]} className="flex flex-col gap-3">
        <h3 className="font-semibold">{LIST_TITLE[tab]}</h3>
        {registrations.isPending ? (
          <SkeletonList count={2} />
        ) : registrations.isError ? (
          <ErrorState error={registrations.error} onRetry={() => registrations.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-ink-muted">{EMPTY_TEXT[tab]}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2.5 rounded-md border-2 border-line-soft bg-surface p-3.5"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={item.user.name} size={40} />
                  <Link to={`/users/${item.user.id}`} className="tap-area min-w-0 font-semibold">
                    {item.user.name}
                  </Link>
                </div>
                {/* Надёжность по прошлым встречам помогает решить по заявке (модуль отзывов).
                    На всю ширину карточки: рядом с аватаром оценка и «приходит на…» рвутся. */}
                <Reliability summary={item.user.reliability} />
                <RecordNote item={item} event={event} />
                {item.message && (
                  <p className="whitespace-pre-line rounded-md bg-surface-muted px-3 py-2 text-sm">
                    «{item.message}»
                  </p>
                )}
                {item.user.about && (
                  <p className="line-clamp-2 text-sm text-ink-muted">{item.user.about}</p>
                )}
                {item.status === 'pending' && canDecide && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      loading={
                        decide.isPending &&
                        decide.variables?.registrationId === item.id &&
                        decide.variables.decision === 'confirm'
                      }
                      disabled={decide.isPending || full}
                      onClick={() =>
                        decide.mutate({ registrationId: item.id, decision: 'confirm' })
                      }
                    >
                      <Icon name="check" size={18} />
                      Принять
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={decide.isPending}
                      onClick={() => setRejecting(item)}
                    >
                      <Icon name="cross" size={18} />
                      Отклонить
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Отклонить заявку?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Нет, оставить
            </Button>
            <Button
              variant="danger"
              loading={decide.isPending}
              onClick={() =>
                rejecting &&
                decide.mutate(
                  { registrationId: rejecting.id, decision: 'reject' },
                  { onSettled: () => setRejecting(null) },
                )
              }
            >
              Да, отклонить
            </Button>
          </>
        }
      >
        <p>
          {rejecting?.user.name} увидит, что заявка отклонена, и не сможет подать её на эту встречу
          снова.
        </p>
      </Modal>
    </Card>
  );
}

/** Число в строке списка: ждущие — жёлтым, когда они есть; участники — «из N» при лимите. */
function RowCount({
  status,
  event,
  count,
}: {
  status: RegistrationStatus;
  event: EventDetails;
  count: number | undefined;
}) {
  if (status === 'confirmed') {
    return (
      <span className="font-normal text-ink-muted">
        {event.capacity === null
          ? event.participantsCount
          : `${event.participantsCount} из ${event.capacity}`}
      </span>
    );
  }
  if (count === undefined) return <span className="font-normal text-ink-muted">—</span>;
  if (status === 'pending' && count > 0 && !event.isPast) {
    return (
      <span className="inline-flex min-w-7 items-center justify-center rounded-full border-2 border-ink bg-status-warning px-2 text-sm">
        {count}
      </span>
    );
  }
  return <span className="font-normal text-ink-muted">{count}</span>;
}

/**
 * Когда подана заявка или запись и что с ней стало. Статус ясен из заголовка списка, плашка —
 * только для особых случаев: заявка осталась без ответа или её отозвали до решения.
 */
function RecordNote({ item, event }: { item: OrganizerRegistration; event: EventDetails }) {
  const missed = item.status === 'pending' && event.isPast;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
      {missed && (
        <Badge tone="neutral" icon="clock">
          Не рассмотрена
        </Badge>
      )}
      {isWithdrawn(event.joinMode, item) && <Badge tone="neutral">{WITHDRAWN_LABEL}</Badge>}
      <span>
        {item.status === 'pending' ? 'Заявка от ' : 'Запись от '}
        {formatDateTime(item.createdAt)}
        {item.decidedAt &&
          DECIDED[item.status] &&
          ` · ${DECIDED[item.status]} ${formatDateTime(item.decidedAt)}`}
      </span>
    </p>
  );
}

/**
 * Закрыть запись, когда состав набран, и открыть снова. Только до начала: потом запись закрыта
 * и так. Записанные остаются, ждущие заявки по-прежнему рассматриваются в списке ниже.
 */
function RegistrationSwitch({ event }: { event: EventDetails }) {
  const toggle = useSetRegistrationClosed(event.id);
  const closed = event.registrationClosed;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Badge tone={closed ? 'neutral' : 'success'} icon={closed ? 'lock' : 'door'}>
          {closed ? 'Запись закрыта' : 'Запись открыта'}
        </Badge>
        <button
          type="button"
          disabled={toggle.isPending}
          aria-busy={toggle.isPending || undefined}
          onClick={() => toggle.mutate(!closed)}
          className="tap-area cursor-pointer font-semibold underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {closed ? 'Открыть снова' : 'Закрыть запись'}
        </button>
      </div>
      <p className="text-sm text-ink-muted">
        {closed
          ? 'Новые люди записаться не могут. Записанные остаются.'
          : 'Состав набран? Закройте запись — встреча останется в ленте с пометкой.'}
      </p>
      {toggle.error && (
        <Alert>
          {toggle.error instanceof ApiError
            ? toggle.error.message
            : 'Не получилось. Попробуйте ещё раз'}
        </Alert>
      )}
    </div>
  );
}
