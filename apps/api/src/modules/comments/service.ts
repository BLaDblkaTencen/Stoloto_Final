// Обсуждение под мероприятием (задача 1.8). Владелец: участник 1.
// Читать может всякий, кто видит событие; писать — любой вошедший, но только под опубликованным.
// Скрытие сообщений — модуль admin (задача 3.6), здесь только показ заглушки.
import type { Comment, CommentBody } from '@sport/shared/schemas/comments';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { comments, events, users } from '../../db/schema';
import { AppError, errors } from '../../lib/errors';
import type { SessionUser } from '../auth/session';
import { selectEvents } from '../events/queries';
import { canSeeEvent, type Viewer } from '../events/rules';
import { eventHidden, eventNotFound } from '../events/service';
import { buildThread, toComment, type ThreadEvent } from './thread';

const commentColumns = {
  id: comments.id,
  parentId: comments.parentId,
  text: comments.text,
  isHidden: comments.isHidden,
  createdAt: comments.createdAt,
  authorId: users.id,
  authorName: users.name,
  authorRole: users.role,
};

/** Событие, если смотрящий его видит; те же правила и коды, что у карточки события. */
async function visibleEvent(eventId: string, viewer: Viewer) {
  const [row] = await selectEvents(viewer?.id ?? null).where(eq(events.id, eventId));
  if (!row) throw eventNotFound();
  if (!canSeeEvent(row, viewer, row.myStatus ?? null)) throw eventHidden();
  return row;
}

const threadEvent = (row: Awaited<ReturnType<typeof visibleEvent>>): ThreadEvent => ({
  createdBy: row.createdBy,
  organizationName: row.organizationId ? row.organizationName : null,
});

export async function listComments(eventId: string, viewer: Viewer): Promise<Comment[]> {
  const event = await visibleEvent(eventId, viewer);
  const rows = await db
    .select(commentColumns)
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.eventId, eventId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  return buildThread(rows, threadEvent(event));
}

export async function addComment(
  eventId: string,
  user: SessionUser,
  body: { text: string; parentId?: CommentBody['parentId'] },
): Promise<Comment> {
  const event = await visibleEvent(eventId, user);
  if (event.status !== 'published') {
    throw new AppError(
      409,
      'EVENT_UNAVAILABLE',
      'Публикация недоступна, писать в обсуждение нельзя',
    );
  }

  let parentId: string | null = null;
  if (body.parentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId })
      .from(comments)
      .where(and(eq(comments.id, body.parentId), eq(comments.eventId, eventId)));
    if (!parent) throw errors.validation({ parentId: 'Сообщение для ответа не найдено' });
    // Ответ на ответ попадает в ту же ветку: глубина обсуждения — 1.
    parentId = parent.parentId ?? parent.id;
  }

  const [created] = await db
    .insert(comments)
    .values({ eventId, authorId: user.id, text: body.text, parentId })
    .returning({ id: comments.id, createdAt: comments.createdAt });
  return toComment(
    {
      id: created.id,
      parentId,
      text: body.text,
      isHidden: false,
      createdAt: created.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
    },
    threadEvent(event),
  );
}
