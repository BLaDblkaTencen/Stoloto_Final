// Поиск площадок для карты (задача 2.8). Справочник небольшой (десятки или сотни записей),
// поэтому фильтры применяются к списку в памяти; слой данных отдаёт все площадки.
import { inBbox } from './geo';
import type { VenueDto, VenueQuery, VenueRecord, VenueType } from './types';

export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 500;

export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

/** Контакт показываем, только если заполнено хотя бы одно поле. */
export function toVenueDto(venue: VenueRecord, suitable?: boolean): VenueDto {
  const hasContact = Boolean(venue.contactName || venue.contactPhone || venue.contactNote);
  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    address: venue.address,
    lat: venue.lat,
    lng: venue.lng,
    description: venue.description,
    workingHours: venue.workingHours,
    contact: hasContact
      ? { name: venue.contactName, phone: venue.contactPhone, note: venue.contactNote }
      : null,
    ...(suitable === undefined ? {} : { suitable }),
  };
}

/**
 * Подходит ли тип площадки виду спорта.
 * У вида спорта без подсказки (свой вариант) подходят все площадки: подсвечивать нечего.
 */
export function isSuitable(type: VenueType, sportVenueTypes: readonly VenueType[]): boolean {
  return sportVenueTypes.length === 0 || sportVenueTypes.includes(type);
}

export function searchVenues(venues: readonly VenueRecord[], query: VenueQuery = {}): VenueDto[] {
  const sportSelected = query.sportVenueTypes !== undefined;
  const sportTypes = query.sportVenueTypes ?? [];
  const text = query.q?.trim().toLowerCase();
  const typeSet = query.types && query.types.length > 0 ? new Set(query.types) : null;

  const result: VenueDto[] = [];
  for (const venue of venues) {
    if (typeSet && !typeSet.has(venue.type)) continue;
    if (query.bbox && !inBbox(venue, query.bbox)) continue;
    if (text && !`${venue.name} ${venue.address}`.toLowerCase().includes(text)) continue;

    const suitable = sportSelected ? isSuitable(venue.type, sportTypes) : undefined;
    if (query.onlySuitable && suitable === false) continue;

    result.push(toVenueDto(venue, suitable));
  }

  // Подходящие виду спорта идут первыми, дальше по названию.
  result.sort((a, b) => {
    if (a.suitable !== b.suitable) return a.suitable ? -1 : 1;
    return a.name.localeCompare(b.name, 'ru');
  });

  return result.slice(0, normalizeLimit(query.limit));
}
