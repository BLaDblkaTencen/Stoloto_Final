// Площадки и подходящие виду спорта типы площадок. Владелец: участник 2 (venues, map).
// Справочник наполняет только сид; создания площадок из интерфейса нет.
import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  uuid,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import { createdAt, venueType } from './common';
import { events } from './events';
import { sports } from './sports';

export const venues = pgTable(
  'venues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: venueType('type').notNull(),
    address: text('address').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    description: text('description'),
    workingHours: text('working_hours'),
    // Контакты вымышленные (демо-данные), показываются всем.
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactNote: text('contact_note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('venues_type_idx').on(t.type),
    index('venues_geo_idx').on(t.lat, t.lng),
    check('venues_lat_chk', sql`${t.lat} between -90 and 90`),
    check('venues_lng_chk', sql`${t.lng} between -180 and 180`),
  ],
);

// Таблица-связка Sport x VenueType лежит здесь: подсказку на карте делает участник 2.
// У «своего» вида спорта строк нет — карта показывает все площадки.
export const sportVenueTypes = pgTable(
  'sport_venue_types',
  {
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id, { onDelete: 'cascade' }),
    venueType: venueType('venue_type').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sportId, t.venueType] })],
);

export const venuesRelations = relations(venues, ({ many }) => ({
  events: many(events),
}));

export const sportVenueTypesRelations = relations(sportVenueTypes, ({ one }) => ({
  sport: one(sports, { fields: [sportVenueTypes.sportId], references: [sports.id] }),
}));
