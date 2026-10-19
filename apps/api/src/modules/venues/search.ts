// Поиск площадок без обращения к базе (задача 2.8). Справочник небольшой и меняется только сидом,
// поэтому сервис держит его в памяти, а фильтры применяются здесь.
import type { VenueType } from '@sport/shared';
import {
  inBbox,
  VENUE_TYPE_LABELS,
  type Venue,
  type VenueCard,
  type VenuesQuery,
  type VenueTypesResponse,
} from '@sport/shared/schemas/venues';
import { VENUE_TYPES } from '@sport/shared';
import type { venues } from '../../db/schema';

export type VenueRow = typeof venues.$inferSelect;
export type SportVenueLink = { sportId: string; venueType: VenueType };

const collator = new Intl.Collator('ru');

/** Контакт показываем, только если заполнено хотя бы одно поле. */
export function toVenueCard(row: VenueRow): VenueCard {
  const hasContact = Boolean(row.contactName || row.contactPhone || row.contactNote);
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

/**
 * Подходит ли тип площадки виду спорта.
 * У вида спорта без подсказки (свой вариант) подходят все площадки: подсвечивать нечего.
 */
export function isSuitable(type: VenueType, sportTypes: readonly VenueType[]): boolean {
  return sportTypes.length === 0 || sportTypes.includes(type);
}

/** Подходящие типы для вида спорта; undefined, если вид спорта не выбран. */
export function sportTypesFor(
  links: readonly SportVenueLink[],
  sportId: string | undefined,
): VenueType[] | undefined {
  if (!sportId) return undefined;
  return links.filter((link) => link.sportId === sportId).map((link) => link.venueType);
}

export function searchVenues(
  rows: readonly VenueRow[],
  query: Omit<VenuesQuery, 'sportId'>,
  sportTypes?: readonly VenueType[],
): Venue[] {
  const text = query.q?.toLowerCase();
  const types = query.type?.length ? new Set(query.type) : null;

  const result: Venue[] = [];
  for (const row of rows) {
    if (types && !types.has(row.type)) continue;
    if (query.bbox && !inBbox(row, query.bbox)) continue;
    if (text && !`${row.name} ${row.address}`.toLowerCase().includes(text)) continue;

    if (sportTypes === undefined) {
      result.push(toVenueCard(row));
      continue;
    }
    const suitable = isSuitable(row.type, sportTypes);
    if (query.onlySuitable && !suitable) continue;
    result.push({ ...toVenueCard(row), suitable });
  }

  // Подходящие виду спорта первыми, дальше по названию.
  result.sort((a, b) =>
    a.suitable !== b.suitable ? (a.suitable ? -1 : 1) : collator.compare(a.name, b.name),
  );
  return result.slice(0, query.limit);
}

export function buildVenueTypes(links: readonly SportVenueLink[]): VenueTypesResponse {
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
