// Проверка демо-данных без базы: то, что не ловят ограничения PostgreSQL, но сломает сценарии ТЗ.
import { describe, expect, it } from 'vitest';
import {
  COMMENTS,
  EVENTS,
  ORGANIZATIONS,
  REGISTRATIONS,
  REVIEWS,
  SPORTS,
  USERS,
  VENUES,
  CUSTOM_SPORT,
} from './data';
import { REVIEW_WINDOW_DAYS } from '@sport/shared/schemas/reviews';
import { krasnoyarskTime } from './time';

const eventByKey = new Map(EVENTS.map((event) => [event.key, event]));
const sportNames = new Set([...SPORTS.map((s) => s.name), CUSTOM_SPORT.name]);
const venueKeys = new Set(VENUES.map((v) => v.key));

describe('демо-данные', () => {
  it('все ссылки по ключам указывают на существующие записи', () => {
    for (const event of EVENTS) {
      expect(sportNames, event.key).toContain(event.sport);
      expect(USERS[event.author], event.key).toBeDefined();
      if (event.venue) expect(venueKeys, event.key).toContain(event.venue);
      if (!event.venue)
        expect(event.address, `${event.key}: без площадки нужен адрес`).toBeTruthy();
    }
    for (const [event, user] of REGISTRATIONS) {
      expect(eventByKey.has(event), event).toBe(true);
      expect(USERS[user]).toBeDefined();
    }
    for (const comment of COMMENTS) expect(eventByKey.has(comment.event), comment.event).toBe(true);
  });

  it('отзывы оставляют участники встречи, а отмечает их её автор', () => {
    const confirmed = (event: string, user: string) =>
      REGISTRATIONS.some(([k, u, s]) => k === event && u === user && s === 'confirmed');
    for (const review of REVIEWS) {
      const event = eventByKey.get(review.event)!;
      expect(event, review.event).toBeDefined();
      expect(event.when.days, `${review.event}: отзыв только о прошедшей`).toBeLessThan(0);
      if (review.about) {
        expect(review.author, review.event).toBe(event.author);
        expect(confirmed(review.event, review.about), review.event).toBe(true);
      } else {
        expect(review.rating, `${review.event}: звёзды обязательны`).toBeDefined();
        expect(confirmed(review.event, review.author), review.event).toBe(true);
      }
    }
  });

  it('событие от организации создаёт её представитель', () => {
    for (const event of EVENTS.filter((e) => e.organization)) {
      const org = ORGANIZATIONS.find((o) => o.key === event.organization)!;
      expect(org.owner, event.key).toBe(event.author);
      expect(org.status, `${event.key}: публиковать может только допущенная`).toBe('approved');
    }
  });

  it('записи не нарушают правила записи', () => {
    for (const [key, user, status] of REGISTRATIONS) {
      const event = eventByKey.get(key)!;
      expect(user, `${key}: запись на своё событие`).not.toBe(event.author);
      if (status === 'pending' || status === 'rejected') {
        expect(event.joinMode, `${key}: заявка бывает только у события по заявке`).toBe('request');
      }
    }
    for (const event of EVENTS.filter((e) => e.capacity)) {
      const confirmed = REGISTRATIONS.filter(([k, , s]) => k === event.key && s === 'confirmed');
      expect(confirmed.length, `${event.key}: мест больше нет`).toBeLessThanOrEqual(
        event.capacity!,
      );
    }
  });

  it('для сценариев ТЗ есть всё нужное', () => {
    const published = EVENTS.filter((e) => !e.unpublishedReason && e.when.days >= 0);
    const user1Events = new Set(REGISTRATIONS.filter(([, u]) => u === 'user1').map(([k]) => k));
    // Сценарий 3: участник может записаться на свободное событие с местами.
    expect(
      published.some(
        (e) => e.joinMode === 'free' && e.author !== 'user1' && !user1Events.has(e.key),
      ),
    ).toBe(true);
    // Сценарий 4: у организации и у участника есть хотя бы по две заявки — принять и отклонить.
    for (const organizer of ['orgApproved', 'user1']) {
      const requests = REGISTRATIONS.filter(
        ([k, , s]) => s === 'pending' && eventByKey.get(k)!.author === organizer,
      );
      expect(requests.length, organizer).toBeGreaterThanOrEqual(2);
    }
    // Сценарий 2: организации до и после допуска.
    expect(new Set(ORGANIZATIONS.map((o) => o.status))).toEqual(
      new Set(['approved', 'pending', 'rejected']),
    );
    // Сценарий 6: снятое событие, на которое кто-то записан.
    const unpublished = EVENTS.filter((e) => e.unpublishedReason).map((e) => e.key);
    expect(REGISTRATIONS.some(([k]) => unpublished.includes(k))).toBe(true);
    // Универсальность: не меньше пяти видов спорта среди опубликованных.
    expect(new Set(published.map((e) => e.sport)).size).toBeGreaterThanOrEqual(5);
    // Есть событие только с текстовым адресом — так выглядит карточка без карты.
    expect(published.some((e) => !e.venue && !e.point)).toBe(true);
  });
});

describe('время демо-событий', () => {
  it('считается по Красноярску (UTC+7)', () => {
    // 19 октября, 22:00 по Красноярску = 15:00 UTC.
    const now = new Date('2026-10-19T15:00:00Z');
    expect(krasnoyarskTime(1, '19:00', now).toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('после полуночи по Красноярску «завтра» — уже следующий местный день', () => {
    // 20 октября, 02:00 по Красноярску = 19 октября, 19:00 UTC.
    const now = new Date('2026-10-19T19:00:00Z');
    expect(krasnoyarskTime(1, '07:30', now).toISOString()).toBe('2026-10-21T00:30:00.000Z');
  });

  it('события для записи — в будущем, для отзывов — прошли не раньше окна отзывов', () => {
    const now = new Date();
    for (const event of EVENTS) {
      const start = krasnoyarskTime(event.when.days, event.when.time, now).getTime();
      if (event.when.days >= 0) {
        expect(start, event.key).toBeGreaterThan(now.getTime());
      } else {
        expect(start, event.key).toBeLessThan(now.getTime());
      }
    }
    // Эксперт проверяет отзывы сам: у Ивана есть прошедшая встреча с открытым окном, которую
    // он ещё не оценил, и своя прошедшая встреча с участниками, которых он ещё не отметил.
    const fresh = (event: (typeof EVENTS)[number]) =>
      event.when.days < 0 && -event.when.days < REVIEW_WINDOW_DAYS;
    const reviewedByIvan = new Set(
      REVIEWS.filter((r) => !r.about && r.author === 'user1').map((r) => r.event),
    );
    const marked = new Set(REVIEWS.filter((r) => r.about).map((r) => r.event));
    expect(
      EVENTS.some(
        (event) =>
          fresh(event) &&
          REGISTRATIONS.some(
            ([k, u, s]) => k === event.key && u === 'user1' && s === 'confirmed',
          ) &&
          !reviewedByIvan.has(event.key),
      ),
    ).toBe(true);
    expect(
      EVENTS.some(
        (event) =>
          fresh(event) &&
          event.author === 'user1' &&
          !marked.has(event.key) &&
          REGISTRATIONS.some(([k, , s]) => k === event.key && s === 'confirmed'),
      ),
    ).toBe(true);
  });
});
