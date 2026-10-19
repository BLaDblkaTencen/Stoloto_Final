// Правила модуля организаций без обращения к базе: их проверяют тесты, сервис только вызывает.
// Решение по заявке (approve / reject) принимает модуль admin (участник 3), здесь его нет.
import type { UserRole } from '@sport/shared';
import type {
  OrganizationOwner,
  OrganizationPublic,
  SportRef,
} from '@sport/shared/schemas/organizations';
import type { organizations } from '../../db/schema';
import { AppError } from '../../lib/errors';

export type OrganizationRow = typeof organizations.$inferSelect;
export type Viewer = { id: string; role: UserRole } | null;

/** Ключ сравнения названий: как уникальный индекс lower(name) среди допущенных. */
export const orgNameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const orgNotFound = () => new AppError(404, 'ORG_NOT_FOUND', 'Организация не найдена');

/**
 * Можно ли публиковать событие от имени этой организации (задача 2.6).
 * Возвращает id и название для events.organization_id и подписи организатора.
 */
export function checkPublishing(org: OrganizationRow | null): {
  organizationId: string;
  name: string;
} {
  if (!org) {
    throw new AppError(
      404,
      'ORG_NOT_FOUND',
      'Сначала подайте заявку на допуск организации, затем можно публиковать события',
    );
  }
  if (org.status === 'pending') {
    throw new AppError(
      403,
      'ORG_NOT_APPROVED',
      'Заявка на рассмотрении, публиковать события пока нельзя',
    );
  }
  if (org.status === 'rejected') {
    const reason = org.rejectionReason?.trim();
    throw new AppError(
      403,
      'ORG_NOT_APPROVED',
      reason
        ? `Заявка отклонена: ${reason}. Исправьте данные и подайте заявку заново`
        : 'Заявка отклонена. Исправьте данные и подайте заявку заново',
    );
  }
  return { organizationId: org.id, name: org.name };
}

export const notRejected = () =>
  new AppError(409, 'ORG_NOT_REJECTED', 'Подать заявку заново можно только после отклонения');

/** Поля при повторной подаче заявки; допустимо только из rejected. */
export function resubmitChanges(org: OrganizationRow) {
  if (org.status !== 'rejected') throw notRejected();
  return {
    status: 'pending' as const,
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
  };
}

/**
 * Какой вид показать. Владельцу и админу — расширенный, остальным — публичный и только допущенную.
 * Чужую недопущенную не раскрываем: 404, как будто её нет.
 */
export function selectView(org: OrganizationRow, viewer: Viewer): 'public' | 'owner' {
  if (viewer && (viewer.id === org.ownerId || viewer.role === 'admin')) return 'owner';
  if (org.status === 'approved') return 'public';
  throw orgNotFound();
}

export function toPublic(org: OrganizationRow, sports: SportRef[]): OrganizationPublic {
  return {
    id: org.id,
    name: org.name,
    description: org.description,
    activity: org.activity,
    city: org.city,
    contacts: org.contacts,
    sports,
    createdAt: org.createdAt.toISOString(),
  };
}

export function toOwner(org: OrganizationRow, sports: SportRef[]): OrganizationOwner {
  return {
    ...toPublic(org, sports),
    ownerId: org.ownerId,
    status: org.status,
    // Причина существует только у отклонённой заявки, даже если в строке осталась старая.
    rejectionReason: org.status === 'rejected' ? org.rejectionReason : null,
    reviewedAt: org.reviewedAt?.toISOString() ?? null,
  };
}
