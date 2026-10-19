// Запросы карты «Место встречи». Владелец: участник 2. Контракт — docs/api/organizations.md, раздел 3.
import type { JoinMode } from '@sport/shared';
import type { EventMapItem } from '@sport/shared/schemas/events';
import { formatBbox, type Bbox, type Venue } from '@sport/shared/schemas/venues';
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
export function useVenues(sportId: string | undefined) {
  return useQuery({
    queryKey: ['venues', sportId ?? null],
    queryFn: () => api<{ items: Venue[] }>(`/venues?${search({ sportId, limit: '500' })}`),
    select: (data) => data.items,
    staleTime: 60_000,
  });
}

export type EventsMapFilters = { sportId?: string; joinMode?: JoinMode; date?: string };

/**
 * События в видимой области карты. Область округляется наружу до сотых градуса: мелкие сдвиги
 * карты попадают в тот же запрос из кэша, а метки у края не пропадают.
 */
export function useEventsOnMap(bbox: Bbox | null, filters: EventsMapFilters) {
  const rounded = bbox && {
    minLng: Math.floor(bbox.minLng * 100) / 100,
    minLat: Math.floor(bbox.minLat * 100) / 100,
    maxLng: Math.ceil(bbox.maxLng * 100) / 100,
    maxLat: Math.ceil(bbox.maxLat * 100) / 100,
  };
  const bboxParam = rounded ? formatBbox(rounded) : undefined;
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
