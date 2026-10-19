// Обсуждение под мероприятием: проверка запросов и типы ответов API. Владелец: участник 1.
// Контракт — docs/api/events.md, раздел «Обсуждение».
import { z } from 'zod';

export const COMMENT_MAX = 1000;

export const commentBodySchema = z.object({
  text: z
    .string({ error: 'Напишите сообщение' })
    .trim()
    .min(1, 'Напишите сообщение')
    .max(COMMENT_MAX, `Сообщение — не длиннее ${COMMENT_MAX} символов`),
  /** Ответ на сообщение; ответ на ответ сервер прикрепляет к корневому. */
  parentId: z.uuid('Сообщение для ответа не найдено').nullable().optional(),
});

export type CommentBody = z.input<typeof commentBodySchema>;

/** Плашка автора: автор события — «Организатор» (или название организации), админ — «Модератор». */
export type CommentBadge = 'organizer' | 'moderator';

export type Comment = {
  id: string;
  parentId: string | null;
  author: {
    id: string;
    name: string;
    badge: CommentBadge | null;
    badgeLabel: string | null;
  };
  /** null, если скрыто модератором: интерфейс пишет «Сообщение скрыто модератором». */
  text: string | null;
  isHidden: boolean;
  createdAt: string;
  /** Только у корневых; у ответов пустой массив. */
  replies: Comment[];
};
