// Поиск адреса для «Места встречи»: адрес → точка на карте и точка → адрес. Владелец: участник 2.
// Источник — OpenStreetMap Nominatim. По его правилам (operations.osmfoundation.org/policies/nominatim)
// не чаще запроса в секунду, с понятным User-Agent и без подсказок на каждую букву: поэтому
// запросы идут по одному в очереди, ответы кэшируются, а форма ищет по кнопке или при уходе из поля.
import type { GeocodePlace } from '@sport/shared/schemas/geocoding';
import { env } from '../../env';
import { AppError } from '../../lib/errors';

/** Красноярск с пригородами: west,north,east,south. Ищем только здесь — в городе демо-данных. */
const CITY_VIEWBOX = '92.55,56.15,93.25,55.9';
const USER_AGENT = 'vmeste-sport-platform/1.0 (+https://github.com/BLaDblkaTencen/Stoloto_Final)';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 1000;
/** Больше ждущих в очереди — сразу «недоступно», чтобы запрос не висел десятки секунд. */
const QUEUE_LIMIT = 10;

const unavailable = () =>
  new AppError(
    503,
    'GEOCODER_UNAVAILABLE',
    'Поиск адреса сейчас недоступен. Отметьте место на карте',
  );

// Сокращения, которые Nominatim не понимает: «пр. Мира» не находится, «проспект Мира» — да.
// После сокращения — точка или пробел, иначе это начало другого слова («улица», «проезд»).
const ABBREVIATIONS: [string, string][] = [
  ['ул', 'улица'],
  ['пр-т', 'проспект'],
  ['просп', 'проспект'],
  ['пр', 'проспект'],
  ['пер', 'переулок'],
  ['пл', 'площадь'],
  ['наб', 'набережная'],
  ['б-р', 'бульвар'],
  ['мкрн', 'микрорайон'],
  ['мкр', 'микрорайон'],
  ['д', ''],
];

// Слова-ориентиры, с которыми адрес не находится: «ул. Весны, 23, двор», «Сбор у главного входа в …».
const NOISE = [
  /(?<!\p{L})(сбор|встреча|встречаемся|собираемся)(?!\p{L})/giu,
  /(?<!\p{L})(у|возле|около|напротив|рядом\s+с|за)\s+(главного\s+|центрального\s+|северного\s+|южного\s+|бокового\s+)?(входа|ворот|калитки)(\s+(в|на))?(?!\p{L})/giu,
  /(?<!\p{L})(главный|центральный|северный|южный|боковой)\s+вход(?!\p{L})/giu,
  /(?<!\p{L})(во\s+)?(двор|дворе|двора|дворик|дворике)(?!\p{L})/giu,
  /(?<!\p{L})(\d+\s*(этаж|подъезд)|(этаж|подъезд)\s*\d+)(?!\p{L})/giu,
];

/** Адрес, каким его пишут люди, → запрос, который понимает Nominatim. */
export function cleanAddress(address: string): string {
  let text = address;
  for (const [short, full] of ABBREVIATIONS) {
    // В сокращениях только буквы и дефис: экранировать нечего (вне [] дефис — обычный знак).
    text = text.replace(
      new RegExp(`(?<!\\p{L})${short}(\\.\\s*|\\s+)`, 'giu'),
      full ? `${full} ` : '',
    );
  }
  for (const pattern of NOISE) text = text.replace(pattern, ' ');
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/^[\s,–—-]+|[\s,–—-]+$/g, '');
}

/**
 * Что спрашивать по очереди: очищенный адрес, потом без последней части после запятой
 * («улица Весны, 23, у фонтана» → «улица Весны, 23» → «улица Весны»).
 */
export function queryVariants(address: string, limit = 3): string[] {
  const variants: string[] = [];
  let parts = cleanAddress(address).split(', ');
  while (parts.length > 0 && variants.length < limit) {
    const query = parts.join(', ');
    if (query.length >= 3 && !variants.includes(query)) variants.push(query);
    parts = parts.slice(0, -1);
  }
  return variants;
}

/** Ответ Nominatim (format=jsonv2, addressdetails=1) — только то, что нам нужно. */
export type NominatimPlace = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: Partial<
    Record<
      | 'road'
      | 'pedestrian'
      | 'footway'
      | 'square'
      | 'house_number'
      | 'suburb'
      | 'city_district'
      | 'quarter'
      | 'neighbourhood',
      string
    >
  >;
};

/** Место для формы: дом — «улица Весны, 23», парк или площадь — по названию. */
export function toPlace(found: NominatimPlace): GeocodePlace {
  const address = found.address ?? {};
  const street = address.road ?? address.pedestrian ?? address.footway ?? address.square;
  const house = address.house_number;
  const label =
    street && house
      ? `${street}, ${house}`
      : found.name || street || found.display_name?.split(',')[0]?.trim() || 'Точка на карте';
  return {
    label,
    context:
      address.suburb ?? address.city_district ?? address.quarter ?? address.neighbourhood ?? null,
    lat: Number(found.lat),
    lng: Number(found.lon),
  };
}

/**
 * Одно и то же место дважды (площадь и остановка «Площадь Революции», остров и «остров» рядом):
 * та же подпись без учёта регистра в пределах километра — оставляем первое.
 */
export function uniquePlaces(places: GeocodePlace[]): GeocodePlace[] {
  const key = (place: GeocodePlace) => place.label.toLocaleLowerCase('ru');
  return places.filter(
    (place, index) =>
      places.findIndex(
        (other) =>
          key(other) === key(place) &&
          Math.abs(other.lat - place.lat) < 0.01 &&
          Math.abs(other.lng - place.lng) < 0.016,
      ) === index,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type GeocoderOptions = {
  /** Адрес сервера Nominatim; null — поиск выключен (тесты), запросы отвечают 503. */
  baseUrl: string | null;
  fetch?: typeof fetch;
  minIntervalMs?: number;
  timeoutMs?: number;
};

export function createGeocoder({
  baseUrl,
  fetch: send = fetch,
  minIntervalMs = 1100,
  timeoutMs = 6000,
}: GeocoderOptions) {
  const cache = new Map<string, { value: unknown; expires: number }>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastCallAt = 0;
  let waiting = 0;

  const cached = (url: string) => {
    const hit = cache.get(url);
    return hit && hit.expires > Date.now() ? hit : undefined;
  };

  async function request<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!baseUrl) throw unavailable();
    const query = new URLSearchParams({
      ...params,
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'ru',
    });
    const url = `${baseUrl}${path}?${query}`;
    const hit = cached(url);
    if (hit) return hit.value as T;
    if (waiting >= QUEUE_LIMIT) throw unavailable();

    waiting += 1;
    const run = queue.then(async () => {
      // Тот же запрос мог прийти, пока этот ждал в очереди.
      const ready = cached(url);
      if (ready) return ready.value;
      const pause = lastCallAt + minIntervalMs - Date.now();
      if (pause > 0) await sleep(pause);
      lastCallAt = Date.now();
      const response = await send(url, {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw unavailable();
      const value: unknown = await response.json();
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
      return value;
    });
    queue = run.catch(() => undefined);
    try {
      return (await run) as T;
    } catch (err) {
      throw err instanceof AppError ? err : unavailable();
    } finally {
      waiting -= 1;
    }
  }

  return {
    /** До пяти мест в Красноярске, лучшее первым; [] — не нашли ни по одному варианту запроса. */
    async search(address: string, attempts = 3): Promise<GeocodePlace[]> {
      for (const q of queryVariants(address, attempts)) {
        const found = await request<NominatimPlace[]>('/search', {
          q,
          limit: '5',
          countrycodes: 'ru',
          viewbox: CITY_VIEWBOX,
          bounded: '1',
        });
        if (found.length > 0) return uniquePlaces(found.map(toPlace));
      }
      return [];
    },

    /** Ближайший адрес к точке; null — рядом ничего (Nominatim отвечает { error }). */
    async reverse(lat: number, lng: number): Promise<GeocodePlace | null> {
      const found = await request<NominatimPlace | { error: string }>('/reverse', {
        lat: String(lat),
        lon: String(lng),
        zoom: '18',
      });
      return 'error' in found ? null : { ...toPlace(found), lat, lng };
    },
  };
}

export type Geocoder = ReturnType<typeof createGeocoder>;

// В тестах внешний сервис не вызываем: поиск выключен, события создаются без него.
export const geocoder = createGeocoder({
  baseUrl: env.NODE_ENV === 'test' || !env.GEOCODER_URL ? null : env.GEOCODER_URL,
});

/**
 * Точка по адресу для события без площадки и без отмеченной точки (модуль events): чтобы
 * встреча попала на карту. Не нашли или сервис недоступен — null, событие сохраняется как есть.
 */
export async function locateAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const [first] = await geocoder.search(address, 2);
    return first ? { lat: first.lat, lng: first.lng } : null;
  } catch {
    return null;
  }
}
