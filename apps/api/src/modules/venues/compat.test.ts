// Стык с модулем events (участник 1): карточка площадки в событии должна совпадать с VenueCard,
// чтобы resolveVenueForEvent подставлялась вместо временного findVenue без преобразований.
import type { EventVenue } from '@sport/shared/schemas/events';
import type { VenueCard } from '@sport/shared/schemas/venues';
import { expectTypeOf, it } from 'vitest';

it('VenueCard и EventVenue — одна и та же форма', () => {
  expectTypeOf<VenueCard>().toEqualTypeOf<EventVenue>();
});
