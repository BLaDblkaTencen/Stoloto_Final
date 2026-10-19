// Время демо-событий относительно момента сида: события всегда в ближайшие дни.
// Красноярск живёт по UTC+7 круглый год (переход на летнее время отменён в 2014 году).
const KRASNOYARSK_UTC_OFFSET_HOURS = 7;
export const HOUR = 60 * 60 * 1000;

/** Через days дней в time («19:00») по местному времени Красноярска. */
export function krasnoyarskTime(days: number, time: string, now: Date) {
  const [hours, minutes] = time.split(':').map(Number);
  const local = new Date(now.getTime() + KRASNOYARSK_UTC_OFFSET_HOURS * HOUR);
  local.setUTCDate(local.getUTCDate() + days);
  local.setUTCHours(hours!, minutes!, 0, 0);
  return new Date(local.getTime() - KRASNOYARSK_UTC_OFFSET_HOURS * HOUR);
}

export const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 24 * HOUR);
