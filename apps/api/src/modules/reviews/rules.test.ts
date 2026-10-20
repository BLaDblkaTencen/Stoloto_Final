import { attendanceSchema, participantReviewSchema } from '@sport/shared/schemas/reviews';
import { describe, expect, it } from 'vitest';
import {
  attendanceDenial,
  eventEnd,
  isReviewOpen,
  participantReviewDenial,
  ratingSummary,
  type ReviewEvent,
} from './rules';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const start = new Date('2026-10-10T12:00:00Z');
const event: ReviewEvent = {
  status: 'published',
  startsAt: start,
  endsAt: new Date(start.getTime() + 2 * HOUR),
  createdBy: 'author',
};
const at = (ms: number) => new Date(start.getTime() + ms);
const user = { id: 'user', role: 'user' as const };

describe('окно отзывов', () => {
  it('без времени окончания встреча кончается через 2 часа после начала', () => {
    expect(eventEnd({ startsAt: start, endsAt: null })).toEqual(at(2 * HOUR));
    const noEnd = { ...event, endsAt: null };
    expect(isReviewOpen(noEnd, start)).toBe(false);
    expect(isReviewOpen(noEnd, at(2 * HOUR - 1))).toBe(false);
    expect(isReviewOpen(noEnd, at(2 * HOUR))).toBe(true);
    expect(isReviewOpen(noEnd, at(2 * HOUR + 14 * DAY + 1))).toBe(false);
  });

  it('открыто с окончания встречи и 14 дней после', () => {
    expect(isReviewOpen(event, at(HOUR))).toBe(false);
    expect(isReviewOpen(event, at(2 * HOUR))).toBe(true);
    expect(isReviewOpen(event, at(2 * HOUR + 14 * DAY))).toBe(true);
    expect(isReviewOpen(event, at(2 * HOUR + 14 * DAY + 1))).toBe(false);
  });

  it('у снятой встречи окна нет', () => {
    expect(isReviewOpen({ ...event, status: 'unpublished' }, at(3 * HOUR))).toBe(false);
  });
});

describe('кто может оценить', () => {
  const later = at(DAY);

  it('только подтверждённый участник и не сам организатор', () => {
    expect(participantReviewDenial(event, user, 'confirmed', later)).toBeNull();
    expect(participantReviewDenial(event, user, 'pending', later)?.code).toBe('NOT_PARTICIPANT');
    expect(participantReviewDenial(event, user, 'cancelled', later)?.code).toBe('NOT_PARTICIPANT');
    expect(participantReviewDenial(event, user, null, later)?.code).toBe('NOT_PARTICIPANT');
    expect(
      participantReviewDenial(event, { id: 'author', role: 'user' }, 'confirmed', later)?.code,
    ).toBe('OWN_EVENT');
  });

  it('не раньше окончания и не позже 14 дней', () => {
    expect(participantReviewDenial(event, user, 'confirmed', at(HOUR))?.code).toBe(
      'REVIEW_NOT_YET',
    );
    expect(participantReviewDenial(event, user, 'confirmed', at(20 * DAY))?.code).toBe(
      'REVIEW_CLOSED',
    );
  });

  it('участников отмечает только автор события', () => {
    expect(attendanceDenial(event, { id: 'author' }, later)).toBeNull();
    expect(attendanceDenial(event, user, later)?.code).toBe('NOT_EVENT_AUTHOR');
    expect(attendanceDenial({ ...event, status: 'deleted' }, { id: 'author' }, later)?.code).toBe(
      'EVENT_UNAVAILABLE',
    );
  });
});

describe('средняя оценка', () => {
  it('видна от трёх отзывов и округляется до десятых', () => {
    expect(ratingSummary(10, 2)).toEqual({ rating: null, count: 2 });
    expect(ratingSummary(14, 3)).toEqual({ rating: 4.7, count: 3 });
    expect(ratingSummary(0, 0)).toEqual({ rating: null, count: 0 });
  });
});

describe('тело отзыва', () => {
  it('звёзды обязательны и только от 1 до 5', () => {
    expect(participantReviewSchema.safeParse({}).success).toBe(false);
    expect(participantReviewSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(participantReviewSchema.safeParse({ rating: 4.5 }).success).toBe(false);
    expect(participantReviewSchema.parse({ rating: 5 })).toEqual({
      rating: 5,
      tags: [],
      comment: null,
    });
  });

  it('комментарий обрезается, пустой — null; теги без повторов и только из списка', () => {
    expect(
      participantReviewSchema.parse({
        rating: 4,
        tags: ['as_described', 'as_described'],
        comment: '  Хорошо  ',
      }),
    ).toEqual({ rating: 4, tags: ['as_described'], comment: 'Хорошо' });
    expect(participantReviewSchema.parse({ rating: 4, comment: '   ' }).comment).toBeNull();
    expect(participantReviewSchema.safeParse({ rating: 4, tags: ['team_player'] }).success).toBe(
      false,
    );
    expect(participantReviewSchema.safeParse({ rating: 4, comment: 'а'.repeat(501) }).success).toBe(
      false,
    );
  });
});

describe('отметки организатора', () => {
  const id = '6f1c2a4e-9b7d-4c3e-8a1f-2d3e4f5a6b7c';

  it('у неявки звёзды и теги отбрасываются, комментарий остаётся', () => {
    expect(
      attendanceSchema.parse({
        marks: [
          { userId: id, attended: false, rating: 2, tags: ['team_player'], comment: 'Не пришёл' },
        ],
      }).marks[0],
    ).toEqual({ userId: id, attended: false, rating: null, tags: [], comment: 'Не пришёл' });
  });

  it('нужен хотя бы один участник, и каждый — один раз', () => {
    expect(attendanceSchema.safeParse({ marks: [] }).success).toBe(false);
    expect(
      attendanceSchema.safeParse({
        marks: [
          { userId: id, attended: true },
          { userId: id, attended: false },
        ],
      }).success,
    ).toBe(false);
  });
});
