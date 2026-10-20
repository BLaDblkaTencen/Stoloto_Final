// Мероприятия: лента, карточка, создание и правка (задачи 1.2–1.5). Владелец: участник 1.
// Контракт — docs/api/events.md, правила — DATA_MODEL.md и rules.ts.
import type {
  CreateEventData,
  EventDetails,
  EventListItem,
  EventListQuery,
  EventMapItem,
  ListResponse,
  MyEventItem,
  MyEventsQuery,
  UpdateEventData,
} from '@sport/shared/schemas/events';
import { and, asc, count, desc, eq, gt, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { events, registrations, sports, users } from '../../db/schema';
import { AppError, errors } from '../../lib/errors';
import type { SessionUser } from '../auth/session';
import { attendanceStates, organizerSummary } from '../reviews/service';
import { resolveSport } from '../sports/service';
import {
  findVenue,
  locateAddress,
  publishingOrganizationId,
  resolveVenueForEvent,
} from './external';
import { confirmedCount, feedConditions, selectEvents, toListItem } from './queries';
import {
  canSeeChat,
  canSeeEvent,
  canSeeParticipants,
  eventPermissions,
  isPast,
  joinDenial,
  type Viewer,
} from './rules';

export const eventNotFound = () => new AppError(404, 'EVENT_NOT_FOUND', 'Событие не найдено');
export const eventHidden = () => new AppError(404, 'EVENT_UNAVAILABLE', 'Событие недоступно');

/** id события из пути; не UUID — такого события нет (404, а не 422 и не ошибка базы). */
export function eventIdFrom(params: unknown): string {
  const result = z.object({ id: z.uuid() }).safeParse(params);
  if (!result.success) throw eventNotFound();
  return result.data.id;
}

export async function listEvents(
  query: EventListQuery,
  viewer: Viewer,
): Promise<ListResponse<EventListItem>> {
  const where = feedConditions(query, new Date());
  const [rows, [{ total }]] = await Promise.all([
    selectEvents(viewer?.id ?? null)
      .where(where)
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: count() })
      .from(events)
      .innerJoin(sports, eq(sports.id, events.sportId))
      .where(where),
  ]);
  return { items: rows.map(toListItem), total };
}

/** Компактные метки для карты событий участника 2: только события с точкой на карте. */
export async function listMapEvents(query: EventListQuery): Promise<ListResponse<EventMapItem>> {
  const where = and(feedConditions(query, new Date()), isNotNull(events.lat));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        sportId: events.sportId,
        startsAt: events.startsAt,
        joinMode: events.joinMode,
        lat: events.lat,
        lng: events.lng,
        venueId: events.venueId,
        participantsCount: confirmedCount,
        capacity: events.capacity,
      })
      .from(events)
      .innerJoin(sports, eq(sports.id, events.sportId))
      .where(where)
      .orderBy(asc(events.startsAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: count() })
      .from(events)
      .innerJoin(sports, eq(sports.id, events.sportId))
      .where(where),
  ]);
  return { items: rows.map((row) => ({ ...row, startsAt: row.startsAt.toISOString() })), total };
}

export async function getEventDetails(id: string, viewer: Viewer): Promise<EventDetails> {
  const [row] = await selectEvents(viewer?.id ?? null).where(eq(events.id, id));
  if (!row) throw eventNotFound();
  const myStatus = row.myStatus ?? null;
  if (!canSeeEvent(row, viewer, myStatus)) throw eventHidden();

  const now = new Date();
  const [[texts], participants, venue, organizerRating] = await Promise.all([
    db
      .select({
        description: events.description,
        placeNotes: events.placeNotes,
        requirements: events.requirements,
        chatUrl: events.chatUrl,
      })
      .from(events)
      .where(eq(events.id, id)),
    canSeeParticipants(row, viewer, myStatus)
      ? db
          .select({ id: users.id, name: users.name })
          .from(registrations)
          .innerJoin(users, eq(users.id, registrations.userId))
          .where(and(eq(registrations.eventId, id), eq(registrations.status, 'confirmed')))
          .orderBy(asc(registrations.createdAt))
      : null,
    row.venueId ? findVenue(row.venueId) : null,
    organizerSummary(
      row.organizationId
        ? { type: 'organization', id: row.organizationId }
        : { type: 'user', id: row.createdBy },
      now,
    ),
  ]);
  const denial = joinDenial(row, viewer, myStatus, row.participantsCount, now);

  return {
    ...toListItem(row),
    description: texts.description,
    placeNotes: texts.placeNotes,
    requirements: texts.requirements,
    venue,
    status: row.status,
    moderationReason: row.status === 'published' ? null : row.moderationReason,
    isPast: isPast(row, now),
    chatUrl: canSeeChat(row, viewer, myStatus) ? texts.chatUrl : null,
    participants,
    permissions: eventPermissions(row, viewer, myStatus, row.participantsCount, now),
    joinBlock: denial && { code: denial.code, message: denial.message },
    organizerRating,
  };
}

/** События, которые я организую, включая снятые: для «Моих мероприятий» и кабинета организации. */
export async function listMyEvents(
  query: MyEventsQuery,
  user: SessionUser,
): Promise<ListResponse<MyEventItem>> {
  const now = new Date();
  const upcoming = query.scope === 'upcoming';
  const where = and(
    eq(events.createdBy, user.id),
    upcoming ? gt(events.startsAt, now) : lte(events.startsAt, now),
  );
  const [rows, [{ total }]] = await Promise.all([
    selectEvents(user.id)
      .where(where)
      .orderBy(upcoming ? asc(events.startsAt) : desc(events.startsAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(events).where(where),
  ]);
  // Счётчик заявок — группировкой по registrations. Подзапрос в запросе к одной таблице events
  // Drizzle собирает без имён таблиц ("event_id" = "id"), и он считал бы всегда 0.
  const counts = rows.length
    ? await db
        .select({ id: registrations.eventId, pending: count() })
        .from(registrations)
        .where(
          and(
            inArray(
              registrations.eventId,
              rows.map((row) => row.id),
            ),
            eq(registrations.status, 'pending'),
          ),
        )
        .groupBy(registrations.eventId)
    : [];
  const pendingById = new Map(counts.map((c) => [c.id, c.pending]));
  const attendance = upcoming ? new Map() : await attendanceStates(rows, now);
  return {
    items: rows.map((row) => ({
      ...toListItem(row),
      status: row.status,
      moderationReason: row.status === 'published' ? null : row.moderationReason,
      pendingCount: pendingById.get(row.id) ?? 0,
      attendance: attendance.get(row.id) ?? null,
    })),
    total,
  };
}

/** Место события: площадка из справочника (её координаты и, если не введён, адрес) или своя точка. */
async function resolvePlace(
  input:
    | { venueId: string; address?: string }
    | { venueId: null; address: string; lat: number | null; lng: number | null },
) {
  if (input.venueId === null) return input;
  const venue = await resolveVenueForEvent(input.venueId);
  return {
    venueId: venue.id,
    address: input.address ?? venue.address,
    lat: venue.lat,
    lng: venue.lng,
  };
}

/**
 * Своя точка без координат (вписали только адрес): ищем адрес на карте (участник 2), чтобы
 * встреча попала на карту. До транзакции: внешний запрос не должен держать её открытой.
 */
async function locateIfNoPoint(address: string | undefined, lat: number | null | undefined) {
  return lat == null && address ? locateAddress(address) : null;
}

const startsInFuture = (startsAt: Date) => {
  if (startsAt.getTime() <= Date.now()) {
    throw errors.validation({ startsAt: 'Начало должно быть в будущем' });
  }
};

/** Создать событие. Аккаунт организации публикует только от имени своей допущенной организации. */
export async function createEvent(input: CreateEventData, user: SessionUser): Promise<string> {
  startsInFuture(input.startsAt);
  const located = input.venueId ? null : await locateIfNoPoint(input.address, input.lat);
  return db.transaction(async (tx) => {
    const sport = await resolveSport(tx, input, user.id);
    const organizationId =
      user.role === 'organization' ? await publishingOrganizationId(tx, user) : null;
    const place = await resolvePlace(
      input.venueId
        ? { venueId: input.venueId, address: input.address }
        : {
            venueId: null,
            // Без площадки адрес обязателен: это проверила схема createEventSchema.
            address: input.address ?? '',
            lat: input.lat ?? located?.lat ?? null,
            lng: input.lng ?? located?.lng ?? null,
          },
    );
    const [created] = await tx
      .insert(events)
      .values({
        title: input.title,
        description: input.description,
        sportId: sport.id,
        createdBy: user.id,
        organizationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        ...place,
        placeNotes: input.placeNotes ?? null,
        joinMode: input.joinMode,
        level: input.level ?? 'any',
        requirements: input.requirements ?? null,
        capacity: input.capacity ?? null,
        chatUrl: input.chatUrl ?? null,
      })
      .returning({ id: events.id });
    return created.id;
  });
}

/**
 * Правка события автором. Условия, на которые люди уже записались, молча не меняем:
 * лимит не ниже числа участников, режим записи — только пока записей нет.
 */
export async function updateEvent(id: string, input: UpdateEventData, user: SessionUser) {
  const located = input.venueId ? null : await locateIfNoPoint(input.address, input.lat);
  await db.transaction(async (tx) => {
    // Блокировка строки: параллельная запись не проскочит между проверкой лимита и правкой.
    const [current] = await tx.select().from(events).where(eq(events.id, id)).for('update');
    if (!current) throw eventNotFound();
    if (current.createdBy !== user.id) {
      throw new AppError(403, 'NOT_EVENT_AUTHOR', 'Это может сделать только организатор события');
    }
    if (current.status !== 'published') {
      throw new AppError(
        409,
        'EVENT_UNAVAILABLE',
        'Событие снято с публикации, править его нельзя',
      );
    }
    if (isPast(current, new Date())) {
      throw new AppError(409, 'EVENT_PAST', 'Событие уже прошло');
    }

    const startsAt = input.startsAt ?? current.startsAt;
    const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt;
    if (input.startsAt) startsInFuture(input.startsAt);
    if (endsAt && endsAt <= startsAt) {
      throw errors.validation({ endsAt: 'Окончание должно быть позже начала' });
    }

    const [{ confirmed, active }] = await tx
      .select({
        confirmed: sql<number>`count(*) filter (where ${registrations.status} = 'confirmed')::int`,
        active: sql<number>`count(*) filter (where ${registrations.status} in ('confirmed', 'pending'))::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, id));
    if (input.capacity != null && input.capacity < confirmed) {
      throw new AppError(
        409,
        'CAPACITY_BELOW_PARTICIPANTS',
        `Уже записано ${confirmed}: лимит не может быть меньше`,
      );
    }
    if (input.joinMode && input.joinMode !== current.joinMode && active > 0) {
      throw new AppError(
        409,
        'JOIN_MODE_LOCKED',
        'Режим записи нельзя менять, когда уже есть записи',
      );
    }

    const sportId =
      input.sportId || input.sportName ? (await resolveSport(tx, input, user.id)).id : undefined;

    // Место: новая площадка задаёт координаты; без площадки — своя точка или прежняя.
    const venueId = input.venueId !== undefined ? input.venueId : current.venueId;
    const place = venueId
      ? await resolvePlace({
          venueId,
          address: input.address ?? (venueId === current.venueId ? current.address : undefined),
        })
      : {
          venueId: null,
          address: input.address ?? current.address,
          lat: (input.lat !== undefined ? input.lat : current.lat) ?? located?.lat ?? null,
          lng: (input.lng !== undefined ? input.lng : current.lng) ?? located?.lng ?? null,
        };

    await tx
      .update(events)
      .set({
        title: input.title,
        description: input.description,
        sportId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ...place,
        placeNotes: input.placeNotes,
        joinMode: input.joinMode,
        level: input.level,
        requirements: input.requirements,
        capacity: input.capacity,
        chatUrl: input.chatUrl,
        registrationClosed: input.registrationClosed,
      })
      .where(eq(events.id, id));
  });
}
