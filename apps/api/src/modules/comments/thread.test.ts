import { describe, expect, it } from 'vitest';
import { authorBadge, buildThread, type CommentRow } from './thread';

const AUTHOR = 'author-1';
const event = { createdBy: AUTHOR, organizationName: null };

let minute = 0;
function row(patch: Partial<CommentRow> & { id: string }): CommentRow {
  minute += 1;
  return {
    parentId: null,
    text: `Текст ${patch.id}`,
    isHidden: false,
    createdAt: new Date(Date.UTC(2026, 9, 26, 10, minute)),
    authorId: 'user-1',
    authorName: 'Анна',
    authorRole: 'user',
    ...patch,
  };
}

describe('authorBadge', () => {
  it('автор события — организатор, у события организации — её название', () => {
    expect(authorBadge({ id: AUTHOR, role: 'user' }, event)).toEqual({
      badge: 'organizer',
      badgeLabel: 'Организатор',
    });
    expect(
      authorBadge(
        { id: AUTHOR, role: 'organization' },
        { ...event, organizationName: 'ФК Енисей' },
      ),
    ).toEqual({ badge: 'organizer', badgeLabel: 'ФК Енисей' });
  });

  it('админ — модератор, остальные без плашки', () => {
    expect(authorBadge({ id: 'admin-1', role: 'admin' }, event).badge).toBe('moderator');
    expect(authorBadge({ id: 'user-2', role: 'user' }, event)).toEqual({
      badge: null,
      badgeLabel: null,
    });
  });
});

describe('buildThread', () => {
  it('ответы попадают под свой корень, порядок по времени сохраняется', () => {
    const thread = buildThread(
      [
        row({ id: 'q1' }),
        row({ id: 'q2' }),
        row({ id: 'a1', parentId: 'q1', authorId: AUTHOR, authorName: 'Олег' }),
        row({ id: 'a2', parentId: 'q1' }),
      ],
      event,
    );
    expect(thread.map((c) => c.id)).toEqual(['q1', 'q2']);
    expect(thread[0].replies.map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(thread[0].replies[0].author.badge).toBe('organizer');
    expect(thread[1].replies).toEqual([]);
  });

  it('текст скрытого сообщения не уходит в ответ API', () => {
    const [comment] = buildThread([row({ id: 'q1', isHidden: true, text: 'Реклама' })], event);
    expect(comment.isHidden).toBe(true);
    expect(comment.text).toBeNull();
  });
});
