// Обсуждение под мероприятием (задача 1.8, сценарий 5 ТЗ). Владелец: участник 1.
// Ответ организатора — обычный комментарий с parentId, отдельной сущности нет (DATA_MODEL).
// Скрывает сообщения модуль admin (участник 3); здесь скрытый текст просто не отдаём.
import type { Comment } from '@sport/shared/schemas/comments';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { comments, events, organizations, registrations, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { SessionUser } from '../auth/session';
import { canSeeEvent, type Viewer } from '../events/rules';
import { eventHidden, eventNotFound } from '../events/service';
import { buildThread, toComment } from './thread';

/** Событие с тем, что нужно обсуждению: видимость, автор и название организации для плашки. */
async function loadEvent(eventId: string, viewer: Viewer) {
  const [event] = await db
    .select({
      status: events.status,
      startsAt: events.startsAt,
      createdBy: events.createdBy,
      joinMode: events.joinMode,
      capacity: events.capacity,
      registrationClosed: events.registrationClosed,
      organizationName: organizations.name,
    })
    .from(events)
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .where(eq(events.id, eventId));
  if (!event) throw eventNotFound();

  const [mine] = viewer
    ? await db
        .select({ status: registrations.status })
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, viewer.id)))
    : [];
  // Обсуждение видно тем же, кому видно событие: снятое — организатору, записавшимся и админу.
  if (!canSeeEvent(event, viewer, mine?.status ?? null)) throw eventHidden();
  return event;
}

const rowColumns = {
  id: comments.id,
  parentId: comments.parentId,
  text: comments.text,
  isHidden: comments.isHidden,
  createdAt: comments.createdAt,
  authorId: users.id,
  authorName: users.name,
  authorRole: users.role,
};

/** Обсуждение события: первые сообщения веток по времени, в каждом — ответы по времени. */
export async function listComments(eventId: string, viewer: Viewer): Promise<Comment[]> {
  const event = await loadEvent(eventId, viewer);
  const rows = await db
    .select(rowColumns)
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.eventId, eventId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  return buildThread(rows, event);
}

/** Написать вопрос или ответ. Писать может любой вошедший, в том числе не записанный (ТЗ). */
export async function addComment(
  eventId: string,
  user: SessionUser,
  input: { text: string; parentId?: string | null },
): Promise<Comment> {
  const event = await loadEvent(eventId, user);
  if (event.status !== 'published') {
    throw new AppError(
      409,
      'EVENT_UNAVAILABLE',
      'Событие снято с публикации, писать в обсуждение нельзя',
    );
  }

  let parentId: string | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId })
      .from(comments)
      .where(and(eq(comments.id, input.parentId), eq(comments.eventId, eventId)));
    if (!parent) {
      const message = 'Сообщение для ответа не найдено';
      throw new AppError(422, 'VALIDATION_ERROR', message, { parentId: message });
    }
    // Глубина ответов — 1: ответ на ответ встаёт в ту же ветку.
    parentId = parent.parentId ?? parent.id;
  }

  const [created] = await db
    .insert(comments)
    .values({ eventId, authorId: user.id, parentId, text: input.text })
    .returning({
      id: comments.id,
      parentId: comments.parentId,
      text: comments.text,
      isHidden: comments.isHidden,
      createdAt: comments.createdAt,
    });
  return toComment(
    { ...created, authorId: user.id, authorName: user.name, authorRole: user.role },
    event,
  );
}
