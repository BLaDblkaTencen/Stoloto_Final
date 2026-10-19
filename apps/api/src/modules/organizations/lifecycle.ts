// Жизненный цикл организации: что можно создать, как подать заявку повторно, кто что видит.
// Решение по заявке (approve/reject) принимает только модуль admin (участник 3): здесь его нет.
import { AppError } from '../../lib/errors';
import type {
  ActingUser,
  OrganizationOwnerDto,
  OrganizationPublicDto,
  OrganizationRecord,
  SportRef,
} from './types';

/** Название без лишних пробелов по краям и внутри. Регистр сохраняем: в БД уникальность по lower(name). */
export function normalizeOrgName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Ключ сравнения названий, как в уникальном индексе допущенных организаций. */
export function orgNameKey(name: string): string {
  return normalizeOrgName(name).toLowerCase();
}

export function assertCanCreateOrganization(
  user: ActingUser,
  existing: OrganizationRecord | null,
): void {
  if (user.role !== 'organization') {
    throw new AppError(
      403,
      'WRONG_ROLE',
      'Создать организацию может только аккаунт, зарегистрированный как организация',
    );
  }
  if (existing) {
    throw new AppError(409, 'ORG_ALREADY_EXISTS', 'У вашего аккаунта уже есть организация');
  }
}

/** Изменения полей при повторной подаче заявки. Допустимо только из статуса rejected. */
export function buildResubmitChanges(org: OrganizationRecord): {
  status: 'pending';
  rejectionReason: null;
  reviewedBy: null;
  reviewedAt: null;
} {
  if (org.status !== 'rejected') {
    throw new AppError(
      409,
      'ORG_NOT_REJECTED',
      'Подать заявку заново можно только после отклонения',
    );
  }
  return { status: 'pending', rejectionReason: null, reviewedBy: null, reviewedAt: null };
}

export type OrganizationView = 'public' | 'owner';

/**
 * Какой вид организации показать зрителю.
 * Допущенная видна всем в публичном виде; владельцу и админу — в расширенном.
 * Чужую недопущенную не раскрываем: 404, как будто её нет.
 */
export function selectOrganizationView(
  org: OrganizationRecord,
  viewer: ActingUser | null,
): OrganizationView {
  const isOwner = viewer !== null && viewer.id === org.ownerId;
  const isAdmin = viewer?.role === 'admin';
  if (isOwner || isAdmin) return 'owner';
  if (org.status === 'approved') return 'public';
  throw new AppError(404, 'ORG_NOT_FOUND', 'Организация не найдена');
}

export function toOrganizationPublic(
  org: OrganizationRecord,
  sports: SportRef[],
): OrganizationPublicDto {
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

export function toOrganizationOwner(
  org: OrganizationRecord,
  sports: SportRef[],
): OrganizationOwnerDto {
  return {
    ...toOrganizationPublic(org, sports),
    ownerId: org.ownerId,
    status: org.status,
    // Причина отказа существует только у отклонённой заявки.
    rejectionReason: org.status === 'rejected' ? org.rejectionReason : null,
    reviewedAt: org.reviewedAt ? org.reviewedAt.toISOString() : null,
  };
}

/** Подписи статусов для интерфейса: единые, из docs/DATA_MODEL.md. */
export const ORG_STATUS_LABELS = {
  pending: 'На рассмотрении',
  approved: 'Допущена',
  rejected: 'Отклонена',
} as const;
