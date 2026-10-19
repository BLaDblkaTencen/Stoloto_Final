// Стыки модуля events с модулями участника 2 (organizations, venues): правила допуска организации
// и справочник площадок живут у них, здесь только вызовы. Коды ошибок — docs/api/organizations.md.
import type { Tx } from '../../db/client';
import type { SessionUser } from '../auth/session';
import { resolvePublishingOrganization } from '../organizations/service';

export { findVenueCard as findVenue, resolveVenueForEvent } from '../venues/service';

/** Организация, от имени которой аккаунт organization публикует событие; должна быть допущена. */
export async function publishingOrganizationId(tx: Tx, user: SessionUser): Promise<string> {
  return (await resolvePublishingOrganization(user, tx)).organizationId;
}
