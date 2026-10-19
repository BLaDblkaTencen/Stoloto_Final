// Блок записи на странице события. Что показать, решает сервер (permissions, joinBlock,
// myRegistration): интерфейс не дублирует правила и не расходится с ними. Организатор
// управляет событием в панели организатора, блок записи ему не показывается.
import { REGISTRATION_MESSAGE_MAX } from '@sport/shared/schemas/registrations';
import type { EventDetails } from '@sport/shared/schemas/events';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Icon,
  Modal,
  StatusBadge,
  TextareaField,
} from '../../shared/ui';
import { useCancelRegistration, useJoinEvent } from './api';

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Не получилось. Попробуйте ещё раз';

/** Пояснение под статусом записи: что происходит и что будет дальше. */
const STATUS_TEXT = {
  confirmed: 'Вы в списке участников. Ждём вас!',
  pending: 'Организатор рассмотрит заявку и примет решение. Статус обновится здесь.',
  rejected: 'Организатор отклонил заявку. Посмотрите другие встречи.',
  cancelled: 'Вы отменили запись.',
} as const;

export function JoinPanel({ event }: { event: EventDetails }) {
  const location = useLocation();
  const join = useJoinEvent(event.id);
  const cancel = useCancelRegistration(event.id);
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { permissions, joinBlock, myRegistration: my } = event;
  const byRequest = event.joinMode === 'request';
  const error = join.error ?? cancel.error;

  // Организатору вместо блока записи — панель организатора (участник 2) над карточкой.
  if (permissions.isOrganizer) return null;

  const cancelLabel = my?.status === 'pending' ? 'Отозвать заявку' : 'Отменить запись';

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-h3">Участие</h2>
      {error && <Alert>{errorText(error)}</Alert>}

      {my && (
        <div className="flex flex-col items-start gap-2">
          <StatusBadge kind="registration" status={my.status} />
          <p>{STATUS_TEXT[my.status]}</p>
          {my.message && my.status === 'pending' && (
            <p className="text-sm text-ink-muted">Ваше сообщение: «{my.message}»</p>
          )}
        </div>
      )}

      {my?.status === 'confirmed' && event.chatUrl && (
        <a href={event.chatUrl} target="_blank" rel="noreferrer" className="font-semibold">
          Чат участников
        </a>
      )}

      {permissions.canJoin && (
        <div className="flex flex-col gap-3">
          <p>
            {byRequest
              ? 'Запись по заявке: организатор посмотрит её и примет решение.'
              : 'Свободная запись: вы сразу попадёте в список участников.'}
          </p>
          {byRequest && (
            <TextareaField
              label="Сообщение организатору"
              hint="Необязательно: опыт, вопрос, кого возьмёте с собой"
              rows={3}
              maxLength={REGISTRATION_MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
          <Button
            size="lg"
            variant={byRequest ? 'dark' : 'primary'}
            loading={join.isPending}
            onClick={() => join.mutate(message.trim() || null)}
          >
            {byRequest ? 'Отправить заявку' : 'Записаться'}
          </Button>
        </div>
      )}

      {!permissions.canJoin && !my && joinBlock?.code === 'UNAUTHORIZED' && (
        <ButtonLink size="lg" to={`/login?next=${encodeURIComponent(location.pathname)}`}>
          Войти, чтобы записаться
        </ButtonLink>
      )}

      {/* Почему нельзя записаться, если это не повтор статуса выше: «Мест нет», «Событие прошло». */}
      {!permissions.canJoin &&
        joinBlock &&
        !['UNAUTHORIZED', 'ALREADY_REGISTERED', 'REGISTRATION_REJECTED'].includes(
          joinBlock.code,
        ) && (
          <p className="flex items-start gap-2 font-semibold">
            <Icon name="alert" className="mt-0.5" />
            {joinBlock.message}
          </p>
        )}

      {permissions.canCancel && (
        <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
          {cancelLabel}
        </Button>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`${cancelLabel}?`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Нет, оставить
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => cancel.mutate(undefined, { onSettled: () => setConfirmOpen(false) })}
            >
              Да, {cancelLabel.toLowerCase()}
            </Button>
          </>
        }
      >
        <p>
          {event.capacity !== null && my?.status === 'confirmed'
            ? 'Место освободится, и его сможет занять другой человек.'
            : 'Записаться снова можно, пока есть места.'}
        </p>
      </Modal>
    </Card>
  );
}
