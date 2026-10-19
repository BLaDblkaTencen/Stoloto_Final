// Общие перечисления и колонки. Владелец: участник 3 (core).
// Значения перечислений берутся из packages/shared: один источник для базы, сервера и интерфейса.
import {
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  EVENT_LEVELS,
  EVENT_STATUSES,
  JOIN_MODES,
  ORG_STATUSES,
  REGISTRATION_STATUSES,
  USER_ROLES,
  VENUE_TYPES,
} from '@sport/shared';
import { pgEnum, timestamp } from 'drizzle-orm/pg-core';

// Те же массивы доступны и отсюда: на них уже опирается код модулей. В новом коде
// импортируйте их из '@sport/shared'.
export {
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  EVENT_LEVELS,
  EVENT_STATUSES,
  JOIN_MODES,
  ORG_STATUSES,
  REGISTRATION_STATUSES,
  USER_ROLES,
  VENUE_TYPES,
};

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
