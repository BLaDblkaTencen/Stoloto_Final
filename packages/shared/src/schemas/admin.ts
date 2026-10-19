// Админка: допуск организаций, модерация мероприятий и комментариев. Владелец: участник 3.
// Формы запросов для сервера и интерфейса и типы ответов. Контракт — docs/api/core.md.
import { z } from 'zod';
import {
  EVENT_STATUSES,
  ORG_STATUSES,
  type AuditAction,
  type EventStatus,
  type JoinMode,
  type OrgStatus,
} from '../enums';

export const MODERATION_REASON = { min: 5, max: 500 } as const;

/** Причина отказа, снятия, удаления или скрытия: её увидит организатор или автор. */
export const moderationReasonBody = z.object({
  reason: z
    .string({ error: 'Укажите причину' })
    .trim()
    .min(MODERATION_REASON.min, 'Опишите причину подробнее: её увидит организатор')
    .max(MODERATION_REASON.max, `Причина — не длиннее ${MODERATION_REASON.max} символов`),
});
export type ModerationReasonBody = z.infer<typeof moderationReasonBody>;

const listParams = {
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

export const adminOrganizationsQuery = z.object({
  status: z.enum(ORG_STATUSES).optional(),
  ...listParams,
});
export const adminEventsQuery = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  ...listParams,
});

export type AdminOrganizationsQuery = z.input<typeof adminOrganizationsQuery>;
export type AdminEventsQuery = z.input<typeof adminEventsQuery>;

type Person = { id: string; name: string };

/** Запись журнала решений администратора. */
export type AuditEntry = {
  action: AuditAction;
  reason: string | null;
  actor: Person;
  createdAt: string;
};

export type AdminOrganizationItem = {
  id: string;
  name: string;
  activity: string;
  city: string | null;
  status: OrgStatus;
  owner: Person & { email: string };
  createdAt: string;
  reviewedAt: string | null;
  eventsCount: number;
};

export type AdminOrganizationDetails = AdminOrganizationItem & {
  description: string;
  contacts: string | null;
  sports: Person[];
  rejectionReason: string | null;
  events: { id: string; title: string; startsAt: string; status: EventStatus }[];
  history: AuditEntry[];
};

export type AdminEventItem = {
  id: string;
  title: string;
  sport: Person;
  startsAt: string;
  status: EventStatus;
  joinMode: JoinMode;
  /** Организация, если событие от её имени, иначе автор. */
  organizer: Person & { type: 'organization' | 'user' };
  participantsCount: number;
  commentsCount: number;
  moderationReason: string | null;
  moderatedAt: string | null;
};

/** Комментарий для модерации: администратор видит текст и скрытых сообщений. */
export type AdminComment = {
  id: string;
  parentId: string | null;
  author: Person;
  text: string;
  isHidden: boolean;
  hiddenReason: string | null;
  createdAt: string;
};

export type AdminEventDetails = AdminEventItem & {
  description: string;
  address: string;
  comments: AdminComment[];
  history: AuditEntry[];
};

export type AdminList<T> = { items: T[]; total: number };
