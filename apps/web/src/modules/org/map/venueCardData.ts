// API отдаёт контакт площадки вложенным объектом (VenueCard / EventVenue), а карточка VenueCard
// из shared/ui ждёт плоские поля. Переходник нужен и в форме события, и в карточке события.
import type { VenueCard as VenueInfo } from '@sport/shared/schemas/venues';
import type { VenueCardData } from '../../../shared/ui';

export function venueCardData(venue: VenueInfo): VenueCardData {
  return {
    name: venue.name,
    type: venue.type,
    address: venue.address,
    description: venue.description,
    workingHours: venue.workingHours,
    contactName: venue.contact?.name ?? null,
    contactPhone: venue.contact?.phone ?? null,
    contactNote: venue.contact?.note ?? null,
  };
}
