// Каталог видов спорта и интересы пользователей. Владелец: участник 1 (sports, profiles).
import { relations, sql } from 'drizzle-orm';
import { boolean, check, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './common';
import { events } from './events';
import { users } from './users';
import { sportVenueTypes } from './venues';

export const sports = pgTable(
  'sports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    // Нормализованное имя (DATA_MODEL: «Нормализация своего вида спорта»).
    // Уникальность slug не даёт создать «Футбол» и «футбол » дважды.
    slug: text('slug').notNull(),
    isCustom: boolean('is_custom').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sports_slug_uq').on(t.slug),
    check('sports_name_len_chk', sql`char_length(${t.name}) between 2 and 40`),
    check('sports_slug_lower_chk', sql`${t.slug} = lower(${t.slug}) and ${t.slug} <> ''`),
    // У стартового списка автора нет, у добавленного пользователем — есть.
    check('sports_custom_author_chk', sql`not ${t.isCustom} or ${t.createdBy} is not null`),
  ],
);

export const userSports = pgTable(
  'user_sports',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sportId] })],
);

export const sportsRelations = relations(sports, ({ one, many }) => ({
  creator: one(users, { fields: [sports.createdBy], references: [users.id] }),
  events: many(events),
  venueTypes: many(sportVenueTypes),
}));

export const userSportsRelations = relations(userSports, ({ one }) => ({
  user: one(users, { fields: [userSports.userId], references: [users.id] }),
  sport: one(sports, { fields: [userSports.sportId], references: [sports.id] }),
}));
