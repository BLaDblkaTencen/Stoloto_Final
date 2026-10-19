// Обсуждение под мероприятием: проверка запросов и типы API. Владелец: участник 1.
// Контракт — docs/api/events.md, раздел «Обсуждение».
import { z } from 'zod';

export const COMMENT_MAX = 1000;

export const createCommentSchema = z.object({
  text: z
    .string({ error: 'Напишите сообщение' })
    .trim()
    .min(1, 'Напишите сообщение')
    .max(COMMENT_MAX, `Сообщение — не длиннее ${COMMENT_MAX} символов`),
  /** Ответ на сообщение; ответ на ответ сервер прикрепляет к первому сообщению ветки. */
  parentId: z.uuid('Сообщение для ответа не найдено').nullish(),
});

export type CommentInput = z.input<typeof createCommentSchema>;

export type CommentAuthor = {
  id: string;
  name: string;
  /** Автор события — «Организатор» (или название организации), админ — «Модератор». */
  badge: 'organizer' | 'moderator' | null;
  badgeLabel: string | null;
};

export type Comment = {
  id: string;
  parentId: string | null;
  author: CommentAuthor;
  /** null, если скрыто модератором: показываем «Сообщение скрыто модератором». */
  text: string | null;
  isHidden: boolean;
  createdAt: string;
  /** Ответы по времени; у самих ответов пусто. */
  replies: Comment[];
};
