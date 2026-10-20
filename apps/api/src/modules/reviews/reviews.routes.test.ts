// Отзывы на настоящей базе: свои тестовые данные, удаляются в конце. Демо-данные не трогает.
// Если база недоступна, тесты пропускаются.
import { randomUUID } from 'node:crypto';
import { inArray, like, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { db, sqlClient } from '../../db/client';
import { events, registrations, reviews, sports, users } from '../../db/schema';
import { createSession } from '../auth/session';

const dbAvailable = await db.execute(sql`select 1`).then(
  () => true,
  () => false,
);

// Случайный префикс, а не время: параллельные файлы тестов не заденут данные друг друга.
const run = randomUUID().slice(0, 8);
const HOUR = 60 * 60 * 1000;

describe.skipIf(!dbAvailable)('отзывы после встречи', () => {
  let app: FastifyInstance;
  const cookie: Record<string, string> = {};
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await buildApp();
    const names = ['organizer', 'p1', 'p2', 'outsider'] as const;
    const created = await db
      .insert(users)
      .values(
        names.map((name) => ({
          role: 'user' as const,
          name: `Тест ${name}`,
          email: `test-${run}-${name}@test.local`,
          passwordHash: 'x',
        })),
      )
      .returning({ id: users.id });
    names.forEach((name, index) => (ids[name] = created[index]!.id));
    for (const name of names) cookie[name] = `sid=${await createSession(ids[name]!)}`;

    const [sport] = await db
      .insert(sports)
      .values({
        name: `Тест ${run}`,
        slug: `тест ${run}`,
        isCustom: true,
        createdBy: ids.organizer!,
      })
      .returning({ id: sports.id });
    const base = {
      description: 'Описание',
      sportId: sport!.id,
      createdBy: ids.organizer!,
      address: 'ул. Тестовая, 1',
      joinMode: 'free' as const,
    };
    const past = Date.now() - 2 * 24 * HOUR;
    const [pastEvent, futureEvent] = await db
      .insert(events)
      .values([
        {
          ...base,
          title: `Прошедшая ${run}`,
          startsAt: new Date(past),
          endsAt: new Date(past + HOUR),
        },
        { ...base, title: `Будущая ${run}`, startsAt: new Date(Date.now() + 24 * HOUR) },
      ])
      .returning({ id: events.id });
    ids.past = pastEvent!.id;
    ids.future = futureEvent!.id;
    await db.insert(registrations).values(
      ['p1', 'p2'].flatMap((name) => [
        { eventId: ids.past!, userId: ids[name]!, status: 'confirmed' as const },
        { eventId: ids.future!, userId: ids[name]!, status: 'confirmed' as const },
      ]),
    );
  });

  afterAll(async () => {
    const eventIds = [ids.past!, ids.future!];
    await db.delete(reviews).where(inArray(reviews.eventId, eventIds));
    await db.delete(registrations).where(inArray(registrations.eventId, eventIds));
    await db.delete(events).where(inArray(events.id, eventIds));
    await db.delete(sports).where(like(sports.name, `Тест ${run}`));
    await db.delete(users).where(like(users.email, `test-${run}-%`));
    await app.close();
    await sqlClient.end();
  });

  const call = (method: 'GET' | 'PUT', url: string, who?: string, payload?: object) =>
    app.inject({ method, url, headers: who ? { cookie: cookie[who]! } : {}, payload });
  const reviewsOf = async (name: string) =>
    (await call('GET', `/api/users/${ids[name]}/reviews`)).json();

  it('оценить встречу может только её подтверждённый участник и только после неё', async () => {
    const outsider = await call('PUT', `/api/events/${ids.past}/review`, 'outsider', { rating: 5 });
    expect(outsider.statusCode).toBe(403);
    expect(outsider.json().error.code).toBe('NOT_PARTICIPANT');

    const early = await call('PUT', `/api/events/${ids.future}/review`, 'p1', { rating: 5 });
    expect(early.statusCode).toBe(409);
    expect(early.json().error.code).toBe('REVIEW_NOT_YET');

    const guest = await call('PUT', `/api/events/${ids.past}/review`, undefined, { rating: 5 });
    expect(guest.statusCode).toBe(401);
  });

  it('отзыв участника скрыт, пока организатор не отметил участников', async () => {
    const saved = await call('PUT', `/api/events/${ids.past}/review`, 'p1', {
      rating: 4,
      comment: 'Хорошо',
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ rating: 4, comment: 'Хорошо' });

    // Повторный отзыв правит тот же, а не добавляет второй.
    expect(
      (await call('PUT', `/api/events/${ids.past}/review`, 'p1', { rating: 5 })).statusCode,
    ).toBe(200);
    expect((await reviewsOf('organizer')).asOrganizer.count).toBe(0);
  });

  it('отмечает участников только автор и только участников встречи', async () => {
    const notAuthor = await call('PUT', `/api/events/${ids.past}/attendance`, 'p1', {
      marks: [{ userId: ids.p2, attended: true }],
    });
    expect(notAuthor.statusCode).toBe(403);

    const stranger = await call('PUT', `/api/events/${ids.past}/attendance`, 'organizer', {
      marks: [{ userId: ids.outsider, attended: true }],
    });
    expect(stranger.statusCode).toBe(422);
    expect(stranger.json().error.code).toBe('NOT_PARTICIPANT');
  });

  it('после отметок отзывы открываются по правилу слепых отзывов', async () => {
    const saved = await call('PUT', `/api/events/${ids.past}/attendance`, 'organizer', {
      marks: [
        { userId: ids.p1, attended: true, rating: 4, tags: ['team_player'] },
        { userId: ids.p2, attended: false, comment: 'Не было' },
      ],
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().items.map((item: { marked: boolean }) => item.marked)).toEqual([
      true,
      true,
    ]);

    // Организатор отметил — отзыв p1 о нём открылся.
    const organizer = await reviewsOf('organizer');
    expect(organizer.asOrganizer).toMatchObject({ count: 1, rating: null, organized: 1 });
    expect(organizer.items).toHaveLength(1);

    // p1 оценил встречу — его оценка от организатора видна.
    const p1 = await reviewsOf('p1');
    expect(p1.asParticipant).toMatchObject({ attended: 1, total: 1, count: 1 });

    // p2 встречу не оценил — неявка пока скрыта, он считается пришедшим.
    const p2 = await reviewsOf('p2');
    expect(p2.asParticipant).toMatchObject({ attended: 1, total: 1 });
    expect(p2.items).toHaveLength(0);

    // Как только p2 оценит встречу, неявка откроется.
    await call('PUT', `/api/events/${ids.past}/review`, 'p2', { rating: 3 });
    expect((await reviewsOf('p2')).asParticipant).toMatchObject({ attended: 0, total: 1 });
  });

  it('«Мои мероприятия» знают, можно ли оценить и отмечены ли участники', async () => {
    const mine = (await call('GET', '/api/registrations/mine?scope=past', 'p1')).json();
    const item = mine.items.find((event: { id: string }) => event.id === ids.past);
    expect(item.review).toMatchObject({ open: true, mine: { rating: 5 } });

    const organized = (await call('GET', '/api/events/mine?scope=past', 'organizer')).json();
    const event = organized.items.find((e: { id: string }) => e.id === ids.past);
    expect(event.attendance).toMatchObject({ open: true, marked: true });
  });
});
