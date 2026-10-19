// Модерация мероприятий и комментариев (задачи 3.5, 3.6). Владелец: участник 3.
// Поля модерации событий и комментариев меняет только этот модуль — DATA_MODEL.md,
// «Кто меняет данные». События и комментарии физически не удаляются: только статус.
import type {
  AdminEventDetails,
  AdminEventItem,
  adminEventsQuery,
  AdminList,
} from '@sport/shared/schemas/admin';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { PgSelect } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { db } from '../../db/client';
import { comments, events, organizations, registrations, sports, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { historyOf, writeAudit } from './audit';
import { containsPattern } from './search';

const eventNotFound = () => new AppError(404, 'EVENT_NOT_FOUND', 'Мероприятие не найдено');

const itemColumns = {
  id: events.id,
  title: events.title,
  startsAt: events.startsAt,
  status: events.status,
  joinMode: events.joinMode,
  moderationReason: events.moderationReason,
  moderatedAt: events.moderatedAt,
  sportId: sports.id,
  sportName: sports.name,
  organizationId: organizations.id,
  organizationName: organizations.name,
  authorId: users.id,
  authorName: users.name,
  participantsCount: sql<number>`(select count(*)::int from ${registrations} where ${registrations.eventId} = ${events.id} and ${registrations.status} = 'confirmed')`,
  commentsCount: sql<number>`(select count(*)::int from ${comments} where ${comments.eventId} = ${events.id})`,
};

type ItemRow = {
  id: string;
  title: string;
  startsAt: Date;
  status: AdminEventItem['status'];
  joinMode: AdminEventItem['joinMode'];
  moderationReason: string | null;
  moderatedAt: Date | null;
  sportId: string;
  sportName: string;
  organizationId: string | null;
  organizationName: string | null;
  authorId: string;
  authorName: string;
  participantsCount: number;
  commentsCount: number;
};

const toItem = (row: ItemRow): AdminEventItem => ({
  id: row.id,
  title: row.title,
  sport: { id: row.sportId, name: row.sportName },
  startsAt: row.startsAt.toISOString(),
  status: row.status,
  joinMode: row.joinMode,
  // Как в карточке события: от имени организации — показываем организацию, иначе автора.
  organizer:
    row.organizationId && row.organizationName
      ? { type: 'organization', id: row.organizationId, name: row.organizationName }
      : { type: 'user', id: row.authorId, name: row.authorName },
  participantsCount: row.participantsCount,
  commentsCount: row.commentsCount,
  moderationReason: row.moderationReason,
  moderatedAt: row.moderatedAt?.toISOString() ?? null,
});

/** Таблицы, из которых собирается строка списка: вид спорта, автор и организация. */
function withRelations<T extends PgSelect>(query: T) {
  return query
    .innerJoin(sports, eq(sports.id, events.sportId))
    .innerJoin(users, eq(users.id, events.createdBy))
    .leftJoin(organizations, eq(organizations.id, events.organizationId));
}

/** Все мероприятия, включая снятые и удалённые; новые сверху. */
export async function listEvents(
  query: z.output<typeof adminEventsQuery>,
): Promise<AdminList<AdminEventItem>> {
  const pattern = query.q ? containsPattern(query.q) : undefined;
  const where = and(
    query.status ? eq(events.status, query.status) : undefined,
    pattern
      ? or(
          ilike(events.title, pattern),
          ilike(users.name, pattern),
          ilike(organizations.name, pattern),
        )
      : undefined,
  );
  const [rows, [totalRow]] = await Promise.all([
    withRelations(db.select(itemColumns).from(events).$dynamic())
      .where(where)
      .orderBy(desc(events.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    withRelations(db.select({ total: count() }).from(events).$dynamic()).where(where),
  ]);
  return { items: (rows as ItemRow[]).map(toItem), total: totalRow?.total ?? 0 };
}

export async function getEvent(id: string): Promise<AdminEventDetails> {
  const [row] = await withRelations(
    db
      .select({ ...itemColumns, description: events.description, address: events.address })
      .from(events)
      .$dynamic(),
  ).where(eq(events.id, id));
  if (!row) throw eventNotFound();

  const [eventComments, history] = await Promise.all([
    db
      .select({
        id: comments.id,
        parentId: comments.parentId,
        authorId: users.id,
        authorName: users.name,
        text: comments.text,
        isHidden: comments.isHidden,
        hiddenReason: comments.hiddenReason,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.eventId, id))
      .orderBy(asc(comments.createdAt)),
    historyOf('event', id),
  ]);

  return {
    ...toItem(row as ItemRow),
    description: row.description,
    address: row.address,
    comments: eventComments.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      author: { id: c.authorId, name: c.authorName },
      text: c.text,
      isHidden: c.isHidden,
      hiddenReason: c.hiddenReason,
      createdAt: c.createdAt.toISOString(),
    })),
    history,
  };
}

/** Снять с публикации: события нет в ленте, записаться нельзя; записи сохраняются. */
export async function unpublishEvent(adminId: string, id: string, reason: string) {
  return moderateEvent(adminId, id, reason, 'unpublished');
}

/** Удалить: как снятие, но окончательно; строка остаётся для истории и записавшихся. */
export async function deleteEvent(adminId: string, id: string, reason: string) {
  return moderateEvent(adminId, id, reason, 'deleted');
}

async function moderateEvent(
  adminId: string,
  id: string,
  reason: string,
  status: 'unpublished' | 'deleted',
) {
  await db.transaction(async (tx) => {
    const [event] = await tx
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, id))
      .for('update');
    if (!event) throw eventNotFound();
    if (status === 'unpublished' && event.status !== 'published') {
      throw new AppError(
        409,
        'EVENT_NOT_PUBLISHED',
        'Мероприятие уже снято с публикации или удалено',
      );
    }
    if (status === 'deleted' && event.status === 'deleted') {
      throw new AppError(409, 'EVENT_ALREADY_DELETED', 'Мероприятие уже удалено');
    }

    await tx
      .update(events)
      .set({ status, moderationReason: reason, moderatedBy: adminId, moderatedAt: new Date() })
      .where(eq(events.id, id));
    await writeAudit(tx, {
      actorId: adminId,
      action: status === 'unpublished' ? 'event.unpublish' : 'event.delete',
      targetType: 'event',
      targetId: id,
      reason,
    });
  });
  return getEvent(id);
}

/** Скрыть сообщение: вместо текста все видят «Сообщение скрыто модератором». */
export async function hideComment(adminId: string, id: string, reason: string) {
  const eventId = await db.transaction(async (tx) => {
    const [comment] = await tx
      .select({ isHidden: comments.isHidden, eventId: comments.eventId })
      .from(comments)
      .where(eq(comments.id, id))
      .for('update');
    if (!comment) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Сообщение не найдено');
    if (comment.isHidden) {
      throw new AppError(409, 'COMMENT_ALREADY_HIDDEN', 'Сообщение уже скрыто');
    }

    await tx
      .update(comments)
      .set({ isHidden: true, hiddenBy: adminId, hiddenReason: reason })
      .where(eq(comments.id, id));
    await writeAudit(tx, {
      actorId: adminId,
      action: 'comment.hide',
      targetType: 'comment',
      targetId: id,
      reason,
    });
    return comment.eventId;
  });
  return getEvent(eventId);
}
