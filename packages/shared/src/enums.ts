// Значения статусов и перечислений — единые для базы, сервера и интерфейса.
// Совпадают с docs/DATA_MODEL.md. Схема БД (apps/api/src/db/schema/common.ts) строит из них
// перечисления PostgreSQL, Zod-схемы модулей — валидацию, интерфейс — подписи и фильтры.

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

export type UserRole = (typeof USER_ROLES)[number];
export type OrgStatus = (typeof ORG_STATUSES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type JoinMode = (typeof JOIN_MODES)[number];
export type EventLevel = (typeof EVENT_LEVELS)[number];
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export type VenueType = (typeof VENUE_TYPES)[number];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditTarget = (typeof AUDIT_TARGETS)[number];
