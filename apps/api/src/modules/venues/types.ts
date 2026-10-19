import type { VENUE_TYPES } from '../../db/schema/common';

export type VenueType = (typeof VENUE_TYPES)[number];

/** Строка площадки так, как её отдаёт слой данных. */
export interface VenueRecord {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  description: string | null;
  workingHours: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactNote: string | null;
}

export interface VenueDto {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  description: string | null;
  workingHours: string | null;
  /** null, если контактов нет (парки, дворы). */
  contact: { name: string | null; phone: string | null; note: string | null } | null;
  /** Есть только если в запросе указан вид спорта. */
  suitable?: boolean;
}

/** Область карты: юго-запад и северо-восток. */
export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface VenueQuery {
  types?: VenueType[];
  /** Подходящие виду спорта типы площадок. Не задано: вид спорта не выбран. Пусто: у вида спорта нет подсказки. */
  sportVenueTypes?: readonly VenueType[];
  onlySuitable?: boolean;
  bbox?: Bbox;
  q?: string;
  limit?: number;
}
