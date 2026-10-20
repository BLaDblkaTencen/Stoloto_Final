// Отзывы после встречи. Владелец: участник 1 (reviews).
// Одна таблица на оба направления: участник → организатор (звёзды обязательны) и
// организатор → участник (обязательна отметка «пришёл»). Итоги — оценка, надёжность — не хранятся,
// а считаются запросом в modules/reviews: так их не нужно пересчитывать после каждой правки.
import { REVIEW_DIRECTIONS } from '@sport/shared/schemas/reviews';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './common';
import { events } from './events';
import { organizations } from './organizations';
import { users } from './users';

export const reviewDirection = pgEnum('review_direction', REVIEW_DIRECTIONS);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    /** Кто оставил. За клуб — его аккаунт (автор события). */
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    direction: reviewDirection('direction').notNull(),
    /** О ком отзыв: о человеке или о клубе, ровно одно из двух. */
    targetUserId: uuid('target_user_id').references(() => users.id),
    targetOrgId: uuid('target_org_id').references(() => organizations.id),
    attended: boolean('attended'),
    rating: smallint('rating'),
    // Без default: drizzle-kit видит значение по умолчанию у массива иначе, чем база, и правил бы его при каждом push.
    tags: text('tags').array().notNull(),
    comment: text('comment'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Один отзыв от человека о встрече и одна отметка организатора о каждом участнике.
    // Две пары, а не одна с обеими целями: пустая цель (null) в уникальности не сравнивается.
    unique('reviews_user_once_uq').on(t.eventId, t.authorId, t.targetUserId),
    unique('reviews_org_once_uq').on(t.eventId, t.authorId, t.targetOrgId),
    index('reviews_target_user_idx').on(t.targetUserId),
    index('reviews_target_org_idx').on(t.targetOrgId),
    index('reviews_event_idx').on(t.eventId),
    check('reviews_target_chk', sql`(${t.targetUserId} is null) <> (${t.targetOrgId} is null)`),
    check('reviews_rating_chk', sql`${t.rating} is null or ${t.rating} between 1 and 5`),
    // Участник ставит звёзды и не отмечает явку; организатор отмечает явку и только о людях.
    check(
      'reviews_direction_chk',
      sql`(${t.direction} = 'participant_to_organizer' and ${t.rating} is not null and ${t.attended} is null)
        or (${t.direction} = 'organizer_to_participant' and ${t.attended} is not null and ${t.targetUserId} is not null)`,
    ),
    check('reviews_comment_len_chk', sql`${t.comment} is null or char_length(${t.comment}) <= 500`),
  ],
);
