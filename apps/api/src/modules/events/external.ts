// Стыки модуля events с модулями участника 2 (organizations, venues).
// ВРЕМЕННО, пока их функции не в main (docs/REQUESTS.md): здесь только чтение их таблиц по правилам
// и с кодами ошибок из docs/api/organizations.md. После мёржа feature/org-organizations тело
// publishingOrganizationId заменяется вызовом resolvePublishingOrganization, а findVenue — функцией venues.
import type { EventVenue } from '@sport/shared/schemas/events';
import { eq } from 'drizzle-orm';
import type { Db, Tx } from '../../db/client';
import { organizations, venues } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { SessionUser } from '../auth/session';

/** Организация, от имени которой аккаунт organization публикует событие; должна быть допущена. */
export async function publishingOrganizationId(tx: Tx, user: SessionUser): Promise<string> {
  const [org] = await tx
    .select({
      id: organizations.id,
      status: organizations.status,
      rejectionReason: organizations.rejectionReason,
    })
    .from(organizations)
    .where(eq(organizations.ownerId, user.id));
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
  return org.id;
}

/** Площадка в форме Venue участника 2; null, если её нет. */
export async function findVenue(executor: Db | Tx, venueId: string): Promise<EventVenue | null> {
  const [row] = await executor.select().from(venues).where(eq(venues.id, venueId));
  if (!row) return null;
  const hasContact = row.contactName || row.contactPhone || row.contactNote;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    workingHours: row.workingHours,
    contact: hasContact
      ? { name: row.contactName, phone: row.contactPhone, note: row.contactNote }
      : null,
  };
}
