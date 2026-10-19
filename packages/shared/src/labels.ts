// Подписи для интерфейса — единые для всех экранов, совпадают с docs/DATA_MODEL.md
// («Подписи статусов в интерфейсе»). Бейджи статусов берут их отсюда.
import type {
  EventLevel,
  EventStatus,
  JoinMode,
  OrgStatus,
  RegistrationStatus,
  UserRole,
  VenueType,
} from './enums';

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  cafe: 'Кафе',
  club: 'Клуб',
  field: 'Поле',
  hall: 'Зал',
  pool: 'Бассейн',
  park: 'Парк',
  yard: 'Двор',
  other: 'Другое',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Участник',
  organization: 'Организация',
  admin: 'Администратор',
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  confirmed: 'Вы записаны',
  pending: 'Заявка ждёт решения',
  rejected: 'Заявка отклонена',
  cancelled: 'Запись отменена',
};

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  pending: 'На рассмотрении',
  approved: 'Допущена',
  rejected: 'Отклонена',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  published: 'Опубликовано',
  unpublished: 'Снято с публикации',
  deleted: 'Удалено',
};

export const JOIN_MODE_LABELS: Record<JoinMode, string> = {
  free: 'Свободная запись',
  request: 'По заявке',
};

export const EVENT_LEVEL_LABELS: Record<EventLevel, string> = {
  any: 'Любой уровень',
  beginner: 'Для новичков',
  amateur: 'Любители',
  pro: 'Профессионалы',
};
