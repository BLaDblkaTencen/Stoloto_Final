// Общие перечисления и колонки. Владелец: участник 3 (core).
// Значения совпадают с docs/DATA_MODEL.md. Массивы экспортируются, чтобы
// packages/shared строил из них Zod-схемы и подписи, а не копировал строки.
import { pgEnum, timestamp } from 'drizzle-orm/pg-core';

export const USER_ROLES = ['user', 'organization', 'admin'] as const;
export const ORG_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const EVENT_STATUSES = ['published', 'unpublished', 'deleted'] as const;
export const JOIN_MODES = ['free', 'request'] as const;
export const EVENT_LEVELS = ['any', 'beginner', 'amateur', 'pro'] as const;
export const REGISTRATION_STATUSES = ['confirmed', 'pending', 'rejected', 'cancelled'] as const;
export const VENUE_TYPES = [
  'cafe',
  'club',
  'field',
  'hall',
  'pool',
  'park',
  'yard',
  'other',
] as const;
export const AUDIT_ACTIONS = [
  'org.approve',
  'org.reject',
  'event.unpublish',
  'event.delete',
  'comment.hide',
] as const;
export const AUDIT_TARGETS = ['organization', 'event', 'comment'] as const;

export const userRole = pgEnum('user_role', USER_ROLES);
export const orgStatus = pgEnum('org_status', ORG_STATUSES);
export const eventStatus = pgEnum('event_status', EVENT_STATUSES);
export const joinMode = pgEnum('join_mode', JOIN_MODES);
export const eventLevel = pgEnum('event_level', EVENT_LEVELS);
export const registrationStatus = pgEnum('registration_status', REGISTRATION_STATUSES);
export const venueType = pgEnum('venue_type', VENUE_TYPES);
export const auditAction = pgEnum('audit_action', AUDIT_ACTIONS);
export const auditTarget = pgEnum('audit_target', AUDIT_TARGETS);

/** Время всегда в UTC (`timestamptz`). */
export const tz = (name: string) => timestamp(name, { withTimezone: true });
export const createdAt = () => tz('created_at').notNull().defaultNow();
export const updatedAt = () =>
  tz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
