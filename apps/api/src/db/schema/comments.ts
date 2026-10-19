// Обсуждение под мероприятием. Владелец: участник 1 (comments).
// Ответ организатора — обычный комментарий с parent_id; отдельной таблицы ответов нет.
// Поля скрытия (is_hidden, hidden_by, hidden_reason) меняет только модуль admin.
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt } from './common';
import { events } from './events';
import { users } from './users';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Глубина ответов — 1: ответ на ответ сервер привязывает к корневому комментарию.
    // Колонка стоит перед event_id намеренно: порядок колонок составного ключа ниже должен
    // совпадать с порядком в таблице, иначе pnpm db:push пересоздаёт ключ при каждом запуске.
    parentId: uuid('parent_id'),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    text: text('text').notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    hiddenBy: uuid('hidden_by').references(() => users.id),
    hiddenReason: text('hidden_reason'),
    createdAt: createdAt(),
  },
  (t) => [
    // Нужен для ключа ниже: ответ не может оказаться под чужим мероприятием.
    unique('comments_id_event_uq').on(t.id, t.eventId),
    foreignKey({
      name: 'comments_parent_same_event_fk',
      columns: [t.parentId, t.eventId],
      foreignColumns: [t.id, t.eventId],
    }),
    index('comments_event_created_idx').on(t.eventId, t.createdAt),
    check('comments_text_len_chk', sql`char_length(btrim(${t.text})) between 1 and 1000`),
    check('comments_not_self_parent_chk', sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
    check('comments_hidden_by_chk', sql`not ${t.isHidden} or ${t.hiddenBy} is not null`),
  ],
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  event: one(events, { fields: [comments.eventId], references: [events.id] }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
    relationName: 'comment_author',
  }),
  hider: one(users, {
    fields: [comments.hiddenBy],
    references: [users.id],
    relationName: 'comment_hider',
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'comment_replies',
  }),
  replies: many(comments, { relationName: 'comment_replies' }),
}));
