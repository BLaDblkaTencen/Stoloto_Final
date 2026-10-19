// Типы модуля организаций. Значения перечислений берутся из схемы БД, чтобы не расходиться с ней.
import type { ORG_STATUSES, USER_ROLES } from '../../db/schema/common';

export type OrganizationStatus = (typeof ORG_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];

/** Кто делает запрос: берётся из сессии на сервере, не из тела запроса. */
export interface ActingUser {
  id: string;
  role: UserRole;
}

/** Строка организации так, как её отдаёт слой данных. */
export interface OrganizationRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  activity: string;
  city: string | null;
  contacts: string | null;
  status: OrganizationStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface SportRef {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationPublicDto {
  id: string;
  name: string;
  description: string;
  activity: string;
  city: string | null;
  contacts: string | null;
  sports: SportRef[];
  createdAt: string;
}

export interface OrganizationOwnerDto extends OrganizationPublicDto {
  ownerId: string;
  status: OrganizationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

/** Читающий интерфейс, который реализует слой данных (Drizzle) и подменяют в тестах. */
export interface OrganizationReader {
  findByOwnerId(ownerId: string): Promise<OrganizationRecord | null>;
}
