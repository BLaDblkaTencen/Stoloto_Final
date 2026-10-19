// Подписи типов площадок (docs/DATA_MODEL.md) и ответ GET /api/venue-types.
import { VENUE_TYPES } from '../../db/schema/common';
import type { VenueType } from './types';

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

export interface VenueTypesResponse {
  types: { value: VenueType; label: string }[];
  /** Ключа нет у вида спорта без подсказки (свой вариант): подсвечивать нечего. */
  bySport: Record<string, VenueType[]>;
}

export function buildVenueTypesResponse(
  links: readonly { sportId: string; venueType: VenueType }[],
): VenueTypesResponse {
  const bySport: Record<string, VenueType[]> = {};
  for (const { sportId, venueType } of links) {
    const list = (bySport[sportId] ??= []);
    if (!list.includes(venueType)) list.push(venueType);
  }
  return {
    types: VENUE_TYPES.map((value) => ({ value, label: VENUE_TYPE_LABELS[value] })),
    bySport,
  };
}
