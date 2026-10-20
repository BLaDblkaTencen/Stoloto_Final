// Мероприятия. Владелец: участник 1 (events).
// Все поля заведены сразу, включая поля организации (задача 2.6), площадки (1.10) и модерации (3.5),
// чтобы трём участникам не приходилось править эту таблицу параллельно.
// Поля модерации (status, moderation_reason, moderated_by, moderated_at) меняет только модуль admin.
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, eventLevel, eventStatus, joinMode, tz, updatedAt } from './common';
import { comments } from './comments';
import { organizations } from './organizations';
import { registrations } from './registrations';
import { sports } from './sports';
import { users } from './users';
import { venues } from './venues';

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id),
    // Если задано, событие от имени организации. Составной ключ ниже гарантирует,
    // что created_by — представитель именно этой организации.
    // Что организация approved, проверяет сервер при создании (задача 2.4).
    // Колонка стоит перед created_by намеренно: drizzle-kit читает колонки составного ключа
    // в порядке таблицы, и при другом порядке pnpm db:push пересоздавал бы ключ при каждом запуске.
    organizationId: uuid('organization_id'),
    // Автор события. Только он рассматривает заявки (см. registrations_decider_fk).
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    startsAt: tz('starts_at').notNull(),
    endsAt: tz('ends_at'),
    // Адрес хранится текстом всегда: без карты событие создаётся и открывается как обычно.
    address: text('address').notNull(),
    venueId: uuid('venue_id').references(() => venues.id),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    placeNotes: text('place_notes'),
    joinMode: joinMode('join_mode').notNull(),
    level: eventLevel('level').notNull().default('any'),
    requirements: text('requirements'),
    capacity: integer('capacity'),
    // Организатор закрыл запись до начала: новых записей и заявок нет, записанные остаются,
    // ждущие заявки ещё можно рассмотреть. После начала запись закрыта и без этого флага.
    registrationClosed: boolean('registration_closed').notNull().default(false),
    chatUrl: text('chat_url'),
    status: eventStatus('status').notNull().default('published'),
    moderationReason: text('moderation_reason'),
    moderatedBy: uuid('moderated_by').references(() => users.id),
    moderatedAt: tz('moderated_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'events_org_owner_fk',
      columns: [t.organizationId, t.createdBy],
      foreignColumns: [organizations.id, organizations.ownerId],
    }),
    // Нужен для составного внешнего ключа registrations (event_id, decided_by).
    unique('events_id_author_uq').on(t.id, t.createdBy),
    index('events_status_starts_idx').on(t.status, t.startsAt),
    index('events_sport_idx').on(t.sportId),
    index('events_created_by_idx').on(t.createdBy),
    index('events_organization_idx').on(t.organizationId),
    index('events_geo_idx')
      .on(t.lat, t.lng)
      .where(sql`${t.status} = 'published'`),
    // Поиск по тексту: в запросе то же выражение, иначе индекс не используется:
    // to_tsvector('russian', title || ' ' || description) @@ websearch_to_tsquery('russian', $1)
    index('events_fts_idx').using(
      'gin',
      sql`to_tsvector('russian', ${t.title} || ' ' || ${t.description})`,
    ),
    check('events_title_len_chk', sql`char_length(btrim(${t.title})) between 3 and 100`),
    check('events_address_len_chk', sql`char_length(btrim(${t.address})) between 3 and 300`),
    check('events_period_chk', sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`),
    check('events_capacity_chk', sql`${t.capacity} is null or ${t.capacity} between 1 and 10000`),
    check('events_point_pair_chk', sql`(${t.lat} is null) = (${t.lng} is null)`),
    check('events_lat_chk', sql`${t.lat} is null or ${t.lat} between -90 and 90`),
    check('events_lng_chk', sql`${t.lng} is null or ${t.lng} between -180 and 180`),
    // Снятое или удалённое событие всегда несёт причину и автора решения: их видит организатор.
    check(
      'events_moderation_chk',
      sql`${t.status} = 'published' or (
        char_length(btrim(coalesce(${t.moderationReason}, ''))) > 0
        and ${t.moderatedBy} is not null
        and ${t.moderatedAt} is not null
      )`,
    ),
  ],
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  sport: one(sports, { fields: [events.sportId], references: [sports.id] }),
  author: one(users, {
    fields: [events.createdBy],
    references: [users.id],
    relationName: 'event_author',
  }),
  moderator: one(users, {
    fields: [events.moderatedBy],
    references: [users.id],
    relationName: 'event_moderator',
  }),
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  venue: one(venues, { fields: [events.venueId], references: [venues.id] }),
  registrations: many(registrations),
  comments: many(comments),
}));
