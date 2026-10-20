// Загрузка демо-данных. Владелец: участник 3 (seed, задача 3.7). Сами данные — в data.ts.
// SEED_VERSION поднимаем при каждом изменении данных. На деплое (SEED_ON_START=true) сервер
// пересоздаёт данные только при новой версии, поэтому перезапуск не стирает созданное экспертами.
// Сид идёт до того, как сервер начал принимать запросы, поэтому кэши модулей (площадки) ещё пусты.
import { randomUUID } from 'node:crypto';
import { DEMO_PASSWORD } from '@sport/shared';
import { normalizeSportName, sportSlug } from '@sport/shared/schemas/sports';
import { eq, getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { hashPassword } from '../../modules/auth/password';
import type { Db } from '../client';
import * as schema from '../schema';
import {
  COMMENTS,
  CUSTOM_SPORT,
  EVENTS,
  ORGANIZATIONS,
  REGISTRATIONS,
  REVIEWS,
  SPORTS,
  USERS,
  VENUES,
  type UserKey,
} from './data';
import { daysAgo, HOUR, krasnoyarskTime } from './time';

export const SEED_VERSION = 3;
const VERSION_KEY = 'seed_version';

/** Стереть все данные и наполнить базу заново. */
export async function seed(db: Db, now = new Date()) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Идентификаторы раздаём заранее, чтобы связывать записи по ключам из data.ts.
  const userId = Object.fromEntries(Object.keys(USERS).map((key) => [key, randomUUID()])) as Record<
    UserKey,
    string
  >;
  const sportId = new Map<string, string>();
  const venueById = new Map(VENUES.map((venue) => [venue.key, { ...venue, id: randomUUID() }]));
  const orgId = new Map(ORGANIZATIONS.map((org) => [org.key, randomUUID()]));
  const eventId = new Map(EVENTS.map((event) => [event.key, randomUUID()]));
  const admin = userId.admin;
  // Начало и конец каждого события: прошедшим записи и отзывы ставим во времени до и после них.
  const startOf = new Map(
    EVENTS.map((event) => [event.key, krasnoyarskTime(event.when.days, event.when.time, now)]),
  );
  const endOf = (key: string) => {
    const event = EVENTS.find((item) => item.key === key)!;
    return new Date(need(startOf, key).getTime() + (event.when.hours ?? 1) * HOUR);
  };
  /** Не позже of минус days дней: прошедшее событие создано и записано до своего начала. */
  const before = (of: Date, days: number) =>
    new Date(Math.min(daysAgo(now, days).getTime(), of.getTime() - days * 24 * HOUR));
  const need = <T>(map: Map<string, T>, key: string) => {
    const value = map.get(key);
    if (value === undefined) throw new Error(`В демо-данных нет ключа «${key}»`);
    return value;
  };

  await db.transaction(async (tx) => {
    const tables = Object.values(schema as Record<string, unknown>)
      .filter((value): value is PgTable => is(value, PgTable))
      .map((table) => `"${getTableName(table)}"`);
    await tx.execute(sql.raw(`truncate table ${tables.join(', ')} restart identity cascade`));

    await tx.insert(schema.users).values(
      Object.entries(USERS).map(([key, user]) => ({
        id: userId[key as UserKey],
        ...user,
        city: 'Красноярск',
        passwordHash,
        isDemo: true,
      })),
    );

    const sportRows = [
      ...SPORTS.map(({ name }) => ({ name, isCustom: false, createdBy: null })),
      {
        name: normalizeSportName(CUSTOM_SPORT.name),
        isCustom: true,
        createdBy: userId[CUSTOM_SPORT.createdBy],
      },
    ].map((sport) => {
      const id = randomUUID();
      sportId.set(sport.name, id);
      return { id, slug: sportSlug(sport.name), ...sport };
    });
    await tx.insert(schema.sports).values(sportRows);
    await tx
      .insert(schema.sportVenueTypes)
      .values(
        SPORTS.flatMap(({ name, venueTypes }) =>
          venueTypes.map((venueType) => ({ sportId: need(sportId, name), venueType })),
        ),
      );
    await tx.insert(schema.userSports).values([
      { userId: userId.user1, sportId: need(sportId, 'Бег') },
      { userId: userId.user1, sportId: need(sportId, 'Футбол') },
      { userId: userId.user2, sportId: need(sportId, 'Йога') },
      { userId: userId.user2, sportId: need(sportId, 'Плавание') },
      { userId: userId.user3, sportId: need(sportId, 'Настольный теннис') },
      { userId: userId.user3, sportId: need(sportId, 'Баскетбол') },
    ]);

    await tx
      .insert(schema.venues)
      .values([...venueById.values()].map(({ key: _key, ...venue }) => venue));

    await tx.insert(schema.organizations).values(
      ORGANIZATIONS.map((org) => ({
        id: need(orgId, org.key),
        ownerId: userId[org.owner],
        name: org.name,
        activity: org.activity,
        description: org.description,
        contacts: org.contacts,
        city: 'Красноярск',
        status: org.status,
        rejectionReason: org.rejectionReason ?? null,
        reviewedBy: org.status === 'pending' ? null : admin,
        reviewedAt: org.status === 'pending' ? null : daysAgo(now, 2),
        createdAt: daysAgo(now, 5),
      })),
    );
    await tx.insert(schema.organizationSports).values(
      ORGANIZATIONS.flatMap((org) =>
        org.sports.map((sport) => ({
          organizationId: need(orgId, org.key),
          sportId: need(sportId, sport),
        })),
      ),
    );

    await tx.insert(schema.events).values(
      EVENTS.map((event) => {
        const venue = event.venue ? need(venueById, event.venue) : undefined;
        const start = need(startOf, event.key);
        return {
          id: need(eventId, event.key),
          title: event.title,
          description: event.description,
          sportId: need(sportId, event.sport),
          createdBy: userId[event.author],
          organizationId: event.organization ? need(orgId, event.organization) : null,
          startsAt: start,
          endsAt: event.when.hours ? new Date(start.getTime() + event.when.hours * HOUR) : null,
          // Площадка подставляет в событие свой адрес и координаты (DATA_MODEL, Venue).
          address: venue?.address ?? event.address!,
          venueId: venue?.id ?? null,
          lat: venue?.lat ?? event.point?.lat ?? null,
          lng: venue?.lng ?? event.point?.lng ?? null,
          placeNotes: event.placeNotes ?? null,
          joinMode: event.joinMode,
          level: event.level,
          requirements: event.requirements ?? null,
          capacity: event.capacity ?? null,
          chatUrl: event.chatUrl ?? null,
          status: event.unpublishedReason ? ('unpublished' as const) : ('published' as const),
          moderationReason: event.unpublishedReason ?? null,
          moderatedBy: event.unpublishedReason ? admin : null,
          moderatedAt: event.unpublishedReason ? daysAgo(now, 1) : null,
          createdAt: before(start, 3),
        };
      }),
    );

    const authorOf = new Map(EVENTS.map((event) => [event.key, userId[event.author]]));
    const modeOf = new Map(EVENTS.map((event) => [event.key, event.joinMode]));
    await tx.insert(schema.registrations).values(
      REGISTRATIONS.map(([event, user, status, message]) => {
        // Решение принимал автор события: по заявке — и подтверждение, и отказ.
        const decided =
          status === 'rejected' || (status === 'confirmed' && modeOf.get(event) === 'request');
        return {
          eventId: need(eventId, event),
          userId: userId[user],
          status,
          message: message ?? null,
          decidedBy: decided ? need(authorOf, event) : null,
          decidedAt: decided ? before(need(startOf, event), 1) : null,
          createdAt: before(need(startOf, event), 2),
        };
      }),
    );

    // Отзывы: участник — об организаторе встречи (клубе, если встреча от его имени),
    // организатор — об участнике. Время — через пару часов после конца встречи.
    const orgOf = new Map(EVENTS.map((event) => [event.key, event.organization]));
    if (REVIEWS.length) {
      await tx.insert(schema.reviews).values(
        REVIEWS.map((review) => {
          const org = orgOf.get(review.event);
          const at = new Date(
            Math.min(now.getTime(), endOf(review.event).getTime() + (review.about ? 2 : 3) * HOUR),
          );
          return {
            eventId: need(eventId, review.event),
            authorId: userId[review.author],
            direction: review.about
              ? ('organizer_to_participant' as const)
              : ('participant_to_organizer' as const),
            targetUserId: review.about
              ? userId[review.about]
              : org
                ? null
                : need(authorOf, review.event),
            targetOrgId: !review.about && org ? need(orgId, org) : null,
            attended: review.about ? (review.attended ?? true) : null,
            rating: review.rating ?? null,
            tags: review.tags ?? [],
            comment: review.comment ?? null,
            createdAt: at,
            updatedAt: at,
          };
        }),
      );
    }

    let minute = 0;
    const commentRows = COMMENTS.flatMap((comment) => {
      const id = randomUUID();
      // Разное время, чтобы ответы шли после вопросов.
      const at = () => new Date(daysAgo(now, 1).getTime() + ++minute * 60_000);
      return [
        {
          id,
          eventId: need(eventId, comment.event),
          authorId: userId[comment.author],
          parentId: null,
          text: comment.text,
          isHidden: Boolean(comment.hiddenReason),
          hiddenBy: comment.hiddenReason ? admin : null,
          hiddenReason: comment.hiddenReason ?? null,
          createdAt: at(),
        },
        ...(comment.replies ?? []).map((reply) => ({
          id: randomUUID(),
          eventId: need(eventId, comment.event),
          authorId: userId[reply.author],
          parentId: id,
          text: reply.text,
          isHidden: false,
          hiddenBy: null,
          hiddenReason: null,
          createdAt: at(),
        })),
      ];
    });
    await tx.insert(schema.comments).values(commentRows);

    // Журнал согласован с данными: каждое решение администратора выше записано в audit_log.
    await tx.insert(schema.auditLog).values([
      ...ORGANIZATIONS.filter((org) => org.status !== 'pending').map((org) => ({
        actorId: admin,
        action: org.status === 'approved' ? ('org.approve' as const) : ('org.reject' as const),
        targetType: 'organization' as const,
        targetId: need(orgId, org.key),
        reason: org.rejectionReason ?? null,
        createdAt: daysAgo(now, 2),
      })),
      ...EVENTS.filter((event) => event.unpublishedReason).map((event) => ({
        actorId: admin,
        action: 'event.unpublish' as const,
        targetType: 'event' as const,
        targetId: need(eventId, event.key),
        reason: event.unpublishedReason!,
        createdAt: daysAgo(now, 1),
      })),
      ...commentRows
        .filter((comment) => comment.isHidden)
        .map((comment) => ({
          actorId: admin,
          action: 'comment.hide' as const,
          targetType: 'comment' as const,
          targetId: comment.id,
          reason: comment.hiddenReason,
          createdAt: daysAgo(now, 1),
        })),
    ]);

    await tx
      .insert(schema.appMeta)
      .values({ key: VERSION_KEY, value: String(SEED_VERSION) })
      .onConflictDoUpdate({ target: schema.appMeta.key, set: { value: String(SEED_VERSION) } });
  });
}

/** Наполнить базу, только если демо-данные в коде новее записанных. Возвращает true, если наполнял. */
export async function seedIfOutdated(db: Db) {
  const [row] = await db
    .select({ value: schema.appMeta.value })
    .from(schema.appMeta)
    .where(eq(schema.appMeta.key, VERSION_KEY));
  if (row && Number(row.value) >= SEED_VERSION) return false;
  await seed(db);
  return true;
}
