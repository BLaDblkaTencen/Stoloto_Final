// Запросы карты «Место встречи». Владелец: участник 2. Контракт — docs/api/organizations.md, раздел 3.
import type { EventLevel, JoinMode } from '@sport/shared';
import type { EventMapItem } from '@sport/shared/schemas/events';
import { formatBbox, type Bbox, type Venue, type VenueCard } from '@sport/shared/schemas/venues';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';

const search = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  return query.toString();
};

/**
 * Все площадки сразу (их десятки): одна загрузка на вид спорта, дальше карта двигается без запросов.
 * С sportId у каждой есть suitable — подходит ли она этому виду спорта.
 */
export function useVenues(sportId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['venues', sportId ?? null],
    queryFn: () => api<{ items: Venue[] }>(`/venues?${search({ sportId, limit: '500' })}`),
    select: (data) => data.items,
    staleTime: 60_000,
    enabled,
  });
}

/** Одна площадка: «Создать встречу здесь» с карты открывает форму с ней. */
export function useVenue(id: string | null) {
  return useQuery({
    queryKey: ['venues', 'one', id],
    queryFn: () => api<VenueCard>(`/venues/${id}`),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

/** Те же фильтры, что у ленты (GET /api/events): карта и список показывают одну подборку. */
export type EventsMapFilters = {
  q?: string;
  sportId?: string;
  joinMode?: JoinMode;
  level?: EventLevel;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
};

/**
 * Область карты, округлённая наружу до сотых градуса: мелкие сдвиги карты попадают в тот же
 * запрос из кэша и не перерисовывают её, а метки у края не пропадают.
 */
export function roundBbox(bbox: Bbox): Bbox {
  return {
    minLng: Math.floor(bbox.minLng * 100) / 100,
    minLat: Math.floor(bbox.minLat * 100) / 100,
    maxLng: Math.ceil(bbox.maxLng * 100) / 100,
    maxLat: Math.ceil(bbox.maxLat * 100) / 100,
  };
}

/** События в видимой области карты; область уже округлена roundBbox (повторное округление сдвигало бы её). */
export function useEventsOnMap(bbox: Bbox | null, filters: EventsMapFilters) {
  const bboxParam = bbox ? formatBbox(bbox) : undefined;
  return useQuery({
    queryKey: ['events', 'map', bboxParam, filters],
    queryFn: () =>
      api<{ items: EventMapItem[]; total: number }>(
        `/events?${search({ view: 'map', limit: '500', bbox: bboxParam, ...filters })}`,
      ),
    enabled: bboxParam !== undefined,
    placeholderData: keepPreviousData,
    select: (data) => data.items,
  });
}
