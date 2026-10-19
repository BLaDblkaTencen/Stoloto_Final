// Сборка обсуждения из строк базы: плашки авторов, скрытые сообщения, ветки ответов.
// Чистые функции без базы, поэтому правила показа проверяются тестами без PostgreSQL.
import type { UserRole } from '@sport/shared';
import type { Comment } from '@sport/shared/schemas/comments';

export type CommentRow = {
  id: string;
  parentId: string | null;
  text: string;
  isHidden: boolean;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
};

/** Чьё событие: автор и организация, если событие от её имени. */
export type ThreadEvent = { createdBy: string; organizationName: string | null };

/** Плашка автора: автор события — организатор (или название организации), админ — модератор. */
export function authorBadge(
  author: { id: string; role: UserRole },
  event: ThreadEvent,
): Pick<Comment['author'], 'badge' | 'badgeLabel'> {
  if (author.id === event.createdBy) {
    return { badge: 'organizer', badgeLabel: event.organizationName ?? 'Организатор' };
  }
  if (author.role === 'admin') return { badge: 'moderator', badgeLabel: 'Модератор' };
  return { badge: null, badgeLabel: null };
}

/** Одно сообщение для API: текст скрытого не отдаём вовсе, а не только прячем в интерфейсе. */
export function toComment(row: CommentRow, event: ThreadEvent): Comment {
  return {
    id: row.id,
    parentId: row.parentId,
    author: {
      id: row.authorId,
      name: row.authorName,
      ...authorBadge({ id: row.authorId, role: row.authorRole }, event),
    },
    text: row.isHidden ? null : row.text,
    isHidden: row.isHidden,
    createdAt: row.createdAt.toISOString(),
    replies: [],
  };
}

/** Корневые сообщения по времени, у каждого ответы по времени. Строки уже упорядочены по времени. */
export function buildThread(rows: CommentRow[], event: ThreadEvent): Comment[] {
  const roots: Comment[] = [];
  const byId = new Map<string, Comment>();
  for (const row of rows) {
    if (row.parentId) continue;
    const comment = toComment(row, event);
    roots.push(comment);
    byId.set(comment.id, comment);
  }
  for (const row of rows) {
    if (!row.parentId) continue;
    // Глубина ответов — 1, это гарантирует сервис записи; ответ без корня не показываем.
    byId.get(row.parentId)?.replies.push(toComment(row, event));
  }
  return roots;
}
