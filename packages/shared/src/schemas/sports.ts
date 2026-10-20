// Виды спорта: нормализация «своего варианта», проверка запросов и типы API. Владелец: участник 1.
// Нормализация общая для сервера и интерфейса: форма заранее видит, что «футбол » — это уже
// существующий «Футбол», а сервер по тем же правилам не даёт создать дубль (DATA_MODEL).
import { z } from 'zod';

export const SPORT_NAME_MIN = 2;
export const SPORT_NAME_MAX = 40;

/** Название для показа: без лишних пробелов, с заглавной буквы. «  йога   на сапах» → «Йога на сапах». */
export function normalizeSportName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  return clean.charAt(0).toLocaleUpperCase('ru') + clean.slice(1);
}

/**
 * Ключ вида спорта для поиска дублей: нижний регистр, ё → е, знаки препинания и повторные
 * пробелы убраны. «Кик-боксинг!» и «кик  боксинг» дают один ключ «кик боксинг».
 */
export function sportSlug(name: string): string {
  return name
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** «Свой вариант» вида спорта в форме события. */
export const sportNameSchema = z
  .string({ error: 'Впишите вид спорта' })
  .trim()
  .min(SPORT_NAME_MIN, `Вид спорта — не короче ${SPORT_NAME_MIN} символов`)
  .max(SPORT_NAME_MAX, `Вид спорта — не длиннее ${SPORT_NAME_MAX} символов`)
  .refine((name) => sportSlug(name).length >= SPORT_NAME_MIN, 'Название должно содержать буквы');

export const sportsQuerySchema = z.object({
  q: z.string().trim().max(SPORT_NAME_MAX).optional(),
  /** Только виды спорта, у которых есть предстоящие опубликованные события (чипы ленты). */
  withEvents: z.stringbool().optional(),
  /** Самые популярные: N видов с наибольшим числом предстоящих встреч (значки на главной). */
  top: z.coerce.number().int().min(1).max(20).optional(),
});

export type SportsQuery = z.infer<typeof sportsQuerySchema>;

export type Sport = { id: string; name: string; slug: string; isCustom: boolean };
