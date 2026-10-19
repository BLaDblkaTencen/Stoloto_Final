import { AppError } from '../../lib/errors';
import type { Bbox } from './types';

const BAD_BBOX = 'Область карты задана неверно: нужно minLng,minLat,maxLng,maxLat';

/** Разбор параметра bbox=minLng,minLat,maxLng,maxLat. Ошибка: 422 INVALID_BBOX. */
export function parseBbox(raw: string): Bbox {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => p === '')) {
    throw new AppError(422, 'INVALID_BBOX', BAD_BBOX);
  }
  const [minLng, minLat, maxLng, maxLat] = parts.map(Number) as [number, number, number, number];
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
    throw new AppError(422, 'INVALID_BBOX', BAD_BBOX);
  }
  const inRange =
    minLat >= -90 && maxLat <= 90 && minLng >= -180 && maxLng <= 180 && minLat <= maxLat;
  if (!inRange || minLng > maxLng) {
    throw new AppError(422, 'INVALID_BBOX', BAD_BBOX);
  }
  return { minLng, minLat, maxLng, maxLat };
}

export function inBbox(point: { lat: number; lng: number }, bbox: Bbox): boolean {
  return (
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng &&
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat
  );
}
