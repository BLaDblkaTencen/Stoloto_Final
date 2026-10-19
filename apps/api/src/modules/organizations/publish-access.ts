// Задача 2.6: можно ли публиковать событие от имени организации.
// Вызывается из POST /api/events (участник 1). Таблица исходов — docs/api/organizations.md.
// Сервер сам ставит events.organization_id; из тела запроса его не принимаем.
import { DomainError } from '../../lib/domain-error';
import type { ActingUser, OrganizationReader } from './types';

export async function resolvePublishingOrganization(
  reader: OrganizationReader,
  user: ActingUser,
): Promise<{ organizationId: string }> {
  if (user.role === 'admin') {
    throw new DomainError(403, 'WRONG_ROLE', 'Администратор не организует мероприятия');
  }
  if (user.role !== 'organization') {
    throw new DomainError(
      403,
      'WRONG_ROLE',
      'Публиковать от имени организации может только аккаунт организации',
    );
  }

  const org = await reader.findByOwnerId(user.id);
  if (!org) {
    throw new DomainError(
      404,
      'ORG_NOT_FOUND',
      'Сначала подайте заявку на допуск организации, затем можно публиковать события',
    );
  }

  if (org.status === 'pending') {
    throw new DomainError(
      403,
      'ORG_NOT_APPROVED',
      'Заявка на рассмотрении, публиковать события пока нельзя',
    );
  }
  if (org.status === 'rejected') {
    const reason = org.rejectionReason?.trim();
    throw new DomainError(
      403,
      'ORG_NOT_APPROVED',
      reason
        ? `Заявка отклонена: ${reason}. Исправьте данные и подайте заявку заново`
        : 'Заявка отклонена. Исправьте данные и подайте заявку заново',
    );
  }

  return { organizationId: org.id };
}
