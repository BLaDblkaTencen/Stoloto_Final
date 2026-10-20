// Правила отзывов: когда открыто окно, кто может оценить, какие оценки видны. Чистые функции без
// базы: «Мои мероприятия» показывают по ним кнопки, а сервис по ним же отказывает.
import type { EventStatus, RegistrationStatus, UserRole } from '@sport/shared';
import {
  DEFAULT_EVENT_HOURS,
  RATING_MIN_REVIEWS,
  REVIEW_WINDOW_DAYS,
  type RatingSummary,
} from '@sport/shared/schemas/reviews';
import type { Denial } from '../events/rules';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type ReviewEvent = {
  status: EventStatus;
  startsAt: Date;
  endsAt: Date | null;
  createdBy: string;
};

/** Встреча закончилась в ends_at, а если его нет — через DEFAULT_EVENT_HOURS после начала. */
export const eventEnd = (event: Pick<ReviewEvent, 'startsAt' | 'endsAt'>) =>
  event.endsAt ?? new Date(event.startsAt.getTime() + DEFAULT_EVENT_HOURS * HOUR);

export const reviewClosesAt = (event: Pick<ReviewEvent, 'startsAt' | 'endsAt'>) =>
  new Date(eventEnd(event).getTime() + REVIEW_WINDOW_DAYS * DAY);

/** Окно отзывов: встреча опубликована, уже закончилась и прошло не больше REVIEW_WINDOW_DAYS. */
export function isReviewOpen(event: ReviewEvent, now: Date) {
  const time = now.getTime();
  return (
    event.status === 'published' &&
    time >= eventEnd(event).getTime() &&
    time <= reviewClosesAt(event).getTime()
  );
}

/** Общие причины для обоих направлений: встреча снята, ещё не прошла или окно закрыто. */
function windowDenial(event: ReviewEvent, now: Date): Denial | null {
  if (event.status !== 'published') {
    return { status: 409, code: 'EVENT_UNAVAILABLE', message: 'Встреча снята с публикации' };
  }
  if (now.getTime() < eventEnd(event).getTime()) {
    return {
      status: 409,
      code: 'REVIEW_NOT_YET',
      message: 'Оценить встречу можно после её окончания',
    };
  }
  if (now.getTime() > reviewClosesAt(event).getTime()) {
    return {
      status: 409,
      code: 'REVIEW_CLOSED',
      message: `Отзыв оставляют в течение ${REVIEW_WINDOW_DAYS} дней после встречи`,
    };
  }
  return null;
}

/** Отзыв об организаторе оставляет только подтверждённый участник, не сам организатор. */
export function participantReviewDenial(
  event: ReviewEvent,
  user: { id: string; role: UserRole },
  myStatus: RegistrationStatus | null,
  now: Date,
): Denial | null {
  if (user.id === event.createdBy) {
    return { status: 403, code: 'OWN_EVENT', message: 'Свою встречу оценить нельзя' };
  }
  if (myStatus !== 'confirmed') {
    return {
      status: 403,
      code: 'NOT_PARTICIPANT',
      message: 'Оценить встречу могут только её участники',
    };
  }
  return windowDenial(event, now);
}

/** Отмечать участников может только автор события. Администратор — нет. */
export function attendanceDenial(
  event: ReviewEvent,
  user: { id: string },
  now: Date,
): Denial | null {
  if (user.id !== event.createdBy) {
    return {
      status: 403,
      code: 'NOT_EVENT_AUTHOR',
      message: 'Отмечать участников может только организатор встречи',
    };
  }
  return windowDenial(event, now);
}

/** Средняя оценка с одним знаком после запятой; меньше RATING_MIN_REVIEWS — оценку не показываем. */
export function ratingSummary(sum: number, count: number): RatingSummary {
  return {
    rating: count >= RATING_MIN_REVIEWS ? Math.round((sum / count) * 10) / 10 : null,
    count,
  };
}
