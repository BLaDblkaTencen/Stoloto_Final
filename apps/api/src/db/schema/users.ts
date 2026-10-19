// Пользователи и сессии. Владелец: участник 3 (auth).
import { relations, sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, tz, userRole } from './common';
import { comments } from './comments';
import { events } from './events';
import { registrations } from './registrations';
import { userSports } from './sports';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Роль admin выдаёт только сид: эндпоинт регистрации принимает лишь user и organization.
    role: userRole('role').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    about: text('about'),
    city: text('city'),
    avatarUrl: text('avatar_url'),
    createdAt: createdAt(),
  },
  (t) => [
    // Логин без учёта регистра: Ivan@Mail.ru и ivan@mail.ru — один аккаунт.
    uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    check('users_name_len_chk', sql`char_length(btrim(${t.name})) between 1 and 80`),
    check('users_email_format_chk', sql`position('@' in ${t.email}) > 1`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    // SHA-256 от случайного токена; сам токен есть только в cookie пользователя.
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: tz('expires_at').notNull(),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId),
    check('sessions_expiry_chk', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  sportInterests: many(userSports),
  createdEvents: many(events, { relationName: 'event_author' }),
  registrations: many(registrations, { relationName: 'registration_user' }),
  comments: many(comments, { relationName: 'comment_author' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
