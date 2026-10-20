// Запись на мероприятия: проверка запросов и типы ответов API. Владелец: участник 1.
// Контракт — docs/api/events.md, раздел «Запись».
import { z } from 'zod';
import { REGISTRATION_STATUSES, type EventStatus, type RegistrationStatus } from '../enums';
import type { EventListItem } from './events';
import type { ParticipantSummary, ReviewState } from './reviews';

export const REGISTRATION_MESSAGE_MAX = 500;

/** Тело записи: сообщение организатору нужно только в режиме «по заявке». */
export const joinBodySchema = z
  .object({
    message: z
      .string()
      .trim()
      .max(REGISTRATION_MESSAGE_MAX, `Сообщение — не длиннее ${REGISTRATION_MESSAGE_MAX} символов`)
      .transform((value) => (value === '' ? null : value))
      .nullable()
      .optional(),
  })
  // Пустое тело или его отсутствие — обычная запись без сообщения.
  .nullish()
  .transform((body) => ({ message: body?.message ?? null }));

export type JoinBody = z.input<typeof joinBodySchema>;

export const myRegistrationsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MyRegistrationsQuery = z.output<typeof myRegistrationsQuerySchema>;

/** Событие в «Моих записях»: моя запись всегда есть, снятые события тоже показываем. */
export type MyRegistrationItem = EventListItem & {
  myRegistration: NonNullable<EventListItem['myRegistration']>;
  status: EventStatus;
  moderationReason: string | null;
  /** Только у прошедших встреч, где я был подтверждённым участником. */
  review: ReviewState | null;
};

// ---------- Панель организатора (участник 2 вызывает сервис напрямую) ----------

export const organizerRegistrationsQuerySchema = z.object({
  status: z.enum(REGISTRATION_STATUSES).optional(),
});

export const decisionSchema = z.object({
  decision: z.enum(['confirm', 'reject'], 'Выберите решение'),
});

export type Decision = z.infer<typeof decisionSchema>['decision'];

export type OrganizerRegistration = {
  id: string;
  status: RegistrationStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    about: string | null;
    /** Надёжность и оценка по прошлым встречам: помогает решить по заявке. */
    reliability: ParticipantSummary;
  };
};

export type OrganizerRegistrations = {
  items: OrganizerRegistration[];
  counts: Record<RegistrationStatus, number>;
  capacity: number | null;
};
