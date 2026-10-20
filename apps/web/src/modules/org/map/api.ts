// Запросы карты «Место встречи». Владелец: участник 2. Контракт — docs/api/organizations.md, раздел 3.
import type { EventLevel, JoinMode } from '@sport/shared';
import type { EventMapItem } from '@sport/shared/schemas/events';
import type { GeocodeResponse, ReverseGeocodeResponse } from '@sport/shared/schemas/geocoding';
import { formatBbox, type Bbox, type Venue, type VenueCard } from '@sport/shared/schemas/venues';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { queryClient } from '../../../shared/api/queryClient';

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
  place?: string;
  sportId?: string;
  joinMode?: JoinMode;
  level?: EventLevel;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Пояс устройства для границ дня в date, dateFrom и dateTo. */
  tz?: string;
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

// Поиск адреса (GET /api/geocode и /api/geocode/reverse). Не хуки: форма ищет после паузы
// в наборе, по Enter или когда метку поставили на карте, а не на каждую букву. Через кэш
// запросов: тот же адрес или та же точка второй раз не уходят на сервер.

/** Места в Красноярске по адресу, лучшее первым; пустой список — не нашли. */
export function geocodeAddress(q: string) {
  return queryClient.fetchQuery({
    queryKey: ['geocode', q],
    queryFn: () => api<GeocodeResponse>(`/geocode?${search({ q })}`),
    staleTime: Infinity,
  });
}

/** Адрес точки, которую поставили на карте; place: null — рядом нет ни дома, ни улицы. */
export function reverseGeocode(lat: number, lng: number) {
  return queryClient.fetchQuery({
    queryKey: ['geocode', 'reverse', lat, lng],
    queryFn: () =>
      api<ReverseGeocodeResponse>(
        `/geocode/reverse?${search({ lat: String(lat), lng: String(lng) })}`,
      ),
    staleTime: Infinity,
  });
}
