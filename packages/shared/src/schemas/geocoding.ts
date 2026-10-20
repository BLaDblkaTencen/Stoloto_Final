// Поиск места по адресу для формы встречи: вписанный адрес → точка на карте. Владелец: участник 2.
// Контракт — docs/api/organizations.md, раздел «Поиск адреса». Сервер ходит в OpenStreetMap
// Nominatim сам: браузеру внешние запросы запрещает политика безопасности сайта (CSP).
import { z } from 'zod';

export const geocodeQuery = z.object({
  q: z
    .string({ error: 'Впишите адрес' })
    .trim()
    .min(3, 'Адрес — не короче 3 символов')
    .max(300, 'Адрес — не длиннее 300 символов'),
});

/** Найденное место: короткая подпись («улица Весны, 23»), район и координаты. */
export type GeocodePlace = {
  label: string;
  /** Район или микрорайон для уточнения: «Советский район». */
  context: string | null;
  lat: number;
  lng: number;
};

/** GET /api/geocode — до пяти мест, лучшее первым; пустой список — адрес не нашли. */
export type GeocodeResponse = { items: GeocodePlace[] };
