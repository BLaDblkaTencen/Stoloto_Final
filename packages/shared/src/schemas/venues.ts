// Площадки и карта (киллер-фича «Место встречи»). Владелец: участник 2.
// Общие для сервера и интерфейса: параметры запроса, формы ответа, подписи типов, разбор области карты.
import { z } from 'zod';
import { VENUE_TYPES, type VenueType } from '../enums';

/** Подписи типов площадок из docs/DATA_MODEL.md. */
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

/** Область карты: юго-запад и северо-восток. В запросе — bbox=minLng,minLat,maxLng,maxLat. */
export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

/** Разбор bbox; null, если строка неверна. Нужен и серверу, и карте в интерфейсе. */
export function parseBbox(raw: string): Bbox | null {
  const parts = raw.split(',').map((part) => part.trim());
  if (parts.length !== 4 || parts.some((part) => part === '')) return null;
  const [minLng, minLat, maxLng, maxLat] = parts.map(Number) as [number, number, number, number];
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (minLat > maxLat || minLng > maxLng) return null;
  return { minLng, minLat, maxLng, maxLat };
}

export function formatBbox({ minLng, minLat, maxLng, maxLat }: Bbox): string {
  return [minLng, minLat, maxLng, maxLat].map((n) => n.toFixed(5)).join(',');
}

export function inBbox(point: { lat: number; lng: number }, bbox: Bbox): boolean {
  return (
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng &&
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat
  );
}

const venueTypeList = z.string().transform((raw, ctx) => {
  const items = [
    ...new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  const unknown = items.filter((item) => !(VENUE_TYPES as readonly string[]).includes(item));
  if (unknown.length > 0) {
    ctx.addIssue({ code: 'custom', message: `Неизвестный тип площадки: ${unknown.join(', ')}` });
    return z.NEVER;
  }
  return items as VenueType[];
});

const bboxParam = z.string().transform((raw, ctx) => {
  const bbox = parseBbox(raw);
  if (!bbox) {
    ctx.addIssue({
      code: 'custom',
      message: 'Область карты задана неверно: нужно minLng,minLat,maxLng,maxLat',
    });
    return z.NEVER;
  }
  return bbox;
});

/** GET /api/venues */
export const venuesQuery = z.object({
  type: venueTypeList.optional(),
  sportId: z.uuid('Неверный вид спорта').optional(),
  onlySuitable: z.stringbool().default(false),
  bbox: bboxParam.optional(),
  q: z.string().trim().max(100, 'Запрос: не длиннее 100 символов').optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type VenuesQuery = z.output<typeof venuesQuery>;

export type VenueContact = { name: string | null; phone: string | null; note: string | null };

/** Карточка площадки: в форме события, в карточке события и на карте. */
export type VenueCard = {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  description: string | null;
  workingHours: string | null;
  /** null, если контактов нет (парки, дворы). Контакты демонстрационные. */
  contact: VenueContact | null;
};

/** Элемент списка площадок. suitable есть, только если в запросе указан вид спорта. */
export type Venue = VenueCard & { suitable?: boolean };

/** GET /api/venue-types. У вида спорта без подсказки (свой вариант) ключа в bySport нет. */
export type VenueTypesResponse = {
  types: { value: VenueType; label: string }[];
  bySport: Record<string, VenueType[]>;
};
