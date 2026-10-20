// Панель организатора (задача 2.7, сценарии 3 и 4 ТЗ): входящие заявки, участники, решения.
// Работает и для участника-организатора, и для организации. Подключена в карточку события
// участника 1: видна только автору события (permissions.isOrganizer).
//
//   {event.permissions.isOrganizer && <OrganizerPanel event={event} />}
import { REGISTRATION_STATUSES, type RegistrationStatus } from '@sport/shared';
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
  ButtonLink,
  Card,
  Chip,
  ErrorState,
  Modal,
  SkeletonList,
} from '../../../shared/ui';
import { plural } from '../../user/format';
import { Reliability } from '../../user/reviews/ReviewList';
import { useDecideRegistration, useEventRegistrations, useSetRegistrationClosed } from './api';

const TAB_LABELS: Record<RegistrationStatus, string> = {
  pending: 'Заявки',
  confirmed: 'Участники',
  rejected: 'Отклонённые',
  cancelled: 'Отменили',
};

// Подписи со стороны организатора: общие REGISTRATION_STATUS_LABELS написаны для участника
// («Вы записаны»), здесь они звучали бы так, будто записан сам организатор.
const STATUS_BADGE: Record<
  RegistrationStatus,
  { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  confirmed: { tone: 'success', label: 'Участвует' },
  pending: { tone: 'warning', label: 'Ждёт решения' },
  rejected: { tone: 'danger', label: 'Заявка отклонена' },
  cancelled: { tone: 'neutral', label: 'Запись отменена' },
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
  // Пока организатор сам не выбрал вкладку: есть заявки — показываем их, иначе участников.
  const tab = chosenTab ?? (counts && counts.pending > 0 ? 'pending' : 'confirmed');
  const canDecide = event.status === 'published' && !event.isPast;
  const full = event.capacity !== null && event.participantsCount >= event.capacity;
  // Заявки, на которые не ответили до начала: решить по ним сервер уже не даст.
  const missed = event.isPast && counts ? counts.pending : 0;

  const items = registrations.data?.items.filter((item) => item.status === tab) ?? [];

  return (
    <Card tone="accent" className="flex flex-col gap-4" aria-labelledby="organizer-panel-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="organizer-panel-title" className="text-h3">
          Панель организатора
        </h2>
        {event.permissions.canEdit && (
          <ButtonLink to={`/events/${event.id}/edit`} variant="secondary">
            Изменить событие
          </ButtonLink>
        )}
      </div>
      <p>
        {event.joinMode === 'request'
          ? 'Запись по заявке: примите или отклоните каждую. Человек сразу увидит решение в карточке события и в «Моих мероприятиях».'
          : 'Свободная запись: люди попадают в список участников сразу, без вашего решения.'}
      </p>

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

      <div role="group" aria-label="Записи по статусу" className="flex flex-wrap gap-2.5">
        {REGISTRATION_STATUSES.map((status, index) => (
          <Chip key={status} index={index} pressed={tab === status} onClick={() => setTab(status)}>
            {TAB_LABELS[status]}
            {counts ? ` · ${counts[status]}` : ''}
          </Chip>
        ))}
      </div>

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
              className="flex flex-col gap-3 rounded-md border-2 border-ink bg-surface p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={item.user.name} size={40} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link to={`/users/${item.user.id}`} className="font-semibold">
                      {item.user.name}
                    </Link>
                    {item.status === 'pending' && event.isPast ? (
                      <Badge tone="neutral" icon="clock">
                        Не рассмотрена
                      </Badge>
                    ) : (
                      <Badge tone={STATUS_BADGE[item.status].tone}>
                        {STATUS_BADGE[item.status].label}
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {item.status === 'pending' ? 'Заявка от ' : 'Запись от '}
                    {formatDateTime(item.createdAt)}
                    {item.decidedAt &&
                      DECIDED[item.status] &&
                      ` · ${DECIDED[item.status]} ${formatDateTime(item.decidedAt)}`}
                  </p>
                  {/* Надёжность по прошлым встречам помогает решить по заявке (модуль отзывов). */}
                  <Reliability summary={item.user.reliability} />
                  {item.user.about && <p className="text-sm">{item.user.about}</p>}
                  {item.message && (
                    <p className="whitespace-pre-line rounded-md bg-surface-muted p-3">
                      «{item.message}»
                    </p>
                  )}
                </div>
              </div>
              {item.status === 'pending' && canDecide && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    loading={
                      decide.isPending &&
                      decide.variables?.registrationId === item.id &&
                      decide.variables.decision === 'confirm'
                    }
                    disabled={decide.isPending || full}
                    onClick={() => decide.mutate({ registrationId: item.id, decision: 'confirm' })}
                  >
                    Принять
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={decide.isPending}
                    onClick={() => setRejecting(item)}
                  >
                    Отклонить
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

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

/**
 * Закрыть запись, когда состав набран, и открыть снова. Только до начала: потом запись закрыта
 * и так. Записанные остаются, ждущие заявки по-прежнему рассматриваются в списке ниже.
 */
function RegistrationSwitch({ event }: { event: EventDetails }) {
  const toggle = useSetRegistrationClosed(event.id);
  const closed = event.registrationClosed;
  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-ink bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col items-start gap-1.5">
          <Badge tone={closed ? 'neutral' : 'success'} icon={closed ? 'lock' : 'door'}>
            {closed ? 'Запись закрыта' : 'Запись открыта'}
          </Badge>
          <p className="text-sm text-ink-muted">
            {closed
              ? 'Новые люди записаться не могут. Записанные остаются, заявки можно рассмотреть.'
              : 'Состав набран? Закройте запись — встреча останется в ленте с пометкой «Запись закрыта».'}
          </p>
        </div>
        <Button
          variant="secondary"
          loading={toggle.isPending}
          onClick={() => toggle.mutate(!closed)}
        >
          {closed ? 'Открыть запись снова' : 'Закрыть запись'}
        </Button>
      </div>
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
