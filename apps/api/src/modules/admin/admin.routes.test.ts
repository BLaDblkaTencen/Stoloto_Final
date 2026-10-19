// Админка на настоящей базе: свои тестовые данные, удаляются в конце. Демо-данные не трогает.
// Если база недоступна, тесты пропускаются.
import { eq, inArray, like, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { db, sqlClient } from '../../db/client';
import { auditLog, comments, events, organizations, sports, users } from '../../db/schema';
import { createSession } from '../auth/session';

const dbAvailable = await db.execute(sql`select 1`).then(
  () => true,
  () => false,
);

const run = Date.now().toString(36);
const email = (name: string) => `test-${run}-${name}@test.local`;

describe.skipIf(!dbAvailable)('админка', () => {
  let app: FastifyInstance;
  const cookie: Record<string, string> = {};
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await buildApp();
    const created = await db
      .insert(users)
      .values(
        (
          [
            ['admin', 'admin'],
            ['user', 'user'],
            ['owner1', 'organization'],
            ['owner2', 'organization'],
            ['owner3', 'organization'],
          ] as const
        ).map(([name, role]) => ({
          role,
          name: `Тест ${name}`,
          email: email(name),
          passwordHash: 'x',
        })),
      )
      .returning({ id: users.id, email: users.email });
    for (const user of created) ids[user.email.split('-')[2]!.split('@')[0]!] = user.id;
    cookie.admin = `sid=${await createSession(ids.admin!)}`;
    cookie.user = `sid=${await createSession(ids.user!)}`;

    // Одноимённая допущенная организация — чтобы проверить ORG_NAME_TAKEN.
    const [twin, pending, pending2] = await db
      .insert(organizations)
      .values([
        {
          ownerId: ids.owner1!,
          name: `Тест ${run}`,
          description: 'd',
          activity: 'клуб',
          status: 'approved',
          reviewedBy: ids.admin!,
          reviewedAt: new Date(),
        },
        { ownerId: ids.owner2!, name: `ТЕСТ ${run}`, description: 'd', activity: 'клуб' },
        { ownerId: ids.owner3!, name: `Другой ${run}`, description: 'd', activity: 'кружок' },
      ])
      .returning({ id: organizations.id });
    ids.twin = twin!.id;
    ids.pending = pending!.id;
    ids.pending2 = pending2!.id;

    const [sport] = await db
      .insert(sports)
      .values({ name: `Тест ${run}`, slug: `тест ${run}`, isCustom: true, createdBy: ids.user! })
      .returning({ id: sports.id });
    const [event] = await db
      .insert(events)
      .values({
        title: `Тестовое событие ${run}`,
        description: 'Описание',
        sportId: sport!.id,
        createdBy: ids.user!,
        startsAt: new Date(Date.now() + 86_400_000),
        address: 'ул. Тестовая, 1',
        joinMode: 'free',
      })
      .returning({ id: events.id });
    ids.event = event!.id;
    const [comment] = await db
      .insert(comments)
      .values({ eventId: ids.event!, authorId: ids.user!, text: 'Реклама не по теме' })
      .returning({ id: comments.id });
    ids.comment = comment!.id;
  });

  afterAll(async () => {
    const testUsers = Object.entries(ids)
      .filter(([key]) => ['admin', 'user', 'owner1', 'owner2', 'owner3'].includes(key))
      .map(([, id]) => id);
    await db.delete(auditLog).where(inArray(auditLog.actorId, testUsers));
    await db.delete(comments).where(eq(comments.eventId, ids.event!));
    await db.delete(events).where(eq(events.id, ids.event!));
    await db.delete(organizations).where(inArray(organizations.ownerId, testUsers));
    await db.delete(sports).where(eq(sports.createdBy, ids.user!));
    await db.delete(users).where(or(like(users.email, `test-${run}-%`)));
    await app.close();
    await sqlClient.end();
  });

  const call = (method: 'GET' | 'POST', url: string, who?: string, payload?: object) =>
    app.inject({ method, url, headers: who ? { cookie: cookie[who]! } : {}, payload });

  it('только для администратора: гость — 401, участник — 403', async () => {
    expect((await call('GET', '/api/admin/organizations')).statusCode).toBe(401);
    expect((await call('GET', '/api/admin/organizations', 'user')).statusCode).toBe(403);
    expect(
      (
        await call('POST', `/api/admin/events/${ids.event}/unpublish`, 'user', {
          reason: 'попытка',
        })
      ).statusCode,
    ).toBe(403);
  });

  it('список заявок: фильтр по статусу и поиск', async () => {
    const res = await call('GET', `/api/admin/organizations?status=pending&q=${run}`, 'admin');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.map((o: { id: string }) => o.id).sort()).toEqual(
      [ids.pending, ids.pending2].sort(),
    );
    expect(body.total).toBe(2);
    expect(body.items[0]).toMatchObject({
      status: 'pending',
      owner: { email: expect.stringContaining(run) },
    });
  });

  it('одобрить заявку с занятым названием — 409 ORG_NAME_TAKEN, статус не меняется', async () => {
    const res = await call('POST', `/api/admin/organizations/${ids.pending}/approve`, 'admin');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ORG_NAME_TAKEN');
    expect(
      (await call('GET', `/api/admin/organizations/${ids.pending}`, 'admin')).json().status,
    ).toBe('pending');
  });

  it('одобрение: статус, кто и когда, запись в журнале; повторно — 409', async () => {
    const res = await call('POST', `/api/admin/organizations/${ids.pending2}/approve`, 'admin');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'approved',
      reviewedAt: expect.any(String),
      rejectionReason: null,
    });
    expect(res.json().history).toEqual([
      expect.objectContaining({
        action: 'org.approve',
        actor: { id: ids.admin, name: 'Тест admin' },
      }),
    ]);
    const again = await call('POST', `/api/admin/organizations/${ids.pending2}/approve`, 'admin');
    expect([again.statusCode, again.json().error.code]).toEqual([409, 'ORG_NOT_PENDING']);
  });

  it('отказ только с причиной; причина видна в организации и журнале', async () => {
    const short = await call('POST', `/api/admin/organizations/${ids.pending}/reject`, 'admin', {
      reason: 'нет',
    });
    expect(short.statusCode).toBe(422);
    expect(short.json().error.fields.reason).toBeTruthy();
    const reason = 'Такое название уже занято, выберите другое';
    const res = await call('POST', `/api/admin/organizations/${ids.pending}/reject`, 'admin', {
      reason,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'rejected', rejectionReason: reason });
    expect(res.json().history[0]).toMatchObject({ action: 'org.reject', reason });
  });

  it('несуществующий или кривой id — 404', async () => {
    expect((await call('GET', '/api/admin/organizations/abc', 'admin')).json().error.code).toBe(
      'ORG_NOT_FOUND',
    );
    expect((await call('GET', `/api/admin/events/${ids.twin}`, 'admin')).statusCode).toBe(404);
  });

  it('снятие события: пропадает из ленты и не открывается по ссылке, записи нельзя', async () => {
    const before = await call('GET', `/api/admin/events?q=${run}`, 'admin');
    expect(before.json().items[0]).toMatchObject({
      id: ids.event,
      status: 'published',
      commentsCount: 1,
    });

    expect(
      (await call('POST', `/api/admin/events/${ids.event}/unpublish`, 'admin', {})).statusCode,
    ).toBe(422);
    const reason = 'Описание не соответствует правилам платформы';
    const res = await call('POST', `/api/admin/events/${ids.event}/unpublish`, 'admin', { reason });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'unpublished', moderationReason: reason });

    // Стык с модулем events (участник 1): лента и карточка учитывают решение админа.
    const feed = await call(
      'GET',
      `/api/events?q=${encodeURIComponent(`Тестовое событие ${run}`)}`,
    );
    expect(feed.json().items.some((e: { id: string }) => e.id === ids.event)).toBe(false);
    const card = await call('GET', `/api/events/${ids.event}`);
    expect([card.statusCode, card.json().error.code]).toEqual([404, 'EVENT_UNAVAILABLE']);

    const again = await call('POST', `/api/admin/events/${ids.event}/unpublish`, 'admin', {
      reason,
    });
    expect(again.json().error.code).toBe('EVENT_NOT_PUBLISHED');
  });

  it('удаление снятого события; повторно — 409', async () => {
    const reason = 'Повторное нарушение правил';
    const res = await call('POST', `/api/admin/events/${ids.event}/delete`, 'admin', { reason });
    expect(res.json()).toMatchObject({ status: 'deleted', moderationReason: reason });
    expect(res.json().history.map((h: { action: string }) => h.action)).toEqual([
      'event.delete',
      'event.unpublish',
    ]);
    const again = await call('POST', `/api/admin/events/${ids.event}/delete`, 'admin', { reason });
    expect(again.json().error.code).toBe('EVENT_ALREADY_DELETED');
  });

  it('скрытие комментария: админ видит текст и причину, повторно — 409', async () => {
    const reason = 'Реклама, не относится к мероприятию';
    const res = await call('POST', `/api/admin/comments/${ids.comment}/hide`, 'admin', { reason });
    expect(res.statusCode).toBe(200);
    expect(res.json().comments).toEqual([
      expect.objectContaining({
        id: ids.comment,
        isHidden: true,
        hiddenReason: reason,
        text: 'Реклама не по теме',
      }),
    ]);
    const again = await call('POST', `/api/admin/comments/${ids.comment}/hide`, 'admin', {
      reason,
    });
    expect(again.json().error.code).toBe('COMMENT_ALREADY_HIDDEN');
  });
});
