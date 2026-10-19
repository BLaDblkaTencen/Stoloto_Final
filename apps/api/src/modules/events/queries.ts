// Выборка мероприятий для ленты, карточки и «Моих мероприятий» и превращение строки в ответ API.
// Одна выборка на все экраны: организатор, вид спорта, число участников и моя запись считаются
// одинаково, поэтому лента и карточка не расходятся.
import {
  EVENT_TIMEZONE,
  type EventListItem,
  type EventListQuery,
} from '@sport/shared/schemas/events';
import { and, eq, gt, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client';
import { events, organizations, registrations, sports, users, venues } from '../../db/schema';
import { escapeLike, sportColumns } from '../sports/service';

/** Моя запись: отдельный псевдоним, чтобы не путать с подзапросами по registrations. */
const myRegistration = alias(registrations, 'my_registration');

// Только для запросов с join: в запросе к одной таблице Drizzle пишет колонки без имён таблиц,
// и условие превращается в "event_id" = "id" внутри registrations (всегда 0).
export const confirmedCount = sql<number>`(
  select count(*)::int from ${registrations}
  where ${registrations.eventId} = ${events.id} and ${registrations.status} = 'confirmed'
)`;

export const listFields = {
  id: events.id,
  title: events.title,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  address: events.address,
  venueId: events.venueId,
  lat: events.lat,
  lng: events.lng,
  joinMode: events.joinMode,
  level: events.level,
  capacity: events.capacity,
  status: events.status,
  moderationReason: events.moderationReason,
  createdBy: events.createdBy,
  organizationId: events.organizationId,
  sport: sportColumns,
  authorName: users.name,
  organizationName: organizations.name,
  participantsCount: confirmedCount,
  myStatus: myRegistration.status,
  myMessage: myRegistration.message,
  myCreatedAt: myRegistration.createdAt,
  myDecidedAt: myRegistration.decidedAt,
};

/** Мероприятия с организатором, видом спорта, числом участников и записью того, кто смотрит. */
export function selectEvents(viewerId: string | null) {
  return db
    .select(listFields)
    .from(events)
    .innerJoin(sports, eq(sports.id, events.sportId))
    .innerJoin(users, eq(users.id, events.createdBy))
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .leftJoin(
      myRegistration,
      and(
        eq(myRegistration.eventId, events.id),
        viewerId ? eq(myRegistration.userId, viewerId) : sql`false`,
      ),
    )
    .$dynamic();
}

/** Строка выборки с полями ленты; поля присоединённых слева таблиц Drizzle делает nullable сам. */
export type ListRow = Awaited<ReturnType<typeof selectEvents>>[number];

/** Начало дня по Красноярску: границы фильтра по дате не зависят от пояса сервера. */
const dayStart = (day: string) => sql`(${day}::date::timestamp at time zone ${EVENT_TIMEZONE})`;
const nextDayStart = (day: string) =>
  sql`((${day}::date + 1)::timestamp at time zone ${EVENT_TIMEZONE})`;

/** Условия ленты: только опубликованные и фильтры из запроса. */
export function feedConditions(query: EventListQuery, now: Date): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(events.status, 'published')];
  if (!query.includePast) conditions.push(gt(events.startsAt, now));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    conditions.push(
      or(
        // То же выражение, что в индексе events_fts_idx: русская морфология, «футбола» → «Футбол».
        sql`to_tsvector('russian', ${events.title} || ' ' || ${events.description}) @@ websearch_to_tsquery('russian', ${query.q})`,
        // По части слова: «фут» находит «Футбол», пока человек ещё печатает.
        ilike(events.title, pattern),
        ilike(sports.name, pattern),
      ),
    );
  }
  if (query.place) {
    // «Где»: адрес, пояснение к месту или название площадки («Динамо», «Татышев»).
    const pattern = `%${escapeLike(query.place)}%`;
    conditions.push(
      or(
        ilike(events.address, pattern),
        ilike(events.placeNotes, pattern),
        inArray(
          events.venueId,
          db.select({ id: venues.id }).from(venues).where(ilike(venues.name, pattern)),
        ),
      ),
    );
  }
  if (query.sportId?.length) conditions.push(inArray(events.sportId, query.sportId));
  if (query.organizationId) conditions.push(eq(events.organizationId, query.organizationId));
  if (query.dateFrom) conditions.push(sql`${events.startsAt} >= ${dayStart(query.dateFrom)}`);
  if (query.dateTo) conditions.push(sql`${events.startsAt} < ${nextDayStart(query.dateTo)}`);
  if (query.joinMode) conditions.push(eq(events.joinMode, query.joinMode));
  if (query.level) conditions.push(eq(events.level, query.level));
  if (query.bbox) {
    const { minLng, minLat, maxLng, maxLat } = query.bbox;
    conditions.push(
      gte(events.lat, minLat),
      lte(events.lat, maxLat),
      gte(events.lng, minLng),
      lte(events.lng, maxLng),
    );
  }
  return and(...conditions);
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toListItem(row: ListRow): EventListItem {
  return {
    id: row.id,
    title: row.title,
    sport: row.sport,
    startsAt: row.startsAt.toISOString(),
    endsAt: iso(row.endsAt),
    address: row.address,
    venueId: row.venueId,
    lat: row.lat,
    lng: row.lng,
    joinMode: row.joinMode,
    level: row.level,
    capacity: row.capacity,
    participantsCount: row.participantsCount,
    freeSlots: row.capacity === null ? null : Math.max(0, row.capacity - row.participantsCount),
    organizer: row.organizationId
      ? { type: 'organization', id: row.organizationId, name: row.organizationName ?? '' }
      : { type: 'user', id: row.createdBy, name: row.authorName },
    myRegistration:
      row.myStatus && row.myCreatedAt
        ? {
            status: row.myStatus,
            message: row.myMessage,
            createdAt: row.myCreatedAt.toISOString(),
            decidedAt: iso(row.myDecidedAt),
          }
        : null,
  };
}
