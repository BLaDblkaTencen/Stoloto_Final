// Модуль venues: справочник площадок. Владелец: участник 2.
// Площадки меняет только сид, поэтому справочник читается из базы раз в минуту и держится в памяти:
// карта запрашивает площадки при каждом сдвиге, а база при этом не нагружается.
import type {
  Venue,
  VenueCard,
  VenuesQuery,
  VenueTypesResponse,
} from '@sport/shared/schemas/venues';
import { z } from 'zod';
import { db } from '../../db/client';
import { sportVenueTypes, venues } from '../../db/schema';
import { AppError } from '../../lib/errors';
import {
  buildVenueTypes,
  searchVenues,
  sportTypesFor,
  toVenueCard,
  type SportVenueLink,
  type VenueRow,
} from './search';

const CACHE_TTL_MS = 60_000;

type Catalog = { rows: VenueRow[]; byId: Map<string, VenueRow>; links: SportVenueLink[] };
let cached: { at: number; catalog: Promise<Catalog> } | null = null;

/** Справочник из памяти; одновременные запросы ждут одну и ту же загрузку. */
function loadCatalog(): Promise<Catalog> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.catalog;
  const catalog = (async () => {
    const [rows, links] = await Promise.all([
      db.select().from(venues),
      db.select().from(sportVenueTypes),
    ]);
    return { rows, byId: new Map(rows.map((row) => [row.id, row])), links };
  })();
  const entry = { at: Date.now(), catalog };
  cached = entry;
  // Ошибка базы не должна застрять в кеше на минуту.
  catalog.catch(() => {
    if (cached === entry) cached = null;
  });
  return catalog;
}

/** Сбросить кеш: после сида и в тестах. */
export function resetVenueCache() {
  cached = null;
}

const venueNotFound = () => new AppError(404, 'VENUE_NOT_FOUND', 'Площадка не найдена');

export async function listVenues(query: VenuesQuery): Promise<{ items: Venue[] }> {
  const { rows, links } = await loadCatalog();
  return { items: searchVenues(rows, query, sportTypesFor(links, query.sportId)) };
}

export async function getVenue(id: string): Promise<VenueCard> {
  const row = z.uuid().safeParse(id).success ? (await loadCatalog()).byId.get(id) : undefined;
  if (!row) throw venueNotFound();
  return toVenueCard(row);
}

export async function getVenueTypes(): Promise<VenueTypesResponse> {
  return buildVenueTypes((await loadCatalog()).links);
}

/**
 * Для POST /api/events (участник 1): проверить площадку и отдать её адрес и координаты.
 * Неизвестная площадка — 422 VENUE_NOT_FOUND с ошибкой поля формы venueId.
 */
export async function resolveVenueForEvent(venueId: string): Promise<VenueCard> {
  const row = z.uuid().safeParse(venueId).success
    ? (await loadCatalog()).byId.get(venueId)
    : undefined;
  if (!row) {
    const message = 'Площадка не найдена, выберите другую на карте';
    throw new AppError(422, 'VENUE_NOT_FOUND', message, { venueId: message });
  }
  return toVenueCard(row);
}
