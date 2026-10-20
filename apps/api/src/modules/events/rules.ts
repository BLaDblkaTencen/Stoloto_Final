// Правила доступа к мероприятию: кто его видит, кто может записаться, править, писать в обсуждение.
// Чистые функции без базы: карточка события показывает по ним кнопки, а сервис записи
// (registrations) по ним же отказывает, поэтому интерфейс и сервер не расходятся. Источник — DATA_MODEL.md.
import type { EventStatus, JoinMode, RegistrationStatus, UserRole } from '@sport/shared';
import type { EventPermissions } from '@sport/shared/schemas/events';

export type RuleEvent = {
  status: EventStatus;
  startsAt: Date;
  createdBy: string;
  joinMode: JoinMode;
  capacity: number | null;
  registrationClosed: boolean;
};

/** Кто смотрит; null — не вошёл. */
export type Viewer = { id: string; role: UserRole } | null;

/** Причина отказа: HTTP-статус, код и текст из docs/api/events.md. */
export type Denial = { status: number; code: string; message: string };

const ACTIVE: readonly RegistrationStatus[] = ['confirmed', 'pending'];

export const isPast = (event: Pick<RuleEvent, 'startsAt'>, now: Date) =>
  event.startsAt.getTime() <= now.getTime();

export const isOrganizer = (event: Pick<RuleEvent, 'createdBy'>, viewer: Viewer) =>
  viewer !== null && viewer.id === event.createdBy;

/**
 * Видно ли событие по прямой ссылке. Опубликованное — всем. Снятое или удалённое — только
 * организатору, админу и тем, кто был записан: им показываем «Публикация недоступна» с причиной.
 */
export function canSeeEvent(
  event: RuleEvent,
  viewer: Viewer,
  myStatus: RegistrationStatus | null,
): boolean {
  if (event.status === 'published') return true;
  return isOrganizer(event, viewer) || viewer?.role === 'admin' || myStatus !== null;
}

/** Имена участников: у свободной записи всем, у записи по заявке — организатору и подтверждённым. */
export function canSeeParticipants(
  event: RuleEvent,
  viewer: Viewer,
  myStatus: RegistrationStatus | null,
): boolean {
  if (event.joinMode === 'free') return true;
  return isOrganizer(event, viewer) || viewer?.role === 'admin' || myStatus === 'confirmed';
}

/** Ссылка на внешний чат — только подтверждённым участникам и организатору. */
export const canSeeChat = (event: RuleEvent, viewer: Viewer, myStatus: RegistrationStatus | null) =>
  isOrganizer(event, viewer) || myStatus === 'confirmed';

/** Почему нельзя записаться; null — можно. Порядок проверок задаёт текст, который увидит человек. */
export function joinDenial(
  event: RuleEvent,
  viewer: Viewer,
  myStatus: RegistrationStatus | null,
  participantsCount: number,
  now: Date,
): Denial | null {
  if (!viewer) return { status: 401, code: 'UNAUTHORIZED', message: 'Войдите, чтобы записаться' };
  if (event.status !== 'published') {
    return {
      status: 409,
      code: 'EVENT_UNAVAILABLE',
      message: 'Публикация недоступна, записаться нельзя',
    };
  }
  if (isPast(event, now)) return { status: 409, code: 'EVENT_PAST', message: 'Событие уже прошло' };
  if (isOrganizer(event, viewer)) {
    return { status: 409, code: 'OWN_EVENT', message: 'Это ваше событие: вы его организатор' };
  }
  if (viewer.role !== 'user') {
    return { status: 403, code: 'FORBIDDEN', message: 'Записываться могут только участники' };
  }
  if (myStatus === 'confirmed') {
    return { status: 409, code: 'ALREADY_REGISTERED', message: 'Вы уже записаны' };
  }
  if (myStatus === 'pending') {
    return { status: 409, code: 'ALREADY_REGISTERED', message: 'Заявка уже отправлена' };
  }
  if (myStatus === 'rejected') {
    return {
      status: 409,
      code: 'REGISTRATION_REJECTED',
      message: 'Организатор отклонил вашу заявку',
    };
  }
  // После проверок своей записи: записанный видит «Вы уже записаны», а не «Запись закрыта».
  if (event.registrationClosed) {
    return { status: 409, code: 'REGISTRATION_CLOSED', message: 'Организатор закрыл запись' };
  }
  // Заявка на заполненное событие тоже бессмысленна: принять её организатор не сможет.
  if (event.capacity !== null && participantsCount >= event.capacity) {
    return { status: 409, code: 'EVENT_FULL', message: 'Свободных мест нет' };
  }
  return null;
}

/** Почему нельзя отменить запись; null — можно. Со снятого события уйти можно. */
export function cancelDenial(
  event: RuleEvent,
  myStatus: RegistrationStatus | null,
  now: Date,
): Denial | null {
  if (!myStatus || !ACTIVE.includes(myStatus)) {
    return { status: 409, code: 'NOT_REGISTERED', message: 'Вы не записаны на это событие' };
  }
  if (isPast(event, now)) return { status: 409, code: 'EVENT_PAST', message: 'Событие уже прошло' };
  return null;
}

export function eventPermissions(
  event: RuleEvent,
  viewer: Viewer,
  myStatus: RegistrationStatus | null,
  participantsCount: number,
  now: Date,
): EventPermissions {
  const organizer = isOrganizer(event, viewer);
  const published = event.status === 'published';
  return {
    isOrganizer: organizer,
    canEdit: organizer && published && !isPast(event, now),
    canJoin: joinDenial(event, viewer, myStatus, participantsCount, now) === null,
    canCancel: viewer !== null && cancelDenial(event, myStatus, now) === null,
    canComment: viewer !== null && published,
  };
}
